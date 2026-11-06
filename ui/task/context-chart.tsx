import { useEffect, useRef, useState } from "react";
import { axisCompact, compact, money } from "../shared/format";
import { Section, Tooltip } from "../components/ui/controls";
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
    [width, setWidth] = useState(672),
    [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const count = thread.requestInputs.length,
    height = active === null ? 180 : 196,
    bottom = 150;
  const max = Math.max(
    thread.contextWindow ?? 0,
    ...thread.requestInputs.map((n) => n ?? 0),
    1,
  );
  const x = (i: number) => 8 + (i / Math.max(1, count - 1)) * (width - 16),
    y = (n: number) => 16 + (bottom - 16) * (1 - n / max);
  const segments = thread.turnStarts
    .flatMap((t) => {
      const turn = thread.turns.find((r) => r.turnId === t.turnId);
      return turn && t.requestSequence !== null
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
    pen = false;
  thread.requestInputs.forEach((n, i) => {
    if (n === null) {
      pen = false;
      return;
    }
    line += `${pen ? "L" : "M"}${x(i)},${y(n)} `;
    pen = true;
  });
  const marks = thread.compactions.filter(
    (c) => c.requestSequence !== null && c.beforeTokens !== null,
  );
  const selected =
      active === null
        ? undefined
        : segments.find((s) => s.start <= active && s.end >= active),
    detail = active === null ? undefined : thread.requestDetails[active];
  return (
    <Section
      title="上下文"
      actions={<span className="meta">每次请求的输入 tokens</span>}
    >
      <div className="ctx-plot" ref={ref}>
        <svg
          width="100%"
          height={height}
          role="img"
          aria-label={`上下文曲线，${thread.contextWindow === null ? "容量未知" : `上限 ${axisCompact(max)}`}`}
        >
          {[max, max / 2, 0].map((v) => (
            <line
              key={v}
              x1={8}
              x2={width - 8}
              y1={y(v)}
              y2={y(v)}
              className="ctx-grid"
            />
          ))}
          <text x={width - 8} y={12} textAnchor="end">
            {thread.contextWindow === null
              ? "容量未知"
              : `上限 ${axisCompact(max)}`}
          </text>
          <text x={8} y={y(max / 2) - 6}>
            {axisCompact(max / 2)}
          </text>
          {segments
            .filter((s) => expanded.has(s.id))
            .map((s) => (
              <rect
                key={s.id}
                x={x(s.start)}
                y={16}
                width={Math.max(0, x(s.end) - x(s.start))}
                height={bottom - 16}
                fill="var(--selected)"
              />
            ))}
          {active !== null && thread.requestInputs[active] !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={y(thread.requestInputs[active]!) + 8}
              y2={height}
              stroke="var(--accent)"
              strokeDasharray="4 4"
            />
          )}
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
          {thread.requestInputs.map((n, i) =>
            n === null ? null : (
              <circle key={i} cx={x(i)} cy={y(n)} r={3} fill="var(--accent)" />
            ),
          )}
          {marks.map((c, i) => {
            const px = x(Math.max(0, c.requestSequence! - 2)),
              py = y(c.beforeTokens!);
            return (
              <g key={i}>
                <polygon
                  points={`${px},${py - 6} ${px + 6},${py} ${px},${py + 6} ${px - 6},${py}`}
                  fill="var(--canvas)"
                  stroke="var(--context-compaction)"
                  strokeWidth={2}
                />
                <text
                  x={Math.max(8, Math.min(width - 168, px - 140))}
                  y={py < 32 ? py + 20 : py - 12}
                >
                  压缩 {compact(c.beforeTokens)} → {compact(c.afterTokens)}
                </text>
              </g>
            );
          })}
          {active !== null && thread.requestInputs[active] !== null && (
            <circle
              cx={x(active)}
              cy={y(thread.requestInputs[active]!)}
              r={6}
              fill="var(--canvas)"
              stroke="var(--accent)"
              strokeWidth={3}
            />
          )}
          {segments.map((s) => (
            <text
              key={s.id}
              x={x(s.start + Math.floor((s.end - s.start) / 2))}
              y={174}
              textAnchor="middle"
            >
              第 {s.number} 轮
            </text>
          ))}
        </svg>
        <div className="ctx-targets" style={{ height: 150 }}>
          {thread.requestInputs.map((n, i) => {
            const segment = segments.find((s) => s.start <= i && s.end >= i);
            return (
              <button
                key={i}
                aria-label={`第 ${segment?.number ?? "—"} 轮第 ${i - (segment?.start ?? 0) + 1} 次请求，输入 ${compact(n)}`}
                aria-expanded={segment ? expanded.has(segment.id) : false}
                style={{
                  left: `${(i / Math.max(1, count)) * 100}%`,
                  width: `${100 / Math.max(1, count)}%`,
                }}
                onFocus={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  if (segment) onOpen(segment.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setActive(null);
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? count - 1
                          : Math.max(
                              0,
                              Math.min(
                                count - 1,
                                i + (e.key === "ArrowRight" ? 1 : -1),
                              ),
                            );
                    (
                      e.currentTarget.parentElement?.children[
                        next
                      ] as HTMLElement
                    )?.focus();
                  }
                }}
              />
            );
          })}
        </div>
        {active !== null && selected && detail && (
          <div className="inspection context-inspection">
            <div
              style={{
                position: "absolute",
                top: 0,
                width: 240,
                maxWidth: "100%",
                left: Math.max(0, Math.min(width - 240, x(active) - 120)),
              }}
            >
              <Tooltip
                title={`第 ${selected.number} 轮第 ${active - selected.start + 1} 次请求`}
                rows={[
                  {
                    label: "输入",
                    value: compact(thread.requestInputs[active]),
                  },
                  { label: "输出", value: compact(detail[1]) },
                  { label: "估算费用", value: money(detail[2]) },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
