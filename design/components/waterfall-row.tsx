import { Frame, Icon } from "sdg";
import { frame, duration, money, compact } from "../scenes/format";
import {
  baseTurn,
  variant,
  models,
  tools,
  elapsed,
  cost,
  slowest,
  type Turn,
  type Call,
} from "../scenes/usage";
import { Panel, Stack } from "./layout";
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
      class={`px-2 grid grid-cols-[260px_minmax(0,1fr)] gap-4 py-3 border-b border-border ${selected ? "bg-selected" : ""} ${focus ? "outline-2 outline-focus outline-offset-2 rounded-control" : ""}`}
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
                  width: `${Math.max(0, Math.min(100, ((Math.max(...children.map((c) => c.end ?? turn.now)) - view[0]) / span) * 100) - left)}%`,
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
  <Frame {...frame("waterfall-row", "branches")}>
    <Panel>
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
    </Panel>
  </Frame>,
  <Frame {...frame("waterfall-row", "unknown")}>
    <Panel>
      <WaterfallRow
        call={variant("unknown").calls[0]}
        turn={variant("unknown")}
      />
    </Panel>
  </Frame>,
];
