import { useEffect, useRef, useState } from "react";
import { clock, compact, money } from "../shared/format";
import type { Thread } from "../shared/types";

export function ContextChart({
  thread,
  expanded,
  onOpen,
}: {
  thread: Thread;
  expanded: Set<string>;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(0),
    [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const height = 190,
    top = 18,
    base = 162,
    count = thread.requestInputs.length;
  const max = Math.max(
    thread.contextWindow ?? 0,
    ...thread.requestInputs.map((n) => n ?? 0),
    1,
  );
  const x = (i: number) => (i * width) / (count - 1),
    y = (n: number) => top + (base - top) * (1 - n / max);
  const segments = thread.turnStarts
    .flatMap((t) => {
      if (t.requestSequence === null) return [];
      const turn = thread.turns.find((r) => r.turnId === t.turnId);
      return turn
        ? [
            {
              id: t.turnId,
              number: turn.sequence,
              start: t.requestSequence - 1,
            },
          ]
        : [];
    })
    .sort((a, b) => a.start - b.start)
    .map((s, i, all) => ({ ...s, end: (all[i + 1]?.start ?? count) - 1 }));
  let line = "",
    area = "",
    start: number | null = null,
    last = 0;
  thread.requestInputs.forEach((n, i) => {
    if (n === null) {
      if (start !== null)
        area += ` L${x(last)},${base} L${x(start)},${base} Z `;
      start = null;
      return;
    }
    const command = `${start === null ? "M" : "L"}${x(i)},${y(n)} `;
    line += command;
    area += command;
    if (start === null) start = i;
    last = i;
  });
  if (start !== null) area += `L${x(last)},${base} L${x(start)},${base} Z`;
  const marks = thread.compactions.filter(
    (c) => c.requestSequence !== null && c.beforeTokens !== null,
  );
  const largest = marks.reduce(
    (best, c) =>
      !best ||
      (c.beforeTokens ?? 0) - (c.afterTokens ?? 0) >
        (best.beforeTokens ?? 0) - (best.afterTokens ?? 0)
        ? c
        : best,
    marks[0],
  );
  const labelsFit = marks.every(
    (c, i) =>
      i === 0 ||
      x(c.requestSequence! - 1) - x(marks[i - 1].requestSequence! - 1) > 160,
  );
  const selected =
    active === null
      ? undefined
      : segments.find((s) => s.start <= active && s.end >= active);
  const detail = active === null ? undefined : thread.requestDetails[active];
  return (
    <section className="ctx">
      <div className="ctx-head">
        <h2>上下文</h2>
        <span>每次请求的输入 tokens</span>
      </div>
      <div className="ctx-plot" ref={ref}>
        {width > 0 && (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`上下文曲线，${count} 次请求，${marks.length} 次压缩，上限 ${compact(thread.contextWindow)}`}
            >
              {segments
                .filter((s) => expanded.has(s.id))
                .map((s) => (
                  <rect
                    className="band"
                    key={s.id}
                    x={Math.max(0, x(s.start - 0.5))}
                    y={top}
                    width={
                      Math.min(width, x(s.end + 0.5)) -
                      Math.max(0, x(s.start - 0.5))
                    }
                    height={base - top}
                  />
                ))}
              {thread.contextWindow !== null && (
                <>
                  <line
                    className="limit"
                    x1={0}
                    x2={width}
                    y1={y(thread.contextWindow)}
                    y2={y(thread.contextWindow)}
                  />
                  <text x={width} y={12} textAnchor="end">
                    上限 {compact(thread.contextWindow)}
                  </text>
                </>
              )}
              <path className="area" d={area} />
              <path className="line" d={line} />
              <line className="base" x1={0} x2={width} y1={base} y2={base} />
              {segments.map((s, i) => {
                const left = Math.max(0, x(s.start - 0.5)),
                  right = Math.min(width, x(s.end + 0.5));
                return (
                  <g key={s.id}>
                    <line
                      className="tick"
                      x1={left}
                      x2={left}
                      y1={base}
                      y2={base + 5}
                    />
                    {(i === 0 ||
                      i === segments.length - 1 ||
                      right - left >= 22) && (
                      <text
                        x={(left + right) / 2}
                        y={height - 6}
                        textAnchor="middle"
                      >
                        {s.number}
                      </text>
                    )}
                  </g>
                );
              })}
              {marks.map((c, i) => (
                <g key={i}>
                  <circle
                    className="mark"
                    cx={x(c.requestSequence! - 1)}
                    cy={y(c.beforeTokens!)}
                    r={4}
                  />
                  {(labelsFit || c === largest) && (
                    <text
                      className="mark-label"
                      x={Math.max(
                        4,
                        Math.min(width - 160, x(c.requestSequence! - 1) - 30),
                      )}
                      y={
                        y(c.beforeTokens!) < top + 12
                          ? y(c.beforeTokens!) + 18
                          : y(c.beforeTokens!) - 9
                      }
                    >
                      压缩 {compact(c.beforeTokens)} → {compact(c.afterTokens)}
                    </text>
                  )}
                </g>
              ))}
              {active !== null && thread.requestInputs[active] !== null && (
                <circle
                  className="mark"
                  cx={x(active)}
                  cy={y(thread.requestInputs[active]!)}
                  r={4}
                />
              )}
            </svg>
            <div className="ctx-targets">
              {segments.map((s) => {
                const left = Math.max(0, x(s.start - 0.5)),
                  right = Math.min(width, x(s.end + 0.5));
                return (
                  <button
                    key={s.id}
                    style={{ left, width: right - left }}
                    aria-label={`展开第 ${s.number} 轮，${s.end - s.start + 1} 次请求`}
                    aria-expanded={expanded.has(s.id)}
                    onClick={() => onOpen(s.id)}
                    onFocus={() => setActive(s.start)}
                    onBlur={() => setActive(null)}
                    onMouseMove={(e) => {
                      const local = e.nativeEvent.offsetX;
                      setActive(
                        Math.min(
                          s.end,
                          Math.max(
                            s.start,
                            Math.round(((left + local) * (count - 1)) / width),
                          ),
                        ),
                      );
                    }}
                    onMouseLeave={() => setActive(null)}
                  />
                );
              })}
            </div>
            {active !== null && selected && detail && (
              <div
                className="ctx-tip"
                role="tooltip"
                style={{
                  left: Math.max(0, Math.min(width - 210, x(active) - 105)),
                }}
              >
                <strong>
                  第 {selected.number} 轮第 {active - selected.start + 1} 次请求
                </strong>
                <p>
                  <span>时间</span>
                  <span>{clock(detail[0])}</span>
                </p>
                <p>
                  <span>输入</span>
                  <span>{compact(thread.requestInputs[active])}</span>
                </p>
                <p>
                  <span>输出</span>
                  <span>{compact(detail[1])}</span>
                </p>
                <p>
                  <span>估算费用</span>
                  <span>{money(detail[2])}</span>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
