import { Frame } from "sdg";
import { frame } from "../support/frame";
import { compact, axisCompact, money, percent } from "../support/format";
import { baseTurn, cost } from "../fixtures/usage";
import {
  contextCalls,
  compaction,
  contextParts,
  currentInput,
  fixedDetails,
} from "../fixtures/context";
import { Section } from "../components/layout";
import { Tooltip } from "../components/tooltip";
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
          aria-label={[
            `上下文曲线，${unknownLimit ? "容量未知" : `上限 ${axisCompact(max)}`}`,
            selected
              ? `，选中第 ${point.turn} 轮第 1 次请求，输入 ${compact(point.input)}`
              : "",
          ].join("")}
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

export function ContextAllocation({
  unknownLimit = false,
}: {
  unknownLimit?: boolean;
}) {
  const limit = unknownLimit ? null : baseTurn.limit!,
    parts = [
      ...contextParts,
      ...(limit === null
        ? []
        : [
            {
              label: "剩余空间",
              weight: 0,
              tone: "bg-border",
              tokens: Math.max(0, limit - currentInput),
            },
          ]),
    ],
    total = parts.reduce((s, p) => s + p.tokens, 0);
  return (
    <Section
      title="当前占用"
      actions={
        <span class="text-meta text-muted">
          {compact(currentInput)} / {compact(limit)} tokens
        </span>
      }
    >
      <div
        class="flex h-3 rounded-control overflow-hidden"
        role="img"
        aria-label="上下文估算分布"
      >
        {parts.map((p) => (
          <span
            class={p.tone}
            style={{ width: `${(p.tokens / total) * 100}%` }}
          />
        ))}
      </div>
      <div class="flex flex-col gap-3">
        {parts.map((p) => (
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-3 text-meta">
              <i class={`w-2 h-2 rounded-control ${p.tone}`} />
              <span>{p.label}</span>
              <span class="ml-auto">{compact(p.tokens)}</span>
              <span class="w-14 text-right text-muted">
                {percent(limit ? (p.tokens / limit) * 100 : null)}
              </span>
            </div>
            {p.label === "固定开销" && (
              <p class="text-meta text-muted pl-5">
                {fixedDetails
                  .map((p) => `${p.name} ${compact(p.tokens)}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
      <p class="text-meta text-muted">
        分类为估算，合计等于最近一次请求的输入。
      </p>
    </Section>
  );
}

export function ContextSection({
  selected = false,
  gaps = false,
  unknownLimit = false,
}: {
  selected?: boolean;
  gaps?: boolean;
  unknownLimit?: boolean;
}) {
  return (
    <>
      <ContextChart
        unknownLimit={unknownLimit}
        selected={selected}
        gaps={gaps}
      />
      <ContextAllocation unknownLimit={unknownLimit} />
    </>
  );
}

export default () => [
  <Frame
    {...frame("context", "chart-selected-compaction")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ContextChart selected />
    </div>
  </Frame>,
  <Frame
    {...frame("context", "chart-missing-measurements")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ContextChart gaps />
    </div>
  </Frame>,
  <Frame
    {...frame("context", "chart-unknown-capacity")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ContextChart unknownLimit />
    </div>
  </Frame>,
  <Frame
    {...frame("context", "allocation-estimated")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ContextAllocation />
    </div>
  </Frame>,
  <Frame
    {...frame("context", "allocation-unknown-capacity")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ContextAllocation unknownLimit />
    </div>
  </Frame>,
];
