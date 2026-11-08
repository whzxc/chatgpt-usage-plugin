import { history, variant, summaryMetrics, taskData } from "./usage";
export const overviewFrames = [
  "ready",
  "indexing",
  "unavailable",
  "empty",
  "stale",
  "unpriced",
] as const;
export function overviewScene(name: string) {
  const empty = name === "empty",
    unknown = name === "unpriced";
  const records = empty
    ? []
    : unknown
      ? history.map((h) => ({ ...h, turn: variant("unknown") }))
      : history;
  return {
    indexing: name === "indexing",
    unavailable: name === "unavailable",
    empty,
    unknown,
    stale: name === "stale",
    metrics: summaryMetrics(records),
    tasks: taskData(records),
    processed: history.length / 3,
    total: history.length,
  };
}
export const usageSummaryExamples = [
  { name: "ready", props: { items: summaryMetrics(history) } },
  {
    name: "refreshing",
    props: { items: summaryMetrics(history), disabled: true },
  },
  {
    name: "indexing",
    props: {
      loading: true,
      processed: history.length / 3,
      total: history.length,
    },
  },
  { name: "unavailable", props: { error: true } },
];
