import { copy, history, summaryMetrics, primaryTurns } from "../scenes/usage";
export const taskFrames = [
  "ready",
  "empty",
  "indexing",
  "unavailable",
  "stale",
  "long-title",
] as const;
export function taskScene(name: string) {
  return {
    title: name === "long-title" ? copy.longTitle : copy.task,
    empty: name === "empty",
    indexing: name === "indexing",
    unavailable: name === "unavailable",
    stale: name === "stale",
    metrics: summaryMetrics(history.filter((h) => h.task === 0)).filter(
      (_, i) => [0, 1, 4, 5].includes(i),
    ),
    turns: [...primaryTurns].reverse(),
    processed: history.length / 3,
    total: history.length,
    emptyMessage: copy.noTask,
  };
}
