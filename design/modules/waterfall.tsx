import { Frame, Icon } from "sdg";
import { frame, duration, money, compact } from "../scenes/format";
import {
  baseTurn,
  variant,
  copy,
  type Turn,
  turnMetrics,
  turnMeta,
  density,
  slowest,
  elapsed,
  models,
  tools,
  cost,
  type Call,
} from "../scenes/usage";
import { Stack, Section } from "../components/layout";
import { TurnHeader } from "./turn-summary";
import { MetricGrid } from "../components/metric-figure";
import { RequestDetails } from "./request-details";
import { Status } from "../components/status";
import { Button } from "../components/button";
import { waterfallProps } from "../fixtures/waterfall";
export function Waterfall({
  turn = baseTurn,
  details = false,
  narrative = "collapsed",
  partial = false,
  all = false,
}: {
  turn?: Turn;
  details?: boolean;
  narrative?: "collapsed" | "full" | "loading" | "error";
  partial?: boolean;
  all?: boolean;
}) {
  const expanded = all
      ? turn.calls.filter((c) => c.kind === "model").map((c) => c.id)
      : ["r2"],
    visible = turn.calls.filter(
      (c) =>
        (!c.parent || expanded.includes(c.parent)) &&
        (!partial || (c.start ?? c.at) < 24000),
    ),
    range: [number, number] = partial ? [0, 24000] : [0, turn.end ?? turn.now],
    hidden = turn.calls.filter(
      (c) => c.kind === "model" && !visible.includes(c),
    ).length;
  return (
    <Stack>
      <TurnHeader turn={turn} open />
      <MetricGrid items={turnMetrics(turn)} small />
      <div class="flex flex-wrap gap-x-4 gap-y-2 text-meta text-muted">
        {turnMeta(turn).map((t) => (
          <span>{t}</span>
        ))}
      </div>
      <Section
        title="调用时间线"
        actions={<Button label={all ? "全部折叠" : "全部展开"} />}
      >
        <Minimap turn={turn} range={range} />
        <TimeAxis range={range} />
        <div role="tree" aria-label="轮次调用瀑布时间线">
          {visible
            .filter((c) => !c.parent)
            .map((c) => (
              <div
                class={
                  details && c.id === "r2" ? "border-l-2 border-accent" : ""
                }
              >
                <WaterfallRow
                  call={c}
                  turn={turn}
                  expanded={expanded.includes(c.id)}
                  selected={details && c.id === "r2"}
                  focus={details && c.id === "r2"}
                  range={range}
                />
                {visible
                  .filter((child) => child.parent === c.id)
                  .map((child) => (
                    <WaterfallRow call={child} turn={turn} range={range} />
                  ))}
                {details && c.id === "r2" && (
                  <div class="p-3">
                    <RequestDetails
                      call={c}
                      turn={turn}
                      narrative={narrative}
                    />
                  </div>
                )}
              </div>
            ))}
        </div>
        {partial && <Button label={`显示其余 ${hidden} 次请求`} />}{" "}
        {turn.state === "running" && (
          <p class="text-meta text-muted">
            尚未记录完成的模型请求暂无独立时间条。
          </p>
        )}
        {turn.calls.some((c) => c.start === null) && (
          <Status kind="warning" message={copy.unknownWarning} />
        )}
      </Section>
    </Stack>
  );
}

