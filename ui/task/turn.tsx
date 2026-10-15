import { useEffect, useRef, useState } from "react";
import { callData } from "../app/bridge";
import {
  bytes,
  clock,
  compact,
  duration,
  integer,
  money,
  percent,
  ttft,
  when,
} from "../shared/format";
import { usePoll } from "../shared/poll";
import { Failure } from "../shared/status";
import type { TimelineRow, Turn, TurnData, TurnSummary } from "../shared/types";
import { ToolDialog } from "./tool-dialog";

export function TurnRow({
  threadId,
  summary,
  open,
  toggle,
}: {
  threadId: string;
  summary: TurnSummary;
  open: boolean;
  toggle: () => void;
}) {
  const [data, setData] = useState<Turn>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [shown, setShown] = useState(9);
  const [tool, setTool] = useState<string>();
  const pending = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = async (reset = false, target = shown) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      let result = reset ? undefined : data;
      // Include the narration after the last visible request, stopping at the next.
      while (
        !result ||
        (result.nextOffset !== null &&
          result.timeline.filter((r) => r.kind === "request").length <= target)
      ) {
        const next = await callData<TurnData>("usage_turn", {
          threadId,
          turnId: summary.turnId,
          offset: result?.nextOffset ?? 0,
          limit: 100,
        });
        if (!next.turn) throw Error(next.reason || "无法读取轮次。");
        if (next.reason) throw Error(next.reason);
        result = {
          ...next.turn,
          timeline: [...(result?.timeline ?? []), ...next.turn.timeline],
          offset: 0,
        };
        if (result.nextOffset === null) break;
      }
      if (alive.current) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(String(e));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (open) void load(true);
  }, [open, summary.status]);
  usePoll(
    () => load(true),
    3000,
    open && summary.status === "running-at-last-event",
  );
  const status =
    summary.status === "running-at-last-event"
      ? "进行中"
      : summary.status === "interrupted"
        ? "已中断"
        : summary.status === "failed"
          ? "失败"
          : null;
  let requestCount = 0;
  const timeline = (data?.timeline ?? []).filter((row) => {
    if (row.kind === "request") requestCount++;
    return requestCount <= shown;
  });
  const visibleRequests = timeline.filter((r) => r.kind === "request").length,
    remaining = Math.max(0, summary.requests - visibleRequests);
  const lastRequest = data?.timeline.filter((r) => r.kind === "request").at(-1);
  const chunks = Array.from(
    { length: Math.ceil(timeline.length / 100) },
    (_, i) => timeline.slice(i * 100, (i + 1) * 100),
  );
  return (
    <article
      className={"turn" + (open ? " is-open" : "")}
      id={"turn-" + summary.turnId}
    >
      <button
        className="turn-head"
        aria-expanded={open}
        aria-controls={"body-" + summary.turnId}
        onClick={toggle}
      >
        <span className="turn-no">{summary.sequence}</span>
        <span className="turn-main">
          <span className="turn-prompt">
            {open && data ? data.prompt : summary.prompt}
          </span>
          <span className="turn-meta">
            <span>{when(summary.startedAt)}</span>
            <span>{duration(summary.durationMs)}</span>
            <span>{integer(summary.requests)} 次请求</span>
            <span>首 token {ttft(summary.ttftMs)}</span>
            <span>
              {summary.outputTps === null
                ? "—"
                : summary.outputTps.toFixed(1) + " tok/s"}
            </span>
            {summary.compacted && <span className="flag">压缩上下文</span>}
            {status && <span>{status}</span>}
          </span>
        </span>
        <span className="turn-cost">
          <b>{money(summary.cost)}</b>
          <small>{compact(summary.tokens)}</small>
        </span>
      </button>
      {open && (
        <div className="turn-body" id={"body-" + summary.turnId}>
          {error && <Failure error={error} retry={() => void load(true)} />}
          {!data && !error && <p className="turn-meta">正在读取轮次。</p>}
          {data && (
            <>
              <Metrics turn={data} />
              <div className="steps-head">
                <h3>请求 {summary.requests} 次</h3>
                <span>按时间顺序</span>
              </div>
              <div className="steps">
                {chunks.map((chunk, index) => (
                  <div className="steps-chunk" key={index}>
                    {chunk.map((row, i) => (
                      <Timeline
                        key={row.kind + ("id" in row ? row.id : i)}
                        row={row}
                        final={
                          row.kind === "request" &&
                          summary.status !== "running-at-last-event" &&
                          row === lastRequest &&
                          data.nextOffset === null
                        }
                        openTool={setTool}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {(remaining > 0 || data.nextOffset !== null) && (
                <button
                  className="text-btn more"
                  disabled={busy}
                  onClick={() => {
                    const target =
                      summary.requests <= 200 ? summary.requests : shown + 100;
                    setShown(target);
                    void load(false, target);
                  }}
                >
                  {busy ? "正在读取轮次。" : `显示其余 ${remaining} 次请求`}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {tool && (
        <ToolDialog
          threadId={threadId}
          toolId={tool}
          close={() => setTool(undefined)}
        />
      )}
    </article>
  );
}
function Metrics({ turn }: { turn: Turn }) {
  const m = turn.metrics;
  const rows = [
    ["估算费用", money(m.cost)],
    ["Tokens", compact(m.tokens)],
    ["缓存命中", m.cachePercent === null ? "—" : percent(m.cachePercent)],
    ["输出", compact(m.output)],
    ["用时", duration(m.durationMs)],
    ["首个 token", ttft(m.ttftMs)],
    [
      "输出速度",
      m.outputTps === null ? "—" : m.outputTps.toFixed(1) + " tok/s",
    ],
    [
      "上下文",
      compact(m.context.start) +
        " → " +
        compact(m.context.end) +
        (m.context.limit && m.context.end !== null
          ? "（" + Math.round((m.context.end * 100) / m.context.limit) + "%）"
          : ""),
    ],
  ];
  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function ToolButton({
  tool,
  openTool,
}: {
  tool: { toolId: string; name: string | null; preview: string | null };
  openTool: (id: string) => void;
}) {
  return (
    <button className="tool" onClick={() => openTool(tool.toolId)}>
      <b className="tool-name">{tool.name}</b>
      <span className="cmd">{tool.preview}</span>
    </button>
  );
}
function Timeline({
  row,
  final,
  openTool,
}: {
  row: TimelineRow;
  final: boolean;
  openTool: (id: string) => void;
}) {
  if (row.kind === "tool")
    return (
      <div className="step">
        <time>{clock(row.at)}</time>
        <div>
          <ToolButton tool={row} openTool={openTool} />
          <span className="step-facts">返回 {bytes(row.outputBytes)}</span>
        </div>
      </div>
    );
  if (row.kind !== "request")
    return (
      <div className="note">
        <time>{clock(row.at)}</time>
        <p>
          <span className="kind">
            {row.kind === "reasoning"
              ? "思考 " + duration(row.durationMs)
              : "回复"}
          </span>
          {row.summary}
        </p>
      </div>
    );
  const outputBytes = row.tools.reduce<number | null>(
    (n, t) => (n === null || t.outputBytes === null ? null : n + t.outputBytes),
    0,
  );
  return (
    <div className={"step" + (final ? " final" : "")}>
      <time>{clock(row.at)}</time>
      <div>
        {row.tools.length ? (
          <div className="request-tools">
            {row.tools.map((t) => (
              <ToolButton key={t.toolId} tool={t} openTool={openTool} />
            ))}
          </div>
        ) : (
          <span className="what">{final ? "最终回复" : "请求"}</span>
        )}
        <span className="step-facts">
          上下文 {compact(row.input)}，输出 {compact(row.output)}
          {row.tools.length > 0 ? "，返回 " + bytes(outputBytes) : ""}
        </span>
      </div>
      <span className="cost">{money(row.cost)}</span>
    </div>
  );
}
