import { useEffect, useMemo, useRef, useState } from "react";
import { callData } from "../app/bridge";
import { compact, duration, integer, money } from "../shared/format";
import { usePoll } from "../shared/poll";
import { Failure, Status } from "../shared/status";
import type { Turn, TurnData, TurnSummary } from "../shared/types";
import { Chevron } from "../components/ui/Icons";
import { Waterfall } from "./waterfall";
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
    if (pending.current) return false;
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
      return true;
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
      return false;
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
  const timeline = useMemo(() => {
    let requestCount = 0;
    return (data?.timeline ?? []).filter((row) => {
      if (row.kind === "request") requestCount++;
      return requestCount <= shown;
    });
  }, [data?.timeline, shown]);
  const visibleRequests = timeline.filter((r) => r.kind === "request").length,
    remaining = Math.max(0, summary.requests - visibleRequests);
  return (
    <article
      className={"turn" + (open ? " is-open" : "")}
      id={"turn-" + summary.turnId}
    >
      <TurnHeader
        summary={summary}
        open={open}
        toggle={toggle}
        prompt={open && data ? data.prompt : undefined}
      />
      {open && (
        <div className="turn-body" id={"body-" + summary.turnId}>
          {error && <Failure error={error} retry={() => void load(true)} />}
          {!data && !error && <Status message="正在读取轮次" />}
          {data && (
            <>
              <Waterfall
                timeline={timeline}
                turn={data}
                summary={summary}
                openTool={setTool}
                threadId={threadId}
                busy={busy}
                complete={
                  timeline.length === data.timeline.length &&
                  data.nextOffset === null
                }
                reveal={async (requests) => {
                  const target = Math.max(shown, requests);
                  setShown(target);
                  return load(false, target);
                }}
              />
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

export function TurnHeader({
  summary,
  open = false,
  toggle,
  prompt,
}: {
  summary: TurnSummary;
  open?: boolean;
  toggle: () => void;
  prompt?: string | null;
}) {
  const status =
    summary.status === "running-at-last-event"
      ? "进行中"
      : summary.status === "interrupted"
        ? "已中断"
        : summary.status === "failed"
          ? "失败"
          : "已完成";
  return (
    <button
      className="turn-head"
      aria-expanded={open}
      aria-controls={"body-" + summary.turnId}
      onClick={toggle}
    >
      <span className="turn-no">
        {String(summary.sequence).padStart(2, "0")}
      </span>
      <span className="turn-main">
        <span className="turn-prompt">
          <span>
            {prompt ||
              summary.prompt ||
              (summary.scheduled ? "定时任务" : "未提供文字请求")}
          </span>
          <span className={open ? "is-open" : undefined}>
            <Chevron next />
          </span>
        </span>
        {!open && (
          <span className="turn-meta">
            {duration(summary.durationMs)} · {integer(summary.requests)} 次请求
            · TTFT {duration(summary.ttftMs)}
            {summary.compacted ? " · 压缩上下文" : ""}
            {summary.serviceTier === "fast" ||
            summary.serviceTier === "priority"
              ? " · Fast"
              : ""}
          </span>
        )}
      </span>
      <span className="turn-cost">
        <span
          className={`turn-state ${summary.status === "failed" ? "failed" : ""}`}
        >
          {status}
        </span>
        {!open && (
          <small>
            {money(summary.cost)} · {compact(summary.tokens)}
          </small>
        )}
      </span>
    </button>
  );
}
