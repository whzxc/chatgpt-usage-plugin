import { copy, variant } from "../../design/scenes/usage";
import {
  summaryData,
  tasksData,
  quotaData,
  threadData,
  turnData,
  toolData,
  readyIndex,
} from "./data";
export const fixture =
  new URLSearchParams(location.search).get("fixture") || "";
const form = fixture.replace(
  /^cup-(overview|task|turn|tool-dialog-surface|tool-dialog)-/,
  "",
);
function pending(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal?.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}
export async function callData<T>(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  if (fixture.endsWith("-stale")) throw Error("更新失败");
  if (fixture === "cup-overview-refreshing") return pending(signal);
  if (name === "usage_summary") return summaryData(form) as T;
  if (name === "usage_tasks") {
    const data = tasksData(form);
    if (args.query) {
      data.tasks = data.tasks.filter((t) =>
        t.title?.includes(String(args.query)),
      );
      data.total = data.tasks.length;
    }
    if (args.sort === "cost" || args.sort === "tokens")
      data.tasks.sort(
        (a, b) =>
          (b[args.sort as "cost" | "tokens"] ?? 0) -
          (a[args.sort as "cost" | "tokens"] ?? 0),
      );
    return data as T;
  }
  if (name === "usage_quota") return quotaData(form) as T;
  if (name === "usage_thread") return threadData(form) as T;
  if (name === "usage_tool") {
    if (form === "loading") return pending(signal);
    if (form === "error") throw Error("无法读取工具调用");
    return toolData(form) as T;
  }
  if (name === "usage_turn") {
    if (fixture === "cup-turn-loading-pending") return pending(signal);
    if (fixture === "cup-turn-loading-failure") throw Error("无法读取轮次");
    if (args.text) {
      if (fixture.endsWith("narrative-loading")) return pending(signal);
      if (fixture.endsWith("narrative-error")) throw Error("无法读取全文");
      return {
        index: readyIndex,
        reason: null,
        turn: null,
        text:
          (args.text as { kind: string }).kind === "reply"
            ? copy.reply
            : copy.reasoning,
      } as T;
    }
    return {
      index: readyIndex,
      reason: null,
      turn: turnData(variant(form)),
    } as T;
  }
  throw Error(`Unknown design tool: ${name}`);
}
const listeners = new Set<(result: unknown) => void>();
export function onInitialResult(fn: (result: unknown) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function initialize() {
  if (fixture === "cup-entry-loading") return pending();
  if (fixture === "cup-entry-failure")
    listeners.forEach((fn) => fn({ _meta: { usageError: copy.failure } }));
  else
    listeners.forEach((fn) =>
      fn({
        _meta: {
          usageOverview: {
            range: "7d",
            summary: summaryData(form),
            tasks: tasksData(form),
            quota: quotaData(form),
          },
        },
      }),
    );
}
export function onTeardown(_listener: () => void) {}
