import { Worker } from "node:worker_threads";
import { stableJson, version, type Json } from "./common.js";
class IndexWorker {
  worker = new Worker(new URL("./worker.mjs", import.meta.url));
  failure?: Error;
  sequence = 0;
  pending = new Map<
    number,
    { resolve: (v: Json) => void; reject: (e: Error) => void }
  >();
  constructor() {
    this.worker.on("message", (m) => {
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.error) p.reject(new Error(m.error));
      else p.resolve(m.value);
    });
    this.worker.on("error", (e) =>
      this.fail(e instanceof Error ? e : new Error(String(e))),
    );
    this.worker.on("exit", () => this.fail(new Error("Usage index stopped")));
  }
  fail(error: Error) {
    this.failure = error;
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
  call(args: Json) {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise<Json>((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...args, id });
    });
  }
  stop() {
    void this.worker.terminate();
    this.fail(new Error("Usage index closed"));
  }
}
export class UsageService {
  workers = new Map<string, IndexWorker>();
  inflight = new Map<string, Promise<Json>>();
  cache = new Map<string, { value: Json; at: number }>();
  historyPending?: Promise<Json>;
  history() {
    if (this.historyPending) return this.historyPending;
    let worker = this.workers.get("history");
    if (worker?.failure) {
      worker.stop();
      this.workers.delete("history");
      worker = undefined;
    }
    if (!worker) {
      worker = new IndexWorker();
      this.workers.set("history", worker);
    }
    return (this.historyPending = worker.call({ history: true }).finally(() => {
      this.historyPending = undefined;
    }));
  }
  async query(args: Json, meta: Json, scope: string): Promise<Json> {
    const selected =
      scope === "thread"
        ? args.threadId ||
          (meta.threadId && meta.thread_id && meta.threadId !== meta.thread_id
            ? null
            : meta.threadId || meta.thread_id)
        : null;
    const key = selected ? `thread:${selected}` : `period:${args.days ?? 7}`,
      requestKey = stableJson({ args, meta, scope });
    let worker = this.workers.get(key);
    if (worker?.failure) {
      worker.stop();
      this.workers.delete(key);
      worker = undefined;
    }
    if (!worker) {
      if (selected)
        for (const [k, w] of this.workers)
          if (k.startsWith("thread:")) {
            w.stop();
            this.workers.delete(k);
            this.cache.clear();
          }
      worker = new IndexWorker();
      this.workers.set(key, worker);
    }
    const cached = this.cache.get(requestKey);
    if (cached && Date.now() - cached.at < 4000) return cached.value;
    let pending = this.inflight.get(requestKey);
    if (!pending) {
      if (this.inflight.size >= 8) throw new Error("Too many usage requests");
      pending = worker
        .call({ args, meta, scope })
        .then((value) => {
          if (this.cache.size >= 20)
            this.cache.delete(this.cache.keys().next().value!);
          this.cache.set(requestKey, { value, at: Date.now() });
          return value;
        })
        .finally(() => this.inflight.delete(requestKey));
      this.inflight.set(requestKey, pending);
    }
    // Tools remain responsive during cold indexing; the panel polls collecting views.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<Json>((resolve) => {
          timer = setTimeout(
            () =>
              resolve(
                cached
                  ? { ...cached.value, refreshing: true }
                  : {
                      schemaVersion: 1,
                      pluginVersion: version,
                      scope,
                      state: "collecting",
                      message: "正在读取所选范围的本机用量。",
                    },
              ),
            100,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  stop() {
    for (const worker of this.workers.values()) worker.stop();
  }
}
