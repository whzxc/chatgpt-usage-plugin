import { summaryMetrics, variant, turnMetrics } from "../scenes/usage";
export const metricExamples = {
  overview: summaryMetrics(),
  unknown: turnMetrics(variant("unknown")),
};
