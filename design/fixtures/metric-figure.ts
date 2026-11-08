import { summaryMetrics, variant, turnMetrics } from "./usage";
export const metricExamples = {
  overview: summaryMetrics(),
  unknown: turnMetrics(variant("unknown")),
};
