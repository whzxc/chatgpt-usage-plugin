import { trend, costTrend, modelNames } from "./usage";
import { compact, money } from "../support/format";
export const trendTip = (i: number) =>
  modelNames.map((label, j) => ({
    label,
    value: `${compact(trend[i].values[j])} · ${money(costTrend[i].values[j])}`,
  }));
export const tooltipExample = { title: trend[4].label, rows: trendTip(4) };
