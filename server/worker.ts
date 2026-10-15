import { parentPort } from "node:worker_threads";
import { IndexStore } from "./index-store.js";
import { Quota } from "./quota.js";
import { Pricing } from "./pricing.js";
import type { Json } from "./common.js";
const index = new IndexStore(),
  quota = new Quota(index),
  pricing = new Pricing();
let running = false,
  checked = 0;
const selections = new Set<string | null>();
parentPort!.on("message", (request: Json) => {
  if (request.stop) {
    quota.stop();
    parentPort!.postMessage({ stopped: true });
    return;
  }
  if (request.quota) quota.refresh(request.force === true);
  pricing.refresh();
  if (request.selected || Date.now() - checked >= 3000)
    selections.add(request.selected ?? null);
  if (!running) void refresh();
});
async function refresh() {
  running = true;
  try {
    for (const selected of selections) {
      selections.delete(selected);
      if (await index.refresh(selected)) checked = Date.now();
    }
    parentPort!.postMessage({ ready: true });
  } catch (error) {
    parentPort!.postMessage({ error: (error as Error).message });
  } finally {
    running = false;
  }
}
