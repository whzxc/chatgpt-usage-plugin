//! Read quota through the installed native CLI. No credentials are read or stored here.
use crate::*;
use std::{
    process::Stdio,
    sync::OnceLock,
    time::{Duration, Instant},
};
use tokio::io::{AsyncWriteExt, BufReader};
#[derive(Default)]
struct Cache {
    value: Value,
    checked: Option<Instant>,
    refreshing: bool,
}
static CACHE: OnceLock<Arc<Mutex<Cache>>> = OnceLock::new();

pub async fn snapshot(force: bool) -> Value {
    let cache = CACHE.get_or_init(Default::default).clone();
    let mut state = cache.lock().await;
    if !state.refreshing
        && (force
            || state
                .checked
                .is_none_or(|at| at.elapsed() >= Duration::from_secs(60)))
    {
        state.refreshing = true;
        let cache = cache.clone();
        tokio::spawn(async move {
            let result = read().await;
            let mut value = match result {
                Ok(raw) => normalize(raw),
                Err(message) => {
                    json!({"providerId":"codex","agentId":"codex","name":"Codex","eligible":true,"selected":true,
                    "state":"unavailable","windows":[],"blockedPoolIds":[],"error":{"code":"request-failed","message":message}})
                }
            };
            // Reuse the independently indexed current view; do not block a quota read on a full log scan.
            value["rawUsage"]["history"] = crate::pricing::history().await;
            let mut state = cache.lock().await;
            if value["state"] == "unavailable" && state.value["observedAt"].is_string() {
                state.value["error"] = value["error"].clone();
                state.value["state"] = json!("stale");
            } else {
                state.value = value;
            }
            state.checked = Some(Instant::now());
            state.refreshing = false;
        });
    }
    let mut value = if state.value.is_null() {
        json!({"providerId":"codex","agentId":"codex","name":"Codex","eligible":true,"selected":true,"state":"loading","windows":[],"blockedPoolIds":[]})
    } else {
        state.value.clone()
    };
    value["refreshing"] = json!(state.refreshing);
    value
}
async fn read() -> Result<Value> {
    let binary = crate::installation::installation()
        .map(|i| i.binary)
        .unwrap_or_else(|| PathBuf::from(if cfg!(windows) { "codex.exe" } else { "codex" }));
    let mut child = command(binary)
        .arg("app-server")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Native Codex CLI unavailable: {e}"))?;
    let mut input = child.stdin.take().ok_or("missing stdin")?;
    let mut reader = BufReader::new(child.stdout.take().ok_or("missing stdout")?);
    let result = tokio::time::timeout(Duration::from_secs(25), async {
        input.write_all(format!("{}\n",json!({"id":1,"method":"initialize","params":{"clientInfo":{"name":"chatgpt-usage","version":env!("CARGO_PKG_VERSION")},"capabilities":{"experimentalApi":true}}})).as_bytes()).await.map_err(|e|e.to_string())?;
        response(&mut reader,1).await?;
        input.write_all(b"{\"method\":\"initialized\"}\n{\"id\":2,\"method\":\"account/rateLimits/read\",\"params\":{}}\n").await.map_err(|e|e.to_string())?;
        response(&mut reader,2).await
    }).await.map_err(|_|"Quota request timed out".to_string()).and_then(|r|r);
    let _ = input.shutdown().await;
    if tokio::time::timeout(Duration::from_secs(2), child.wait())
        .await
        .is_err()
    {
        let _ = child.kill().await;
    }
    result
}
async fn response(reader: &mut BufReader<tokio::process::ChildStdout>, id: i64) -> Result<Value> {
    loop {
        let bytes = line(reader, 4 * 1024 * 1024).await?;
        if bytes.is_empty() {
            return Err("Native quota reader disconnected".into());
        }
        let value: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        if value["id"] == id && value.get("method").is_none() {
            if let Some(error) = value.get("error") {
                return Err(error.to_string());
            }
            return Ok(value["result"].clone());
        }
    }
}
fn normalize(raw: Value) -> Value {
    let groups: Vec<(String, &Value)> = if let Some(groups) = raw["rateLimitsByLimitId"].as_object()
    {
        groups.iter().map(|(id, v)| (id.clone(), v)).collect()
    } else if raw["rateLimits"].is_object() {
        vec![(
            raw["rateLimits"]["limitId"]
                .as_str()
                .unwrap_or("codex")
                .into(),
            &raw["rateLimits"],
        )]
    } else {
        vec![]
    };
    let mut windows = vec![];
    let mut blocked = vec![];
    for (pool, group) in groups {
        if group["rateLimitReachedType"].is_string() || group["spendControlReached"] == true {
            blocked.push(pool.clone());
        }
        for slot in ["primary", "secondary"] {
            let q = &group[slot];
            let Some(used) = q["usedPercent"].as_f64().filter(|v| v.is_finite()) else {
                continue;
            };
            windows.push(json!({"id":format!("{pool}/{slot}"),"poolId":pool,
                "label":q["windowDurationMins"].as_u64().map(|v|format!("{v} min")).unwrap_or(slot.into()),
                "usedPercent":used.clamp(0.,100.),"resetsAt":q["resetsAt"].as_i64().and_then(|at|chrono::DateTime::from_timestamp(at,0)).map(|d|d.to_rfc3339()),
                "scope":group["limitName"],"exhausted":used>=100.}));
        }
    }
    json!({"providerId":"codex","agentId":"codex","name":"Codex","eligible":true,"selected":true,
        "state":if windows.is_empty(){"unavailable"}else{"ready"},"windows":windows,"observedAt":now(),
        "blockedPoolIds":blocked,"accountBlocked":raw["ordinaryUsageAllowed"].as_bool().map(|v|!v),"rawUsage":raw})
}
