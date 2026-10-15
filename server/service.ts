import { DataViews } from "./data.js";
import type { Collector } from "./collector.js";
import { Worker } from "node:worker_threads";
import { IndexStore } from "./index-store.js";
import type { Pricing } from "./pricing.js";
import { Views } from "./views.js";
import { sortedValues, version, type Json } from "./common.js";
export class UsageService {
  worker = new Worker(new URL("./worker.mjs", import.meta.url), {
    resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 4 },
  });
  index?: IndexStore;
  private legacyPricing?: Pricing;
  get pricing() {
    return this.legacyPricing!;
  }
  cache = new Map<string, Json>();
  refreshAt = 0;
  refresh(selected: string | null, quota = false, force = false) {
    const scan = Date.now() - this.refreshAt >= 2000;
    if (scan || quota) {
      if (scan) this.refreshAt = Date.now();
      this.worker.postMessage({ selected, quota, force, scan });
    }
  }
  data(name: string, args: Json, meta: Json): Json {
    if (name === "usage_thread")
      args = {
        ...args,
        threadId:
          args.threadId ||
          (meta.threadId && meta.thread_id && meta.threadId !== meta.thread_id
            ? null
            : meta.threadId || meta.thread_id) ||
          "",
      };
    if (args.query !== undefined)
      args = { ...args, query: args.query.trim().toLowerCase() };
    if (args.query === "") {
      args = { ...args };
      delete args.query;
    }
    if (args.refresh === false) {
      args = { ...args };
      delete args.refresh;
    }
    const index = this.open();
    this.refresh(
      index
        ?.prepare("SELECT catalogueOnly FROM threads WHERE threadId=?")
        .get(args.threadId || "")?.catalogueOnly
        ? args.threadId
        : null,
      name === "usage_quota",
      args.refresh === true,
    );
    const progress = index?.get("progress");
    if (!index || (!index.get("scan") && progress?.state !== "ready")) {
      const state = (this.failure
        ? {
            ...progress,
            state: "unavailable",
            processed: progress?.processed ?? 0,
            total: progress?.total ?? 0,
            reason: "index-worker-failed",
          }
        : progress) ?? {
        state: this.failure ? "unavailable" : "indexing",
        processed: 0,
        total: 0,
        reason: this.failure ? "index-worker-failed" : null,
      };
      if (name === "usage_quota" && index) return new DataViews(index).quota();
      if (name === "usage_quota")
        return {
          plan: null,
          credits: null,
          availableResets: null,
          windows: [],
          state: "loading",
          reason: null,
          observedAt: null,
        };
      if (name === "usage_summary")
        return {
          totals: {
            tokens: null,
            input: null,
            cached: null,
            output: null,
            cost: 0,
            costIncomplete: false,
            requests: 0,
            tasks: 0,
            outputTps: null,
            ttftMedianMs: null,
            ttftP90Ms: null,
            ttftTurns: 0,
          },
          models: [],
          buckets: [],
          index: state,
        };
      if (name === "usage_tasks")
        return {
          total: 0,
          page: 1,
          pageSize: args.pageSize,
          tasks: [],
          index: state,
        };
      return { [name.slice(6)]: null, index: state, reason: state.reason };
    }
    index.db.exec("BEGIN");
    try {
      const generation = index.get("generation") ?? 0,
        price = index.get("priceVersion"),
        progress = index.get("progress");
      const key = JSON.stringify([
        name,
        args,
        generation,
        price,
        ["usage_summary", "usage_tasks", "usage_quota"].includes(name)
          ? Math.floor(Date.now() / 60000)
          : 0,
      ]);
      if (!this.failure && !args.refresh && this.cache.has(key)) {
        const r = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, r);
        return r.index ? { ...r, index: progress ?? r.index } : r;
      }
      const views = new DataViews(index);
      const result: Json =
        name === "usage_summary"
          ? views.summary(args)
          : name === "usage_tasks"
            ? views.tasks(args)
            : name === "usage_quota"
              ? views.quota()
              : name === "usage_thread"
                ? views.thread(args)
                : name === "usage_turn"
                  ? views.turn(args)
                  : views.tool(args);
      if (this.failure && result.index)
        result.index = {
          ...result.index,
          state: "unavailable",
          reason: "index-worker-failed",
        };
      if (!this.failure) {
        this.cache.set(key, result);
        if (this.cache.size > 32)
          this.cache.delete(this.cache.keys().next().value!);
      }
      return result;
    } finally {
      index.db.exec("COMMIT");
    }
  }
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
    this.refresh(
      index?.needsThread(selected) ? selected : null,
      scope === "global",
      args.refreshQuota,
    );
    if (!index?.get("scan") || index.needsThread(selected))
      return {
        schemaVersion: 1,
        pluginVersion: version,
        scope,
        state: this.failure ? "unavailable" : "collecting",
        message: this.failure ?? "正在读取所选范围的本机用量。",
        quota: scope === "global" ? this.quota() : null,
      };
    this.legacyPricing ??= new (await import("./pricing.js")).Pricing();
    index.db.exec("BEGIN");
    try {
      if (this.pricing.version !== index.get("priceVersion"))
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
