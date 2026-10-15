import type { Collector } from "./collector.js";
import { Worker } from "node:worker_threads";
import { IndexStore } from "./index-store.js";
import { Pricing } from "./pricing.js";
import { Views } from "./views.js";
import { sortedValues, version, type Json } from "./common.js";
export class UsageService {
  worker = new Worker(new URL("./worker.mjs", import.meta.url), {
    resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 8 },
  });
  index?: IndexStore;
  pricing = new Pricing();
  failure?: string;
  constructor() {
    this.worker.on("error", (e) => {
      this.failure = e instanceof Error ? e.message : String(e);
    });
    this.worker.on("message", (m) => {
      this.failure = m.error;
    });
  }
  open() {
    if (!this.index)
      try {
        this.index = new IndexStore(true);
      } catch {}
    return this.index;
  }
  async query(args: Json, meta: Json, scope: string): Promise<Json> {
    const selected =
      scope === "thread"
        ? args.threadId ||
          (meta.threadId && meta.thread_id && meta.threadId !== meta.thread_id
            ? null
            : meta.threadId || meta.thread_id)
        : null;
    const index = this.open();
    this.worker.postMessage({
      selected: index?.needsThread(selected) ? selected : null,
      quota: scope === "global",
      force: args.refreshQuota,
    });
    if (!index?.get("scan") || index.needsThread(selected))
      return {
        schemaVersion: 1,
        pluginVersion: version,
        scope,
        state: this.failure ? "unavailable" : "collecting",
        message: this.failure ?? "正在读取所选范围的本机用量。",
        quota: scope === "global" ? this.quota() : null,
      };
    index.db.exec("BEGIN");
    try {
      this.pricing.build();
      const collector = index.collector(
          scope === "global" ? 32 : (args.days ?? 7),
          selected,
        ),
        views = new Views(collector, this.pricing, index);
      const quota = scope === "global" ? this.quota(collector) : null;
      if (scope === "global") index.select(collector, args.days ?? 7);
      if (scope === "thread" && args.toolId) {
        try {
          return {
            schemaVersion: 1,
            scope,
            state: "ready",
            quota: null,
            toolDetail: views.toolDetail({ ...args, threadId: selected }),
          };
        } catch (error) {
          return {
            schemaVersion: 1,
            scope,
            state: "unavailable",
            message: (error as Error).message,
            quota: null,
          };
        }
      }
      return { ...views.snapshot(args, meta, scope), quota };
    } finally {
      index.db.exec("COMMIT");
    }
  }
  quota(collector?: Collector): Json {
    const index = this.open(),
      stored = index?.get("quota");
    const lease = index?.db
      .prepare("SELECT until FROM leases WHERE key='quota'")
      .get();
    const value = stored?.value ?? {
      providerId: "codex",
      agentId: "codex",
      name: "Codex",
      eligible: true,
      selected: true,
      windows: [],
      blockedPoolIds: [],
      state: "loading",
    };
    const result = {
      ...value,
      refreshing: !stored || Number(lease?.until ?? 0) > Date.now(),
    };
    if (!index?.get("scan") || value.state !== "ready" || value.error)
      return result;
    const now = Date.now(),
      observed = Date.parse(value.observedAt ?? "");
    if (
      !Number.isFinite(observed) ||
      now - observed > 300000 ||
      observed > now + 30000
    )
      return result;
    const windows = value.windows.filter(
      (w: Json) =>
        w.poolId !== "base_model_inference" && w.scope !== "gpt-reserve",
    );
    const eligible = windows.filter((w: Json) => {
      const duration = /^(\d+) min$/.exec(w.label),
        reset = Date.parse(w.resetsAt ?? "");
      return (
        duration &&
        Number(duration[1]) > 0 &&
        Number.isFinite(reset) &&
        now < reset &&
        w.usedPercent >= 1 &&
        w.usedPercent < 100 &&
        (new Set(windows.map((v: Json) => v.poolId)).size <= 1 ||
          w.poolId === "codex") &&
        reset - Number(duration[1]) * 60000 >= now - 32 * 86400000
      );
    });
    if (!eligible.length) return result;
    if (!collector) return result;
    const historyAt = Date.parse(collector.observedAt ?? "");
    if (
      !Number.isFinite(historyAt) ||
      now - historyAt > 300000 ||
      historyAt > now + 30000 ||
      Math.abs(observed - historyAt) > 300000
    )
      return result;
    const c = collector,
      rows = [...c.threads.values()].flatMap((t) =>
        sortedValues(t.modern ? t.responses : t.legacy),
      );
    const incomplete =
      c.issues.size > 0 ||
      [...c.threads.values()].some((t) => t.issues.size > 0);
    result.windows = value.windows.map((w: Json) => {
      if (!eligible.includes(w)) return w;
      const start =
          Date.parse(w.resetsAt) - Number(/^(\d+)/.exec(w.label)![1]) * 60000,
        end = Math.min(now, observed, historyAt);
      if (start >= end) return w;
      let tokens = 0,
        pricedTokens = 0,
        estimatedUsd = 0;
      for (const r of rows) {
        const t = r.tokens;
        if (
          r.at < start ||
          r.at > end ||
          !r.reliable ||
          t.input === null ||
          t.cached === null ||
          t.output === null ||
          t.input < t.cached
        )
          continue;
        const n = t.input + t.output,
          usd = this.pricing.estimate(r);
        tokens += n;
        if (usd !== null) {
          pricedTokens += n;
          estimatedUsd += usd;
        }
      }
      if (
        tokens <= 0 ||
        pricedTokens <= 0 ||
        estimatedUsd <= 0 ||
        !Number.isFinite(estimatedUsd)
      )
        return w;
      return {
        ...w,
        estimate: {
          estimatedUsd,
          tokens,
          pricedTokens,
          projectedUsd: (estimatedUsd * 100) / w.usedPercent,
          start,
          end,
          incomplete: incomplete || pricedTokens !== tokens,
        },
      };
    });
    return result;
  }
  async stop() {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 30000).unref();
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      this.worker.once("exit", done);
      this.worker.on("message", (m) => {
        if (m.stopped) done();
      });
      this.worker.postMessage({ stop: true });
    });
    await this.worker.terminate();
    this.index?.close();
  }
}
