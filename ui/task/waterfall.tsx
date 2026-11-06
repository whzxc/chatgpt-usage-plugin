import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { TimelineRow, Turn, TurnData, TurnSummary } from "../shared/types";
import { compact, duration, money } from "../shared/format";
import { callData } from "../app/bridge";
import { Failure, Status } from "../shared/status";
import { Chevron, TerminalIcon, CloseIcon } from "../components/ui/Icons";
import { Button } from "../components/ui/controls";
import { traceSpans, traceWindow, expandedByChoice } from "./waterfall-model";
import type { TraceSpan } from "./waterfall-model";
import { useWaterfallClock } from "./waterfall-clock";
import { axisTime } from "./waterfall-range";
import "./waterfall.css";
import { WaterfallHead } from "./waterfall-head";

export type VisibleSpan = {
  span: TraceSpan;
  parent?: TraceSpan;
  position: number;
  size: number;
};
type JumpTarget = { id: string; requests: number };
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
  const [jump, setJump] = useState<string>();
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
    setJump(target.id);
    if (
      !spans.some(
        (span) =>
          span.id === target.id ||
          span.children.some((child) => child.id === target.id),
      )
    ) {
      if (!(await reveal(target.requests))) setJump(undefined);
    }
  };
  useEffect(() => {
    if (!jump) return;
    const parent = spans.find((span) =>
      span.children.some((child) => child.id === jump),
    );
    if (parent && collapsed.has(parent.id)) {
      setChoices((old) => new Map(old).set(parent.id, true));
      return;
    }
    const node = nodes.current.get(jump);
    if (node) {
      setActive(jump);
      node.focus({ preventScroll: true });
      node.scrollIntoView({ block: "center", behavior: "instant" });
      setJump(undefined);
    }
  }, [jump, spans, collapsed]);
  return (
    <div className="waterfall-container">
      <WaterfallHead turn={turn} summary={summary} />
      <div className="waterfall" ref={root}>
        <div className="wf-sticky" ref={header}>
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

export function Minimap({
  overview,
  busy,
  navigate,
  slowestDuration = null,
  range,
}: {
  range?: [number, number];
  slowestDuration?: number | null;
  overview: NonNullable<Turn["overview"]>;
  busy: boolean;
  navigate: (target: JumpTarget) => void;
}) {
  const [position, setPosition] = useState(0);
  const peak = Math.max(
    1,
    ...overview.buckets.map((bucket) => bucket.requests + bucket.tools),
  );
  const go = (index: number) => {
    const next = Math.max(0, Math.min(overview.buckets.length - 1, index));
    setPosition((next * overview.durationMs) / overview.buckets.length);
    const target = overview.buckets[next].target;
    if (target) navigate(target);
  };
  return (
    <div className="wf-map-wrap">
      <div className="wf-map-head">
        <span>{`整轮调用密度 · ${duration(overview.durationMs)}`}</span>
        {overview.slowest && (
          <Button
            label={`最慢 ${duration(slowestDuration)}`}
            disabled={busy}
            onClick={() => {
              setPosition(overview.slowest!.at);
              navigate(overview.slowest!.target);
            }}
          />
        )}
      </div>
      <div
        className="wf-map"
        style={
          range
            ? ({
                "--wf-map-start": `${(range[0] / overview.durationMs) * 100}%`,
                "--wf-map-width": `${((range[1] - range[0]) / overview.durationMs) * 100}%`,
              } as CSSProperties)
            : undefined
        }
        role="slider"
        tabIndex={busy ? -1 : 0}
        aria-label="整轮调用密度，左右键定位，回车跳转"
        aria-disabled={busy}
        aria-valuemin={0}
        aria-valuemax={overview.durationMs}
        aria-valuenow={position}
        aria-valuetext={axisTime(position)}
        title="每格为调用次数；起点未知时按记录时间定位。点击跳转，框内为当前可见时间范围"
        onClick={(event) => {
          if (!busy) {
            const rect = event.currentTarget.getBoundingClientRect();
            const fraction = (event.clientX - rect.left) / rect.width;
            if (
              overview.slowest &&
              Math.abs(fraction - overview.slowest.at / overview.durationMs) *
                rect.width <=
                4
            ) {
              setPosition(overview.slowest.at);
              navigate(overview.slowest.target);
            } else go(Math.floor(fraction * overview.buckets.length));
          }
        }}
        onKeyDown={(event) => {
          if (busy) return;
          let next = position;
          if (event.key === "ArrowRight")
            next += overview.durationMs / overview.buckets.length;
          else if (event.key === "ArrowLeft")
            next -= overview.durationMs / overview.buckets.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = overview.durationMs;
          else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            go(
              Math.floor(
                (position / overview.durationMs) * overview.buckets.length,
              ),
            );
            return;
          } else return;
          setPosition(Math.max(0, Math.min(overview.durationMs, next)));
          event.preventDefault();
        }}
      >
        <div className="wf-density" aria-hidden="true">
          {overview.buckets.map((bucket, i) => (
            <span key={i}>
              <i style={{ height: `${(bucket.tools * 100) / peak}%` }} />
              <b style={{ height: `${(bucket.requests * 100) / peak}%` }} />
            </span>
          ))}
        </div>
        <i className="wf-map-window" aria-hidden="true" />
        <i
          className="wf-map-cursor"
          aria-hidden="true"
          style={{ left: `${(position * 100) / overview.durationMs}%` }}
        />
        {overview.slowest && (
          <i
            className="wf-map-slowest"
            aria-hidden="true"
            style={{
              left: `${(overview.slowest.at * 100) / overview.durationMs}%`,
            }}
          />
        )}
      </div>
      <div className="wf-map-foot">
        <span>模型 / 工具调用次数</span>
        <span className="wf-visible-range">
          {`可见 ${duration(range?.[0] ?? 0)}–${duration(range?.[1] ?? overview.durationMs)}`}
        </span>
      </div>
    </div>
  );
}

