import { DataViews } from "./data.js";
import { Worker } from "node:worker_threads";
import { IndexStore } from "./index-store.js";
import { type Json } from "./common.js";
export class UsageService {
  worker = new Worker(new URL("./worker.mjs", import.meta.url), {
    resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 4 },
  });
  index?: IndexStore;
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
