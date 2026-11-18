import { compact, duration, integer, money, percent } from "./format";
import type { Summary } from "./types";

export function summaryFigures(t: Summary["totals"]) {
  return [
    {
      label: "估算费用",
      value: money(t.cost),
      detail: t.costIncomplete ? "部分模型未定价" : "按 API 价格估算",
    },
    {
      label: "Tokens",
      value: compact(t.tokens),
      detail: `输入 ${compact(t.input)} · 输出 ${compact(t.output)}`,
    },
    {
      label: "缓存命中",
      value: percent(
        t.input && t.cached !== null ? (100 * t.cached) / t.input : null,
      ),
      detail: `${compact(t.cached)} 来自缓存`,
    },
    {
      label: "请求",
      value: integer(t.requests),
      detail: `${integer(t.tasks)} 个任务`,
    },
    {
      label: "TPS",
      value: t.outputTps === null ? "—" : t.outputTps.toFixed(1),
      detail: "tok/s · 按整轮用时",
    },
    {
      label: "TTFT",
      value: duration(t.ttftMedianMs),
      detail: `P90 ${duration(t.ttftP90Ms)} · P99 ${duration(t.ttftP99Ms)}`,
    },
  ];
}
