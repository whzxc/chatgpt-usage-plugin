import { memo } from "react";
import type { CSSProperties } from "react";
import { Chevron, Icon } from "../../components/ui/Icons";
import { compact, duration, money } from "../../shared/format";
import type { TraceSpan } from "../waterfall-model";

export type VisibleSpan = {
  span: TraceSpan;
  parent?: TraceSpan;
  position: number;
  size: number;
};

const TerminalIcon = () => (
  <Icon size={14}>
    <path d="m4 5 7 7-7 7M13 19h7" />
  </Icon>
);

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
