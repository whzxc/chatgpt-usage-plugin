import { Frame } from "sdg";
import { frame, compact, axisCompact, money } from "../scenes/format";
import { baseTurn, cost } from "../scenes/usage";
import { contextCalls, compaction } from "../scenes/context";
import { Panel, Section } from "./layout";
import { Tooltip } from "./tooltip";
export function ContextChart({
  selected = false,
  gaps = false,
  unknownLimit = false,
}: {
  unknownLimit?: boolean;
  selected?: boolean;
  gaps?: boolean;
}) {
  const data = contextCalls.map((c, i) => ({
      ...c,
      input: gaps && i === 6 ? null : c.input,
    })),
    width = 672,
    height = 180,
    chartHeight = height + (selected ? 16 : 0),
    bottom = 150,
    max = unknownLimit
      ? Math.max(...data.map((c) => c.input ?? 0))
      : baseTurn.limit!,
    x = (i: number) => (i / (data.length - 1)) * (width - 16) + 8,
    y = (n: number) => 16 + (bottom - 16) * (1 - n / max);
  let path = "",
    pen = false;
  data.forEach((c, i) => {
    if (c.input === null) {
      pen = false;
      return;
    }
    path += `${pen ? "L" : "M"}${x(i)},${y(c.input)} `;
    pen = true;
  });
  const active = data.findIndex((c) => c.turn === 3),
    point = data[active],
    peakX = x(compaction.sequence - 2),
    peakY = y(compaction.before);
  return (
    <Section
      title="上下文"
      actions={<span class="text-meta text-muted">每次请求的输入 tokens</span>}
    >
      <div data-free>
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          class="w-full"
          role="img"
          aria-label={`上下文曲线，${unknownLimit ? "容量未知" : `上限 ${axisCompact(max)}`}${selected ? `，选中第 ${point.turn} 轮第 1 次请求，输入 ${compact(point.input)}` : ""}`}
        >
          {[max, max / 2, 0].map((v) => (
            <line
              x1={8}
              x2={width - 8}
              y1={y(v)}
              y2={y(v)}
              class="stroke-border"
            />
          ))}
          <text
            x={width - 8}
            y={12}
            text-anchor="end"
            class="fill-muted text-meta"
          >
            {unknownLimit ? "容量未知" : `上限 ${axisCompact(max)}`}
          </text>
          <text x={8} y={y(max / 2) - 6} class="fill-muted text-meta">
            {axisCompact(max / 2)}
          </text>
          {selected && point.input !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={y(point.input) + 8}
              y2={chartHeight}
              stroke-dasharray="4 4"
              class="stroke-accent"
            />
          )}
          <path d={path} fill="none" class="stroke-accent" stroke-width={2} />
          {data
            .filter((c) => c.input !== null)
            .map((c) => (
              <circle
                cx={x(c.sequence - 1)}
                cy={y(c.input!)}
                r={3}
                class="fill-accent"
              />
            ))}
          <polygon
            points={`${peakX},${peakY - 6} ${peakX + 6},${peakY} ${peakX},${peakY + 6} ${peakX - 6},${peakY}`}
            class="fill-canvas stroke-context-compaction"
            stroke-width={2}
          />
          {selected && point.input !== null && (
            <circle
              cx={x(active)}
              cy={y(point.input)}
              r={6}
              class="fill-canvas stroke-accent"
              stroke-width={3}
            />
          )}
          <text
            x={x(compaction.sequence - 2) - 140}
            y={
              y(compaction.before) < 32
                ? y(compaction.before) + 20
                : y(compaction.before) - 12
            }
            class="fill-muted text-meta"
          >
            压缩 {compact(compaction.before)} → {compact(compaction.after)}
          </text>
          {[1, 2, 3, 4].map((n, i) => (
            <text
              x={x(i * 4 + 1)}
              y={height - 6}
              text-anchor="middle"
              class="fill-muted text-meta"
            >
              第 {n} 轮
            </text>
          ))}
        </svg>
        {selected && (
          <div data-free class="relative h-36">
            <div
              class="absolute top-0 w-[240px]"
              style={{
                left: `${Math.min(432, Math.max(0, x(active) - 120))}px`,
              }}
            >
              <Tooltip
                title={`第 ${point.turn} 轮第 1 次请求`}
                rows={[
                  { label: "输入", value: compact(point.input) },
                  { label: "输出", value: compact(point.output) },
                  { label: "估算费用", value: money(cost(point)) },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
export default () => [
  <Frame {...frame("context-chart", "selected-compaction")}>
    <Panel>
      <ContextChart selected />
    </Panel>
  </Frame>,
];
