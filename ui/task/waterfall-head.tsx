import type { Turn, TurnSummary } from "../shared/types";
import {
  compact,
  duration,
  integer,
  money,
  percent,
  ttft,
} from "../shared/format";
import { TraceIcon } from "../shared/icons";

export function WaterfallHead({
  turn,
  summary,
  allOpen,
  toggleAll,
}: {
  turn: Turn;
  summary: TurnSummary;
  allOpen: boolean;
  toggleAll: () => void;
}) {
  const m = turn.metrics;
  const state =
    summary.status === "running-at-last-event"
      ? "running"
      : summary.status === "failed"
        ? "failed"
        : summary.status === "interrupted"
          ? "interrupted"
          : "done";
  const labels = {
    running: "进行中",
    failed: "失败",
    interrupted: "已中断",
    done: "已完成",
  };
  const stats = [
    ["用时", duration(m.durationMs)],
    ["估算费用", money(m.cost)],
    ["Tokens", compact(m.tokens)],
    ["模型调用", integer(turn.requestTotal)],
    ["工具调用", integer(turn.calls.tools)],
    ["失败", integer(turn.calls.failed)],
  ];
  return (
    <>
      <div className="wf-card-head">
        <span className="wf-icon-box wf-icon-model">
          <TraceIcon />
        </span>
        <strong>调用</strong>
        <span className="wf-prompt" title={turn.prompt || undefined}>
          {turn.prompt || `第 ${summary.sequence} 轮`}
        </span>
        <span className={`wf-status wf-status-${state}`}>{labels[state]}</span>
        <button className="wf-toggle-all" type="button" onClick={toggleAll}>
          {allOpen ? "全部折叠" : "全部展开"}
        </button>
      </div>
      <dl className="wf-stats">
        {stats.map(([label, value], i) => (
          <div
            key={label}
            className={
              i === 5 && turn.calls.failed > 0 ? "wf-danger" : undefined
            }
          >
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="wf-secondary-stats">
        {turn.calls.model && <span>{turn.calls.model}</span>}
        <span>
          TTFT <b>{ttft(m.ttftMs)}</b>
        </span>
        <span>
          TPS <b>{m.outputTps === null ? "—" : m.outputTps.toFixed(1)} tok/s</b>
        </span>
        <span>
          缓存 <b>{m.cachePercent === null ? "—" : percent(m.cachePercent)}</b>
        </span>
        <span>
          输出 <b>{compact(m.output)}</b>
        </span>
        <span>
          上下文{" "}
          <b>
            {compact(m.context.start)} → {compact(m.context.end)}
            {m.context.limit && m.context.end !== null
              ? `（${Math.round((m.context.end * 100) / m.context.limit)}%）`
              : ""}
          </b>
        </span>
      </div>
    </>
  );
}
