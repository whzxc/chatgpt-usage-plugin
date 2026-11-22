import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import type { TimelineRow, Turn, TurnSummary } from "../../shared/types";
import { Status } from "../../shared/status";
import { Button } from "../../components/ui/controls";
import { traceSpans, traceWindow, expandedByChoice } from "../waterfall-model";
import type { TraceSpan } from "../waterfall-model";
import { useWaterfallClock } from "../waterfall-clock";
import "../waterfall.css";
import { WaterfallHead } from "../waterfall-head";
import { Minimap, type JumpTarget } from "./minimap";
import { TraceRow, type VisibleSpan } from "./row";
import { RequestDetailsPanel } from "./request-details";

export function Waterfall({
  timeline,
  turn,
  summary,
  openTool,
  threadId,
  busy,
  complete,
  reveal,
}: {
  timeline: TimelineRow[];
  turn: Turn;
  summary: TurnSummary;
  openTool: (id: string) => void;
  threadId: string;
  busy: boolean;
  complete: boolean;
  reveal: (requests: number) => Promise<boolean>;
}) {
  const detailsId = useId(),
    running = summary.status === "running-at-last-event";
  const spans = useMemo(
    () => traceSpans(timeline, running),
    [timeline, running],
  );
  const slowest = turn.slowestCall
    ? `${turn.slowestCall.kind}:${turn.slowestCall.id}`
    : null;
  const [choices, setChoices] = useState<Map<string, boolean>>(() => new Map());
  const [all, setAll] = useState<boolean>();
  const collapsed = useMemo(
    () =>
      new Set(
        spans
          .filter((span) => !expandedByChoice(span, slowest, choices, all))
          .map((span) => span.id),
      ),
    [spans, slowest, choices, all],
  );
  const allOpen = spans
    .filter((span) => span.children.length)
    .every((span) => !collapsed.has(span.id));
  const [details, setDetails] = useState<string>();
  const [active, setActive] = useState<string>();
  const [jump, setJump] = useState<{ id: string; revealing: boolean }>();
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const rows = useMemo<VisibleSpan[]>(
    () =>
      spans.flatMap((span, i) => [
        { span, position: i + 1, size: spans.length },
        ...(!collapsed.has(span.id)
          ? span.children.map((child, j) => ({
              span: child,
              parent: span,
              position: j + 1,
              size: span.children.length,
            }))
          : []),
      ]),
    [spans, collapsed],
  );
  const rowIndex = useMemo(
    () => new Map(rows.map((row, i) => [row.span.id, i])),
    [rows],
  );
  const focusId = active && rowIndex.has(active) ? active : rows[0]?.span.id;
  const origin =
    summary.startedAt !== null && summary.startedAt > 0
      ? summary.startedAt
      : null;
  const intervals = useMemo(
    () =>
      rows.map(({ span }) => traceWindow(span, origin, collapsed.has(span.id))),
    [rows, origin, collapsed],
  );
  const end = turn.overview?.durationMs ?? summary.durationMs ?? 1000;
  const { root, axis, header, grid } = useWaterfallClock(
    origin,
    end,
    running,
    intervals,
    complete,
  );
  const focus = useCallback((id: string) => {
    setActive(id);
    nodes.current.get(id)?.focus();
  }, []);
  const register = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);
  const toggle = useCallback(
    (span: TraceSpan) => {
      focus(span.id);
      setChoices((old) => new Map(old).set(span.id, collapsed.has(span.id)));
    },
    [focus, collapsed],
  );
  const activate = useCallback(
    (span: TraceSpan) => {
      focus(span.id);
      if (span.tool) openTool(span.tool.toolId);
      if (span.request)
        setDetails((id) => (id === span.id ? undefined : span.id));
    },
    [focus, openTool],
  );
  const keyDown = (event: KeyboardEvent) => {
    if (
      (event.target as HTMLElement).closest("button") &&
      event.key !== "Escape"
    )
      return;
    const id = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-wf-id]",
    )?.dataset.wfId;
    const index = id === undefined ? undefined : rowIndex.get(id);
    if (index === undefined) return;
    const { span, parent } = rows[index];
    switch (event.key) {
      case "ArrowDown":
        focus(rows[Math.min(rows.length - 1, index + 1)].span.id);
        break;
      case "ArrowUp":
        focus(rows[Math.max(0, index - 1)].span.id);
        break;
      case "Home":
        focus(rows[0].span.id);
        break;
      case "End":
        focus(rows.at(-1)!.span.id);
        break;
      case "ArrowRight":
        if (span.children.length) {
          if (collapsed.has(span.id)) toggle(span);
          else focus(span.children[0].id);
        } else if (span.request) setDetails(span.id);
        break;
      case "ArrowLeft":
        if (details === span.id) setDetails(undefined);
        else if (span.children.length && !collapsed.has(span.id)) toggle(span);
        else if (parent) focus(parent.id);
        break;
      case "Enter":
      case " ":
        activate(span);
        break;
      case "Escape":
        focus(span.id);
        setDetails(undefined);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  const navigate = async (target: JumpTarget) => {
    const revealing = !spans.some(
      (span) =>
        span.id === target.id ||
        span.children.some((child) => child.id === target.id),
    );
    const request = { id: target.id, revealing };
    setJump(request);
    if (revealing) {
      const loaded = await reveal(target.requests).catch(() => false);
      setJump((current) =>
        current === request
          ? loaded
            ? { ...request, revealing: false }
            : undefined
          : current,
      );
    }
  };
  useEffect(() => {
    if (!jump || jump.revealing) return;
    const parent = spans.find((span) =>
      span.children.some((child) => child.id === jump.id),
    );
    if (parent && collapsed.has(parent.id)) {
      setChoices((old) => new Map(old).set(parent.id, true));
      return;
    }
    const node = nodes.current.get(jump.id);
    if (node) {
      setActive(jump.id);
      node.focus({ preventScroll: true });
      node.scrollIntoView({ block: "start", behavior: "instant" });
    }
    setJump((current) => (current === jump ? undefined : current));
  }, [jump, spans, collapsed]);
  return (
    <div className="waterfall-container">
      <WaterfallHead turn={turn} summary={summary} />
      <div className="waterfall" ref={root}>
        <div
          data-adg-id="waterfall-sticky-header"
          className="wf-sticky"
          ref={header}
        >
          <div className="section-head">
            <h2>调用时间线</h2>
            <Button
              label={allOpen ? "全部折叠" : "全部展开"}
              onClick={() => {
                setAll(!allOpen);
                setChoices(new Map());
                const parent = spans.find((span) =>
                  span.children.some((child) => child.id === active),
                );
                if (allOpen && parent) setActive(parent.id);
              }}
            />
          </div>
          {turn.overview && (
            <Minimap
              overview={turn.overview}
              busy={busy || !!jump}
              navigate={navigate}
              slowestDuration={
                slowest
                  ? (() => {
                      const call = spans
                        .flatMap((s) => [s, ...s.children])
                        .find((s) => s.id === slowest);
                      return call?.elapsed ?? null;
                    })()
                  : null
              }
            />
          )}
          <div className="wf-heading">
            <span title="时间轴跟随可见行；LLM 耗时为推算。左右键折叠，回车查看详情。">
              调用 · 模型耗时为推算
            </span>
            <div className="wf-axis" ref={axis} />
          </div>
        </div>
        <div className="wf-body">
          <div className="wf-grid" ref={grid} aria-hidden="true" />
          {running && origin !== null && (
            <div className="wf-now-track" aria-hidden="true">
              <i className="wf-now">now</i>
            </div>
          )}
          <div
            role="tree"
            aria-label="轮次调用瀑布时间线"
            onKeyDown={keyDown}
            onFocus={(event) => {
              const id = (event.target as HTMLElement).closest<HTMLElement>(
                "[data-wf-id]",
              )?.dataset.wfId;
              if (id) setActive(id);
            }}
          >
            {spans.map((span) => {
              const groupRows = [
                span,
                ...(!collapsed.has(span.id) ? span.children : []),
              ].map((item) => rows[rowIndex.get(item.id)!]);
              return (
                <div
                  role="none"
                  className={`wf-group${details === span.id ? " has-details" : ""}`}
                  key={span.id}
                >
                  {groupRows.map((row) => (
                    <TraceRow
                      key={row.span.id}
                      row={row}
                      active={focusId === row.span.id}
                      expanded={details === row.span.id}
                      closed={collapsed.has(row.span.id)}
                      slowest={slowest}
                      origin={origin}
                      detailsId={detailsId}
                      register={register}
                      activate={activate}
                      toggle={toggle}
                    />
                  ))}
                  {details === span.id && span.request && (
                    <div className="wf-details-wrap">
                      <RequestDetailsPanel
                        span={span}
                        threadId={threadId}
                        turnId={turn.turnId}
                        id={detailsId}
                        close={() => {
                          setDetails(undefined);
                          focus(span.id);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {running && (
          <p className="wf-hint">尚未记录完成的模型请求暂无独立时间条。</p>
        )}
        {spans.some((s) => s.start === null) && <Status kind="warning" />}
      </div>
    </div>
  );
}
