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
import { bytes, compact, duration, money, ttft } from "../shared/format";
import { callData } from "../app/bridge";
import { Failure } from "../shared/status";
import { Chevron } from "../shared/icons";
import { traceSpans, traceWindow } from "./waterfall-model";
import type { TraceSpan } from "./waterfall-model";
import { useWaterfallClock } from "./waterfall-clock";
import { axisTime } from "./waterfall-range";
import "./waterfall.css";

type VisibleSpan = {
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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
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
  const { root, axis, header } = useWaterfallClock(
    origin,
    end,
    running,
    intervals,
    complete,
  );
  const slowest = turn.slowestCall
    ? `${turn.slowestCall.kind}:${turn.slowestCall.id}`
    : null;
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
      setCollapsed((old) => {
        const next = new Set(old);
        if (next.has(span.id)) next.delete(span.id);
        else next.add(span.id);
        return next;
      });
    },
    [focus],
  );
  const activate = useCallback(
    (span: TraceSpan) => {
      focus(span.id);
      if (span.tool) openTool(span.tool.toolId);
      if (span.request || span.text)
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
        } else if (span.request || span.text) setDetails(span.id);
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
      setCollapsed((old) => {
        const next = new Set(old);
        next.delete(parent.id);
        return next;
      });
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
  const chunks = useMemo(
    () =>
      Array.from({ length: Math.ceil(rows.length / 40) }, (_, i) =>
        rows.slice(i * 40, i * 40 + 40),
      ),
    [rows],
  );
  return (
    <div className="waterfall-container">
      <div className="waterfall" ref={root}>
        <p className="wf-hint">
          {origin === null
            ? "轮次开始时间缺失，无法定位时间条。"
            : "时间轴跟随可见行；LLM 耗时为推算。"}{" "}
          左右键折叠，回车查看详情。
        </p>
        <div className="wf-sticky" ref={header}>
          {turn.overview && (
            <Minimap overview={turn.overview} busy={busy} navigate={navigate} />
          )}
          <div className="wf-heading">
            <span>调用</span>
            <div className="wf-axis" ref={axis} aria-hidden="true" />
          </div>
        </div>
        <div className="wf-body">
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
            {chunks.map((chunk, index) => (
              <div role="none" className="wf-chunk" key={index}>
                {chunk.map((row) => (
                  <TraceRow
                    key={row.span.id}
                    row={row}
                    active={focusId === row.span.id}
                    expanded={details === row.span.id}
                    closed={collapsed.has(row.span.id)}
                    slowest={slowest}
                    origin={origin}
                    turn={turn}
                    threadId={threadId}
                    detailsId={detailsId}
                    register={register}
                    activate={activate}
                    toggle={toggle}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {running && (
          <p className="wf-hint">
            进行中；尚未记录完成的 LLM 请求暂无独立时间条。
          </p>
        )}
      </div>
    </div>
  );
}

function Minimap({
  overview,
  busy,
  navigate,
}: {
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
    setPosition(next);
    const target = overview.buckets[next].target;
    if (target) navigate(target);
  };
  return (
    <div className="wf-map-wrap">
      <div
        className="wf-map"
        role="slider"
        tabIndex={busy ? -1 : 0}
        aria-label="整轮调用密度，左右键定位，回车跳转"
        aria-disabled={busy}
        aria-valuemin={0}
        aria-valuemax={overview.buckets.length - 1}
        aria-valuenow={position}
        aria-valuetext={axisTime(
          (position * overview.durationMs) / overview.buckets.length,
        )}
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
              navigate(overview.slowest.target);
            } else go(Math.floor(fraction * overview.buckets.length));
          }
        }}
        onKeyDown={(event) => {
          if (busy) return;
          let next = position;
          if (event.key === "ArrowRight") next++;
          else if (event.key === "ArrowLeft") next--;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = overview.buckets.length - 1;
          else if (event.key === "Enter" || event.key === " ") go(position);
          else return;
          setPosition(Math.max(0, Math.min(overview.buckets.length - 1, next)));
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
          style={{ left: `${(position * 100) / overview.buckets.length}%` }}
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
      {overview.slowest && (
        <button
          type="button"
          className="wf-slowest"
          disabled={busy}
          onClick={() => navigate(overview.slowest!.target)}
        >
          最慢
        </button>
      )}
    </div>
  );
}

const TraceRow = memo(function TraceRow({
  row,
  active,
  expanded,
  closed,
  slowest,
  origin,
  turn,
  threadId,
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
  turn: Turn;
  threadId: string;
  detailsId: string;
  register: (id: string, node: HTMLDivElement | null) => void;
  activate: (span: TraceSpan) => void;
  toggle: (span: TraceSpan) => void;
}) {
  const { span, parent } = row;
  const childSlowest =
    closed && span.children.some((child) => child.id === slowest);
  const timing = span.running ? "进行中" : duration(span.elapsed);
  const metrics = span.request
    ? `${money(span.request.cost)} · ${compact(span.request.tokens)} tokens`
    : "";
  const textOnly =
    span.kind === "reply" ||
    (span.kind === "reasoning" && span.elapsed === null);
  return (
    <div
      role="treeitem"
      aria-level={parent ? 2 : 1}
      aria-posinset={row.position}
      aria-setsize={row.size}
      aria-expanded={
        span.children.length
          ? !closed
          : span.request || span.text
            ? expanded
            : undefined
      }
      aria-describedby={expanded ? detailsId : undefined}
      aria-label={`${span.label}，${timing}${metrics ? `，${metrics}` : ""}${span.id === slowest ? "，本轮最慢" : ""}${span.failed ? "，失败" : ""}${span.text ? `，${span.text}` : ""}`}
      tabIndex={active ? 0 : -1}
      data-wf-id={span.id}
      ref={(node) => register(span.id, node)}
      className={`wf-item wf-${span.kind}${span.failed ? " wf-failed" : ""}${parent ? " wf-child" : ""}`}
    >
      <div
        className={`wf-row${textOnly ? " wf-text-row" : ""}`}
        onClick={() => activate(span)}
      >
        <div className="wf-name">
          {span.children.length > 0 && (
            <button
              type="button"
              tabIndex={-1}
              className={`wf-fold${closed ? "" : " is-expanded"}`}
              aria-label={closed ? "展开子调用" : "折叠子调用"}
              onClick={(event) => {
                event.stopPropagation();
                toggle(span);
              }}
            >
              <Chevron next />
            </button>
          )}
          <span className="wf-label" title={span.tool?.preview || span.label}>
            {span.label}
          </span>
          {span.text && !textOnly && (
            <span className="wf-summary" title={span.text}>
              {span.text}
            </span>
          )}
          {span.failed && <span className="wf-badge">失败</span>}
          {(span.id === slowest || childSlowest) && (
            <span className="wf-badge">{childSlowest ? "含最慢" : "最慢"}</span>
          )}
          {closed && <small>{span.children.length}</small>}
          {!textOnly && (
            <span className="wf-mobile-duration">
              {timing}
              {span.request && (
                <span className="wf-cost"> · {money(span.request.cost)}</span>
              )}
            </span>
          )}
        </div>
        {textOnly ? (
          <p className="wf-text">{span.text}</p>
        ) : (
          <div className="wf-chart">
            <Bar span={span} origin={origin} collapsed={closed} />
            <span className="wf-values">
              <span className="wf-duration">{timing}</span>
              {span.request && (
                <>
                  <span className="wf-cost"> · {money(span.request.cost)}</span>
                  <span className="wf-tokens">
                    {" "}
                    · {compact(span.request.tokens)}
                  </span>
                </>
              )}
            </span>
          </div>
        )}
      </div>
      {expanded && span.request && (
        <RequestDetails id={detailsId} request={span.request} turn={turn} />
      )}
      {expanded && span.text && (
        <TraceText
          key={span.id}
          id={detailsId}
          span={span}
          threadId={threadId}
          turnId={turn.turnId}
        />
      )}
    </div>
  );
});

function TraceText({
  id,
  span,
  threadId,
  turnId,
}: {
  id: string;
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
        if (!controller.signal.aborted) setError(String(e));
      });
    return () => controller.abort();
  }, [threadId, turnId, span.id, span.kind, attempt]);
  return (
    <div className="wf-full-text" id={id}>
      {error && (
        <Failure error={error} retry={() => setAttempt((n) => n + 1)} />
      )}
      {text === undefined && !error && <small>正在读取全文…</small>}
      <p>{text ?? span.text}</p>
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
      <i className={`wf-bar${span.running ? " wf-growing" : ""}`} />
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
function RequestDetails({
  id,
  request,
  turn,
}: {
  id: string;
  request: NonNullable<TraceSpan["request"]>;
  turn: Turn;
}) {
  const facts = [
    ["模型", request.model || "—"],
    ["Tokens", compact(request.tokens)],
    ["输入", compact(request.input)],
    ["缓存", compact(request.cached)],
    ["输出", compact(request.output)],
    ["推理 tokens", compact(request.reasoning)],
    ["估算费用", money(request.cost)],
    ["轮次 TTFT", ttft(turn.metrics.ttftMs)],
    [
      "工具返回",
      bytes(
        request.tools.reduce<number | null>(
          (sum, tool) =>
            sum === null || tool.outputBytes === null
              ? null
              : sum + tool.outputBytes,
          0,
        ),
      ),
    ],
  ];
  return (
    <div className="wf-details" id={id}>
      <p>
        起点由本轮开始或此前请求 / 工具完成时间推算，可能包含等待；无每请求
        TTFT。Esc 关闭详情。
      </p>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