export function Minimap({
  turn = baseTurn,
  range,
  selected,
  busy = false,
}: {
  turn?: Turn;
  range?: [number, number];
  selected?: number;
  busy?: boolean;
}) {
  const data = density(turn),
    peak = Math.max(1, ...data.map((b) => b.models + b.tools)),
    end = turn.end ?? turn.now,
    window = range ?? [0, end],
    slow = slowest(turn);
  return (
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center text-meta text-muted">
        <span>整轮调用密度 · {duration(end - turn.start)}</span>
        {slow && (
          <Button label={`最慢 ${duration(elapsed(slow))}`} disabled={busy} />
        )}
      </div>
      <div
        data-free
        role="slider"
        aria-label="整轮调用密度"
        aria-valuenow={selected ?? 0}
        aria-valuemin={0}
        aria-valuemax={end}
        aria-disabled={busy}
        class="relative bg-surface h-10 rounded-control"
      >
        <div class="absolute inset-0 flex items-end gap-1 p-1">
          {data.map((bucket) => (
            <div class="flex-1 h-full flex flex-col-reverse">
              <i
                class="block bg-model-primary"
                style={{ height: `${(bucket.models / peak) * 100}%` }}
              />
              <i
                class="block bg-tool"
                style={{ height: `${(bucket.tools / peak) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <span
          class="absolute top-0 h-full border-2 border-focus rounded-control"
          style={{
            left: `${(window[0] / end) * 100}%`,
            width: `${((window[1] - window[0]) / end) * 100}%`,
          }}
        />
        {slow && (
          <i
            class="absolute top-0 h-full border-l-2 border-tool"
            style={{ left: `${((slow.start ?? slow.at) / end) * 100}%` }}
          />
        )}
        {selected !== undefined && (
          <i
            class="absolute top-0 h-full border-l-2 border-text"
            style={{ left: `${(selected / end) * 100}%` }}
          />
        )}
      </div>
      <div class="flex justify-between text-meta text-muted">
        <span>模型 / 工具调用次数</span>
        <span>
          可见 {duration(window[0])}–{duration(window[1])}
        </span>
      </div>
    </div>
  );
}

export function TimeAxis({
  range = [0, baseTurn.end ?? baseTurn.now],
}: {
  range?: [number, number];
}) {
  return (
    <div class="px-2 grid grid-cols-[260px_minmax(0,1fr)] gap-4 text-meta text-muted">
      <span>调用 · 模型耗时为推算</span>
      <div class="flex justify-between">
        {Array.from(
          { length: 4 },
          (_, i) => range[0] + ((range[1] - range[0]) * i) / 3,
        ).map((v) => (
          <span>{duration(v)}</span>
        ))}
      </div>
    </div>
  );
}
export function WaterfallRow({
  call,
  turn = baseTurn,
  expanded = false,
  focus = false,
  range,
  selected = false,
}: {
  call: Call;
  turn?: Turn;
  expanded?: boolean;
  focus?: boolean;
  range?: [number, number];
  selected?: boolean;
}) {
  const end = turn.end ?? turn.now,
    view = range ?? [0, end],
    span = view[1] - view[0],
    children = turn.calls.filter((c) => c.parent === call.id),
    child = call.kind === "tool",
    isSlow = slowest(turn)?.id === call.id,
    ms = elapsed(call, turn.now),
    sequence = models(turn.calls).findIndex((c) => c.id === call.id) + 1;
  const childEnd = Math.max(...children.map((c) => c.end ?? turn.now));
  const left =
      call.start === null
        ? 0
        : Math.max(0, ((call.start - view[0]) / span) * 100),
    right = Math.min(100, (((call.end ?? turn.now) - view[0]) / span) * 100),
    bad =
      call.status === "failed" || children.some((c) => c.status === "failed");
  return (
    <div
      role="treeitem"
      aria-level={child ? 2 : 1}
      aria-expanded={!child ? expanded : undefined}
      tabIndex={focus ? 0 : -1}
      class={[
        "px-2 grid grid-cols-[260px_minmax(0,1fr)] gap-4 py-3 border-b border-border",
        selected ? "bg-selected" : "",
        focus ? "outline-2 outline-focus outline-offset-2 rounded-control" : "",
      ].join(" ")}
    >
      <div class={`flex gap-2 items-center min-w-0 ${child ? "pl-5" : ""}`}>
        <Icon
          name={
            child ? "terminal" : expanded ? "chevron-down" : "chevron-right"
          }
          size={14}
          class="text-muted shrink-0"
        />
        <div class="min-w-0">
          <div
            class={`truncate ${child ? "font-mono text-meta" : "text-body font-medium"}`}
            title={call.label}
          >
            {call.label}
          </div>
          <div class="text-meta text-muted mt-1">
            {child
              ? `工具调用${bad ? " · 失败" : ""}`
              : `#${sequence} · ${children.length} 次工具调用${bad ? " · 含失败" : ""}`}
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2 justify-center min-w-0">
        {call.start === null ? (
          <span class="text-meta text-muted">时间未知</span>
        ) : (
          <div data-free class="relative h-3 rounded-control bg-border">
            {!expanded && children.length > 0 && (
              <span
                class="absolute h-3 bg-tool/20"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(0, Math.min(100, ((childEnd - view[0]) / span) * 100) - left)}%`,
                }}
              />
            )}
            <span
              class={`absolute h-3 rounded-control ${bad ? "bg-danger" : child ? "bg-tool" : "bg-model-primary"}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(0, right - left)}%`,
              }}
            />
            {!expanded &&
              children
                .filter((c) => c.start !== null)
                .map((c) => (
                  <i
                    class="absolute h-3 border-l-2 border-tool"
                    style={{
                      left: `${Math.min(100, Math.max(0, ((c.start! - view[0]) / span) * 100))}%`,
                    }}
                  />
                ))}
          </div>
        )}
        <div class="flex justify-between text-meta gap-3 text-muted">
          <span>
            {call.start === null
              ? "起点缺失"
              : `${duration(call.start)}–${duration(call.end ?? turn.now)}`}
          </span>
          <span
            class={`text-right ${isSlow ? "text-tool-text font-semibold" : ""}`}
          >
            {call.status === "running" ? "进行中" : duration(ms)}
            {!child && ` · ${money(cost(call))}`}
            {isSlow && " · 最慢"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default () => [
  <Frame
    {...frame("waterfall", "waterfall-completed")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Waterfall />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "minimap-selected-range")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Minimap range={[7000, 24000]} selected={12000} />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "minimap-loading-target")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Minimap busy />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "row-branches")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Stack compact>
        <TimeAxis />
        {baseTurn.calls
          .filter((c) => ["r1", "r2", "t2", "t3"].includes(c.id))
          .map((c) => (
            <WaterfallRow
              call={c}
              expanded={c.id === "r2"}
              focus={c.id === "t2"}
              selected={c.id === "t2"}
            />
          ))}
      </Stack>
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "row-unknown")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <WaterfallRow
        call={variant("unknown").calls[0]}
        turn={variant("unknown")}
      />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "waterfall-running")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Waterfall {...waterfallProps("running")} />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "waterfall-failed")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Waterfall {...waterfallProps("failed")} />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "waterfall-unknown")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Waterfall {...waterfallProps("unknown")} />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "waterfall-partial")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Waterfall {...waterfallProps("partial")} />
    </div>
  </Frame>,
];
