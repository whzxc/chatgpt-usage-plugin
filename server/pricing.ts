import { statSync } from "node:fs";
// Pricing adapted from OpenUsage (MIT); see shared/pricing/LICENSE.OpenUsage.
import path from "node:path";
import modelsDev from "../shared/pricing/models_dev_snapshot.json";
import litellm from "../shared/pricing/litellm_snapshot.json";
import supplement from "../shared/pricing/supplement.json";
import { root, load, save, hash, type Json } from "./common.js";
import { type Response } from "./projection.js";
const sources: [string, string, Json][] = [
  ["models_dev", "https://models.dev/api.json", modelsDev],
  [
    "litellm",
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
    litellm,
  ],
  [
    "supplement",
    "https://robinebers.github.io/openusage/pricing_supplement.json",
    supplement,
  ],
];
const directory = () => path.join(root(), "subscriptions/pricing");
const number = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
function rates(
  v: Json,
  i: string,
  o: string,
  cw: string,
  cr: string,
  scale: number,
): Json | null {
  const input = number(v[i]),
    output = number(v[o]);
  if (input === null || output === null) return null;
  return {
    i: input * scale,
    o: output * scale,
    cw: (number(v[cw]) ?? input) * scale,
    cr: (number(v[cr]) ?? input * 0.1) * scale,
    cre: number(v[cr]) !== null,
  };
}
function compact(id: string, raw: Json): Json | null {
  const models: Json = Object.create(null);
  if (id === "litellm")
    for (const [name, v] of Object.entries(raw)) {
      if (!v || typeof v !== "object") continue;
      const r = rates(
        v,
        "input_cost_per_token",
        "output_cost_per_token",
        "cache_creation_input_token_cost",
        "cache_read_input_token_cost",
        1e6,
      );
      if (!r) continue;
      for (const [key, field] of [
        ["ia", "input_cost_per_token_above_200k_tokens"],
        ["oa", "output_cost_per_token_above_200k_tokens"],
        ["cwa", "cache_creation_input_token_cost_above_200k_tokens"],
        ["cra", "cache_read_input_token_cost_above_200k_tokens"],
      ]) {
        const n = number(v[field]);
        if (n !== null) r[key] = n * 1e6;
      }
      if (number(v.provider_specific_entry?.fast) !== null)
        r.fast = v.provider_specific_entry.fast;
      models[name] = r;
    }
  else if (id === "models_dev")
    for (const provider of Object.values(raw))
      for (const [name, v] of Object.entries(provider?.models ?? {}) as [
        string,
        Json,
      ][]) {
        const r = rates(
          v.cost ?? {},
          "input",
          "output",
          "cache_write",
          "cache_read",
          1,
        );
        if (r && !models[name]) models[name] = r;
      }
  else if (id === "supplement")
    for (const [name, v] of Object.entries(raw.pricing ?? {}) as [
      string,
      Json,
    ][]) {
      const r = rates(
        v,
        "input_per_million",
        "output_per_million",
        "cache_write_per_million",
        "cache_read_per_million",
        1,
      );
      if (r) models[name] = r;
    }
  return Object.keys(models).length ? { models } : null;
}
export class Pricing {
  models: Json = Object.create(null);
  fast: Json = {};
  aliases: [RegExp, string][] = [];
  updatedAt = "";
  next = 0;
  refreshing = false;
  constructor() {
    this.build();
  }
  signature = "";
  version = "";
  build() {
    const signature = sources
      .map(([id]) => {
        try {
          const m = statSync(path.join(directory(), `${id}.json`));
          return `${m.mtimeMs}:${m.size}`;
        } catch {
          return "bundled";
        }
      })
      .join(";");
    if (signature === this.signature) return;
    this.signature = signature;
    this.models = Object.create(null);
    this.updatedAt = "";
    for (const [id, , bundled] of sources) {
      let source: Json = structuredClone(bundled);
      try {
        const cached = load(path.join(directory(), `${id}.json`));
        if (id === "supplement") {
          if (
            (cached.updated_at ?? "") >= (source.updated_at ?? "") &&
            compact(id, cached)
          )
            source = cached;
        } else if (cached.models) Object.assign(source.models, cached.models);
      } catch {}
      const data = id === "supplement" ? compact(id, source) : source;
      Object.assign(this.models, data?.models ?? {});
      if (id === "supplement") {
        this.fast = source.fast_multipliers ?? {};
        this.aliases = (source.alias_rules ?? []).flatMap((a: Json) => {
          try {
            return [[new RegExp(a.pattern, "i"), a.canonical]];
          } catch {
            return [];
          }
        });
      }
      for (const key of ["updated_at", "retrieved_at"])
        if (typeof source[key] === "string" && source[key] > this.updatedAt)
          this.updatedAt = source[key];
    }
    this.version = hash(
      JSON.stringify([
        this.models,
        this.fast,
        this.aliases.map(([r, v]) => [r.source, v]),
      ]),
    );
  }
  refresh() {
    if (this.refreshing || Date.now() < this.next) return;
    this.refreshing = true;
    void Promise.allSettled(
      sources.map(async ([id, url]) => {
        const statePath = path.join(directory(), `${id}-state.json`);
        let state: Json = {};
        try {
          state = load(statePath);
        } catch {}
        const now = Math.floor(Date.now() / 1000);
        if (state.nextAt > now) return;
        let success = false;
        try {
          const response = await fetch(url, {
            redirect: "error",
            signal: AbortSignal.timeout(20000),
            headers: state.etag ? { "If-None-Match": state.etag } : {},
          });
          if (response.status === 304) {
            load(path.join(directory(), `${id}.json`));
            success = true;
          } else if (response.ok && response.body) {
            const chunks: Uint8Array[] = [];
            let length = 0;
            for await (const chunk of response.body) {
              length += chunk.length;
              if (length > 32 * 1024 * 1024)
                throw new Error("response-too-large");
              chunks.push(chunk);
            }
            const raw = JSON.parse(Buffer.concat(chunks).toString("utf8")),
              data = compact(id, raw);
            if (!data) throw new Error("invalid-pricing");
            save(
              path.join(directory(), `${id}.json`),
              id === "supplement"
                ? raw
                : { ...data, retrieved_at: new Date().toISOString() },
            );
            state.etag = response.headers.get("etag");
            success = true;
          }
        } catch {}
        state.nextAt = now + (success ? 3600 : 1800);
        try {
          save(statePath, state);
        } catch {}
      }),
    ).finally(() => {
      this.next = Date.now() + 60000;
      this.refreshing = false;
    });
  }
  estimate(r: Response): number | null {
    const t = r.tokens;
    if (
      !r.reliable ||
      t.input === null ||
      t.cached === null ||
      t.output === null ||
      t.input < t.cached
    )
      return null;
    let model = (r.model ?? "").trim().toLowerCase();
    const alias = this.aliases.find(([re]) => re.test(model));
    if (alias) model = alias[1];
    if (model === "gpt-reserve") model = "gpt-5.6-luna";
    const aliasFast = model.endsWith("-fast");
    if (aliasFast) model = model.replace(/(?:-fast)+$/, "");
    if (!this.models[model]) model = model.split("/").at(-1)!;
    const rate = this.models[model];
    if (!rate || number(rate.i) === null || number(rate.o) === null)
      return null;
    let i = rate.i,
      o = rate.o,
      cr = rate.cre === false ? i : (number(rate.cr) ?? i);
    if (
      t.input > 272000 &&
      [
        "gpt-5.4",
        "gpt-5.4-pro",
        "gpt-5.5",
        "gpt-5.5-pro",
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
        "gpt-6-astra",
      ].includes(model)
    ) {
      i *= 2;
      cr *= 2;
      o *= 1.5;
    } else if (t.input > 200000) {
      i = number(rate.ia) ?? i;
      o = number(rate.oa) ?? o;
      cr = number(rate.cra) ?? cr;
    }
    const multiplier =
      aliasFast || ["fast", "priority"].includes(r.serviceTier ?? "")
        ? (number(this.fast[model]) ?? number(rate.fast) ?? 2)
        : 1;
    return (
      (((t.input - t.cached) * i + t.cached * cr + t.output * o) / 1e6) *
      multiplier
    );
  }
}
