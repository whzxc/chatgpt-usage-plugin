import { trend, costTrend, modelNames } from "../scenes/usage";
import { compact, money } from "../scenes/format";
export const trendTip = (i: number) =>
  modelNames.map((label, j) => ({
    label,
    value: `${compact(trend[i].values[j])} · ${money(costTrend[i].values[j])}`,
  }));
export const tooltipExample = { title: trend[4].label, rows: trendTip(4) };
