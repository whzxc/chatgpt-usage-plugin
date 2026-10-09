import { parentPort } from "node:worker_threads";
import { Collector } from "./collector.js";
import { Pricing } from "./pricing.js";
import { Views } from "./views.js";
import { sortedValues, type Json } from "./common.js";
const collector = new Collector(),
  pricing = new Pricing(),
  views = new Views(collector, pricing);
// One collector per worker. Refreshes never block stdio or another panel's index.
let queue = Promise.resolve();
parentPort!.on("message", (request: Json) => {
  queue = queue.then(async () => {
    try {
      pricing.refresh();
      if (request.history) {
        await collector.refresh(32, null);
        const rows = [...collector.threads.values()].flatMap((t) =>
          sortedValues(t.modern ? t.responses : t.legacy),
        );
        parentPort!.postMessage({
          id: request.id,
          value: pricing.history(
            rows,
            collector.issues.size > 0 ||
              [...collector.threads.values()].some((t) => t.issues.size > 0),
          ),
        });
        return;
      }
      const { args, meta, scope } = request;
      const selected =
        scope === "thread"
          ? args.threadId ||
            (meta.threadId && meta.thread_id && meta.threadId !== meta.thread_id
              ? null
              : meta.threadId || meta.thread_id)
          : null;
      await collector.refresh(
        selected ? null : (args.days ?? 7),
        selected ?? null,
      );
      let value: Json;
      if (scope === "thread" && args.toolId) {
        try {
          value = {
            schemaVersion: 1,
            scope,
            state: "ready",
            toolDetail: views.toolDetail({ ...args, threadId: selected }),
          };
        } catch (error) {
          value = {
            schemaVersion: 1,
            scope,
            state: "unavailable",
            message: (error as Error).message,
          };
        }
      } else value = views.snapshot(args, meta, scope);
      parentPort!.postMessage({ id: request.id, value });
    } catch (error) {
      parentPort!.postMessage({
        id: request.id,
        error: (error as Error).message,
      });
    }
  });
});