export const TraceRow = memo(function TraceRow({
  row,
  active,
  expanded,
  closed,
  slowest,
  origin,
  detailsId,
  register,
  activate,
  toggle,
}: {
  row: VisibleSpan;
  active: boolean;
  expanded: boolean;
  closed: boolean;
  slowest: string | null;
  origin: number | null;
  detailsId: string;
  register: (id: string, node: HTMLDivElement | null) => void;
  activate: (span: TraceSpan) => void;
  toggle: (span: TraceSpan) => void;
}) {
  const { span, parent } = row;
  const timing = span.running
    ? "进行中"
    : span.elapsed !== null && span.elapsed < 100
      ? "<0.1s"
      : duration(span.elapsed);
  const metrics = span.request
    ? `${money(span.request.cost)} · ${compact(span.request.tokens)} tokens`
    : "";
  return (
    <div
      role="treeitem"
      aria-level={parent ? 2 : 1}
      aria-posinset={row.position}
      aria-setsize={row.size}
      aria-expanded={
        span.children.length ? !closed : span.request ? expanded : undefined
      }
      aria-describedby={expanded ? detailsId : undefined}
      aria-label={`${span.request ? `请求 #${span.request.sequence}，` : ""}${span.label}，${timing}${metrics ? `，${metrics}` : ""}${span.id === slowest ? "，本轮最慢" : ""}${span.failed ? "，失败" : ""}`}
      tabIndex={active ? 0 : -1}
      data-wf-id={span.id}
      ref={(node) => register(span.id, node)}
      className={`wf-item wf-${span.kind}${span.failed || span.children.some((child) => child.failed) ? " wf-failed" : ""}${parent ? " wf-child" : ""}${span.id === slowest ? " wf-is-slowest" : ""}`}
    >
      <div className="wf-row" onClick={() => activate(span)}>
        <div className="wf-name">
          <span className="wf-fold-slot">
            {span.request && (
              <button
                type="button"
                tabIndex={-1}
                className={`wf-fold${closed ? "" : " is-expanded"}`}
                aria-label={closed ? "展开子调用" : "折叠子调用"}
                onClick={(event) => {
                  event.stopPropagation();
                  if (span.children.length) toggle(span);
                  else activate(span);
                }}
              >
                <Chevron next />
              </button>
            )}
          </span>
          {span.tool && <TerminalIcon />}
          <div className="wf-labels">
            <div className="wf-label" title={span.label}>
              {span.label}
            </div>
            <div className="wf-summary">
              {span.request
                ? `#${span.request.sequence} · ${span.children.length} 次工具调用${span.children.some((c) => c.failed) ? " · 含失败" : ""}`
                : `工具调用${span.failed ? " · 失败" : ""}`}
            </div>
          </div>
        </div>
        <div
          className="wf-chart"
          data-start={
            origin !== null &&
            span.start !== null &&
            (span.end !== null || span.running)
              ? Math.max(0, span.start - origin)
              : undefined
          }
          data-elapsed={span.elapsed ?? 0}
          data-running={span.running || undefined}
        >
          <Bar span={span} origin={origin} collapsed={closed} />
          <span className="wf-values">
            <span>
              {origin === null || span.start === null
                ? "起点缺失"
                : `${duration(span.start - origin)}–${duration((span.end ?? Date.now()) - origin)}`}
            </span>
            <span className={span.id === slowest ? "wf-slow-value" : undefined}>
              {`${timing}${span.request ? ` · ${money(span.request.cost)}` : ""}${span.id === slowest ? " · 最慢" : ""}`}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
});

function NoteDetails({
  span,
  threadId,
  turnId,
}: {
  span: TraceSpan;
  threadId: string;
  turnId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="wf-note">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Chevron next />
        <span>{span.kind === "reasoning" ? "思考" : "回复"}</span>
        {!open && <span className="wf-note-summary">{span.text}</span>}
      </button>
      {open && <TraceText span={span} threadId={threadId} turnId={turnId} />}
    </div>
  );
}

function TraceText({
  span,
  threadId,
  turnId,
}: {
  span: TraceSpan;
  threadId: string;
  turnId: string;
}) {
  const [text, setText] = useState<string>(),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void callData<TurnData>(
      "usage_turn",
      {
        threadId,
        turnId,
        text: { id: span.id.slice(span.kind.length + 1), kind: span.kind },
      },
      controller.signal,
    )
      .then((data) => {
        if (data.reason || data.text === undefined)
          throw Error(data.reason || "无法读取全文");
        if (!controller.signal.aborted) {
          setText(data.text);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : String(e));
      });
    return () => controller.abort();
  }, [threadId, turnId, span.id, span.kind, attempt]);
  return (
    <div className="wf-full-text">
      {error && (
        <Failure error={error} retry={() => setAttempt((n) => n + 1)} />
      )}
      {text === undefined && !error && <Status message="正在读取全文" />}
      {text !== undefined && <p>{text}</p>}
    </div>
  );
}
function Bar({
  span,
  origin,
  collapsed,
}: {
  span: TraceSpan;
  origin: number | null;
  collapsed: boolean;
}) {
  if (
    origin === null ||
    span.start === null ||
    (span.end === null && !span.running)
  )
    return <span className="wf-no-time">时间未知</span>;
  const start = Math.max(0, span.start - origin);
  const style = {
    "--start": start,
    "--elapsed": span.elapsed ?? 0,
  } as CSSProperties;
  const children = collapsed
    ? span.children.filter((child) => child.start !== null)
    : [];
  const extent = children.reduce(
    (max, child) => Math.max(max, (child.end ?? child.start!) - origin),
    span.end === null ? start : span.end - origin,
  );
  return (
    <div className="wf-bars" style={style} aria-hidden="true">
      {children.length > 0 && (
        <i
          className="wf-extent"
          style={{ "--extent": Math.max(0, extent - start) } as CSSProperties}
        />
      )}
      <i className={`wf-bar${span.running ? " wf-growing" : ""}`}>
        {span.notes
          ?.filter(
            (note) =>
              note.kind === "reasoning" &&
              note.start !== null &&
              note.end !== null &&
              span.elapsed &&
              note.end > span.start! &&
              note.start < span.end!,
          )
          .map((note) => (
            <b
              key={note.id}
              className="wf-reasoning-segment"
              title={`思考 · ${duration(note.elapsed)}`}
              style={{
                left: `${(Math.max(0, note.start! - span.start!) * 100) / span.elapsed!}%`,
                width: `${(Math.max(0, Math.min(note.end!, span.end!) - Math.max(note.start!, span.start!)) * 100) / span.elapsed!}%`,
              }}
            />
          ))}
      </i>
      {children.map((child) => (
        <i
          key={child.id}
          className={`wf-mark${child.failed ? " wf-error-mark" : ""}`}
          title={`${child.label} · ${duration(child.elapsed)}`}
          style={
            { "--mark": Math.max(0, child.start! - origin) } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
export function RequestDetailsPanel({
  span,
  threadId,
  turnId,
  close,
  id,
}: {
  span: TraceSpan;
  threadId: string;
  turnId: string;
  close: () => void;
  id?: string;
}) {
  const request = span.request!;
  const facts = [
    ["模型", request.model || "—"],
    ["输入", compact(request.input)],
    ["缓存", compact(request.cached)],
    ["输出", compact(request.output)],
    ["推理 tokens", compact(request.reasoning)],
    ["估算费用", money(request.cost)],
  ];
  return (
    <div
      className="wf-details"
      id={id}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <header>
        <h3>{`请求 #${request.sequence} · ${span.label}`}</h3>
        <Button label="关闭请求详情" onClick={close}>
          <CloseIcon />
        </Button>
      </header>
      <p className="meta">
        {`${span.elapsed !== null && span.elapsed < 100 ? "起点推算不可靠。" : ""}模型起点由轮次或前次调用完成时间推算，可能包含等待；无每请求 TTFT。`}
      </p>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {span.notes?.map((note) => (
        <NoteDetails
          key={note.id}
          span={note}
          threadId={threadId}
          turnId={turnId}
        />
      ))}
    </div>
  );
}
