import { Worker } from "node:worker_threads";
import { stableJson, version, type Json } from "./common.js";
class IndexWorker {
  worker = new Worker(new URL("./worker.mjs", import.meta.url));
  usedAt = Date.now();
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
      this.usedAt = Date.now();
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
    this.usedAt = Date.now();
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
  cache = new Map<string, { value: Json; at: number; bytes: number }>();
  sweep = setInterval(() => this.prune(), 30000).unref();
  historyPending?: Promise<Json>;
  prune() {
    const now = Date.now();
    for (const [key, worker] of this.workers)
      if (!worker.pending.size && now - worker.usedAt >= 120000) {
        worker.stop();
        this.workers.delete(key);
      }
    for (const [key, cached] of this.cache)
      if (now - cached.at >= 30000) this.cache.delete(key);
  }
  index(key: string) {
    this.prune();
    let worker = this.workers.get(key);
    if (worker?.failure) {
      worker.stop();
      this.workers.delete(key);
      worker = undefined;
    }
    if (!worker) {
      // Retain a small set of active selections without cancelling another panel.
      if (this.workers.size >= 4) {
        const idle = [...this.workers]
          .filter(([, w]) => !w.pending.size)
          .sort(([, a], [, b]) => a.usedAt - b.usedAt)[0];
        if (!idle) throw new Error("Too many usage indexes");
        idle[1].stop();
        this.workers.delete(idle[0]);
      }
      worker = new IndexWorker();
      this.workers.set(key, worker);
    }
    worker.usedAt = Date.now();
    return worker;
  }
  async history() {
    if (this.historyPending) return this.historyPending;
    const worker = this.index("history");
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
    const worker = this.index(key);
    const cached = this.cache.get(requestKey);
    if (cached && Date.now() - cached.at < 4000) return cached.value;
    let pending = this.inflight.get(requestKey);
    if (!pending) {
      if (this.inflight.size >= 8) throw new Error("Too many usage requests");
      pending = worker
        .call({ args, meta, scope })
        .then((value) => {
          this.cache.delete(requestKey);
          const bytes = Buffer.byteLength(JSON.stringify(value));
          // Retain at most 8 MiB, or one larger result so a collecting poll can
          // retrieve it. Count alone allows many large expanded-turn payloads.
          let total = [...this.cache.values()].reduce((n, v) => n + v.bytes, 0);
          while (
            this.cache.size &&
            (this.cache.size >= 20 || total + bytes > 8 * 1024 * 1024)
          ) {
            const oldest = this.cache.keys().next().value!;
            total -= this.cache.get(oldest)!.bytes;
            this.cache.delete(oldest);
          }
          this.cache.set(requestKey, { value, at: Date.now(), bytes });
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
    clearInterval(this.sweep);
    for (const worker of this.workers.values()) worker.stop();
    this.workers.clear();
    this.cache.clear();
  }
}
