// Pricing adapted from OpenUsage (MIT); see shared/pricing/LICENSE.OpenUsage.
mod feeds;
use chrono::{DateTime, Local, Utc};
use feeds as pricing;
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
    sync::{Mutex, OnceLock},
};
#[derive(Clone)]
struct Event {
    at: i64,
    model: String,
    input: u64,
    cached: u64,
    output: u64,
    write: u64,
    fast: bool,
}
impl Event {
    fn tokens(&self) -> u64 {
        self.input
            .saturating_add(self.cached)
            .saturating_add(self.output)
            .saturating_add(self.write)
    }
}
pub(crate) struct UsagePricing(std::sync::Arc<pricing::Pricing>);
impl UsagePricing {
    pub(crate) fn current() -> Self {
        Self(pricing::current())
    }
    pub(crate) fn estimate(&self, r: &crate::usage::Response) -> Option<f64> {
        if !r.reliable {
            return None;
        }
        let cached = r.tokens.cached?;
        cost(
            &Event {
                at: r.at,
                model: r.model.clone().unwrap_or_default(),
                input: r.tokens.input?.checked_sub(cached)?,
                cached,
                output: r.tokens.output?,
                write: 0,
                fast: r
                    .service_tier
                    .as_deref()
                    .is_some_and(|s| ["fast", "priority"].contains(&s)),
            },
            "codex",
            &self.0,
        )
    }
}
pub async fn history() -> Value {
    let provider = "codex";
    let _ = crate::usage::refresh().await;
    let (rows, incomplete) = match crate::usage::responses().await {
        Ok(value) => value,
        Err(_) => return json!({"error":"history-unavailable"}),
    };
    let mut missing = incomplete;
    let events = rows
        .into_iter()
        .filter_map(|r| {
            if !r.reliable {
                missing = true;
                return None;
            }
            let (Some(input), Some(cached), Some(output)) =
                (r.tokens.input, r.tokens.cached, r.tokens.output)
            else {
                missing = true;
                return None;
            };
            let Some(input) = input.checked_sub(cached) else {
                missing = true;
                return None;
            };
            Some(Event {
                at: r.at,
                model: r.model.unwrap_or_default(),
                input,
                cached,
                output,
                write: 0,
                fast: r
                    .service_tier
                    .as_deref()
                    .is_some_and(|s| ["fast", "priority"].contains(&s)),
            })
        })
        .collect();
    return summarize(events, provider, missing, &pricing::current());
}
fn cost(e: &Event, provider: &str, p: &pricing::Pricing) -> Option<f64> {
    let mut model = e.model.trim().to_lowercase();
    if let Some((_, name)) = p.aliases.iter().find(|(re, _)| re.is_match(&model)) {
        model = name.clone();
    }
    if model == "gpt-reserve" {
        model = "gpt-5.6-luna".into();
    }
    let alias_fast = provider == "codex" && model.ends_with("-fast");
    if alias_fast {
        model = model.trim_end_matches("-fast").into();
    }
    let models = &p.data["models"];
    if models.get(&model).is_none() {
        model = model.rsplit('/').next()?.to_owned();
    }
    let r = models.get(&model)?;
    let mut i = r["i"].as_f64()?;
    let mut o = r["o"].as_f64()?;
    let mut cr = if provider == "codex" && r["cre"] == false {
        i
    } else {
        r["cr"].as_f64().unwrap_or(i)
    };
    let mut cw = r["cw"].as_f64().unwrap_or(i);
    if provider == "codex"
        && e.input + e.cached > 272000
        && [
            "gpt-5.4",
            "gpt-5.4-pro",
            "gpt-5.5",
            "gpt-5.5-pro",
            "gpt-5.6-sol",
            "gpt-5.6-terra",
            "gpt-5.6-luna",
            "gpt-6-astra",
        ]
        .contains(&model.as_str())
    {
        i *= 2.;
        cr *= 2.;
        cw *= 2.;
        o *= 1.5;
    } else if provider != "cursor" && e.input + e.cached + e.write > 200000 {
        i = r["ia"].as_f64().unwrap_or(i);
        o = r["oa"].as_f64().unwrap_or(o);
        cr = r["cra"].as_f64().unwrap_or(cr);
        cw = r["cwa"].as_f64().unwrap_or(cw);
    }
    let multiplier = if e.fast || alias_fast {
        p.data["fast"][&model]
            .as_f64()
            .or_else(|| r["fast"].as_f64())
            .unwrap_or(if provider == "codex" { 2. } else { 1. })
    } else {
        1.
    };
    Some(
        (e.input as f64 * i + e.cached as f64 * cr + e.output as f64 * o + e.write as f64 * cw)
            / 1_000_000.
            * multiplier,
    )
}
fn summarize(
    events: Vec<Event>,
    provider: &str,
    incomplete: bool,
    prices: &pricing::Pricing,
) -> Value {
    let observed = Utc::now();
    let coverage_start = observed - chrono::Duration::days(32);
    let mut timeline: BTreeMap<i64, (u64, f64, u64)> = BTreeMap::new();
    let today = observed.with_timezone(&Local).date_naive();
    let since = today - chrono::Duration::days(29);
    let yesterday = today - chrono::Duration::days(1);
    let mut buckets: BTreeMap<&str, (u64, f64, u64, BTreeSet<String>)> =
        ["today", "yesterday", "last7", "last30"]
            .into_iter()
            .map(|s| (s, (0, 0., 0, BTreeSet::new())))
            .collect();
    let mut models: BTreeMap<&str, BTreeMap<String, (u64, f64, u64)>> = BTreeMap::new();
    for e in events {
        let Some(at) = DateTime::from_timestamp_millis(e.at) else {
            continue;
        };
        let day = at.with_timezone(&Local).date_naive();
        if at < coverage_start || at > observed || e.tokens() == 0 {
            continue;
        }
        let dollars = cost(&e, provider, prices);
        let entry = timeline.entry(e.at).or_default();
        entry.0 = entry.0.saturating_add(e.tokens());
        if let Some(d) = dollars {
            entry.1 += d;
            entry.2 = entry.2.saturating_add(e.tokens());
        }
        if day < since {
            continue;
        }
        for key in ["today", "yesterday", "last7", "last30"] {
            if key == "today" && day != today
                || key == "yesterday" && day != yesterday
                || key == "last7" && day < today - chrono::Duration::days(6)
            {
                continue;
            }
            let model = if e.model.trim().is_empty() {
                "unknown".into()
            } else {
                e.model.trim().to_lowercase()
            };
            let detail = models.entry(key).or_default().entry(model).or_default();
            detail.0 = detail.0.saturating_add(e.tokens());
            if let Some(d) = dollars {
                detail.1 += d;
                detail.2 = detail.2.saturating_add(e.tokens());
            }
            let b = buckets.get_mut(key).unwrap();
            b.0 = b.0.saturating_add(e.tokens());
            if let Some(d) = dollars {
                b.1 += d;
                b.2 = b.2.saturating_add(e.tokens());
            } else {
                b.3.insert(if e.model.is_empty() {
                    "unknown".into()
                } else {
                    e.model.clone()
                });
            }
        }
    }
    let periods:Vec<_>=["today","yesterday","last7","last30"].into_iter().map(|id|{
        let mut details: Vec<_> = models.get(id).into_iter().flat_map(|items| items.iter()).map(|(model,b)| json!({"model":model,"tokens":b.0,"estimatedUsd":if b.2>0{Some(b.1)}else{None},"pricedTokens":b.2})).collect();
        details.sort_by(|a,b| b["tokens"].as_u64().cmp(&a["tokens"].as_u64()));
        let b=&buckets[id];json!({"models":details,"id":id,"tokens":b.0,"estimatedUsd":if b.2>0{Some(b.1)}else{None},"pricedTokens":b.2,"unknownModels":b.3})
    }).collect();
    let timeline: Vec<_> = timeline
        .into_iter()
        .map(|(at, (tokens, usd, priced))| json!([at, tokens, usd, priced]))
        .collect();
    json!({"timeline":timeline,"coverageStart":coverage_start.to_rfc3339(),"periods":periods,"currency":"USD","estimated":true,"scope":if provider=="cursor"{"account-export"}else{"local-device"},
        "incomplete":incomplete,"pricingUpdatedAt":prices.data["updatedAt"],"observedAt":observed.to_rfc3339()})
}
