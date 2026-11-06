import type { Turn, TurnSummary } from "../shared/types";
import { compact, duration, integer, money, percent } from "../shared/format";
import { MetricGrid } from "../components/ui/controls";
export function WaterfallHead({
  turn,
  summary,
}: {
  turn: Turn;
  summary: TurnSummary;
}) {
  const m = turn.metrics;
  const tps =
    summary.status === "failed" || summary.status === "running-at-last-event"
      ? null
      : m.outputTps;
  return (
    <>
      <MetricGrid
        small
        items={[
          { label: "用时", value: duration(m.durationMs) },
          { label: "估算费用", value: money(m.cost) },
          { label: "Tokens", value: compact(m.tokens) },
          { label: "模型调用", value: integer(turn.requestTotal) },
          { label: "工具调用", value: integer(turn.calls.tools) },
          { label: "失败", value: integer(turn.calls.failed) },
        ]}
      />
      <div className="wf-secondary-stats">
        {[
          turn.calls.model || "—",
          `TTFT ${duration(m.ttftMs)}`,
          `${tps === null ? "—" : tps.toFixed(1)} tok/s`,
          `缓存 ${percent(m.cachePercent)}`,
          `输出 ${compact(m.output)}`,
          `上下文 ${compact(m.context.start)} → ${compact(m.context.end)} / ${compact(m.context.limit)}`,
        ].map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
    </>
  );
}
