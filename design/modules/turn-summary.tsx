import { turnHeaderExamples } from "../fixtures/turn-summary";
import { Frame, Icon } from "sdg";
import { frame } from "../support/frame";
import { compact, money, duration } from "../support/format";
import { baseTurn, totals, type Turn } from "../fixtures/usage";
import { Stack } from "../components/layout";
import { Status } from "../components/status";
export const stateLabel = {
  done: "已完成",
  running: "进行中",
  failed: "失败",
  interrupted: "已中断",
};
export function TurnHeader({
  turn = baseTurn,
  open = false,
  focus = false,
}: {
  turn?: Turn;
  open?: boolean;
  focus?: boolean;
}) {
  const t = totals(turn.calls);
  return (
    <button
      aria-expanded={open}
      class={`w-full flex items-start gap-3 text-left rounded-control ${focus ? "outline-2 outline-focus outline-offset-2" : ""}`}
    >
      <span class="text-meta rounded-control bg-surface px-2 py-1 shrink-0">
        {String(turn.sequence).padStart(2, "0")}
      </span>
      <div class="min-w-0 flex-1">
        <span class="flex items-center gap-2">
          <span class="min-w-0 break-words font-semibold text-body">
            <span>
              {turn.prompt || (turn.scheduled ? "定时任务" : "未提供文字请求")}
            </span>
          </span>
          <Icon
            name={open ? "chevron-down" : "chevron-right"}
            class="shrink-0 text-muted"
          />
        </span>
        {!open && (
          <span class="block text-meta text-muted mt-1">
            {duration(turn.end === null ? null : turn.end - turn.start)} ·{" "}
            {t.requests} 次请求 · TTFT {duration(turn.ttft)}
            {turn.compacted ? " · 压缩上下文" : ""}
          </span>
        )}
      </div>
      <span class="shrink-0 text-right">
        <span
          class={`block text-meta ${turn.state === "failed" ? "text-danger" : "text-accent"}`}
        >
          {stateLabel[turn.state]}
        </span>
        {!open && (
          <span class="text-meta text-muted block mt-1">
            {money(t.cost)} · {compact(t.tokens)}
          </span>
        )}
      </span>
    </button>
  );
}

export function TurnSummary({
  turn = baseTurn,
  loading = false,
  error,
}: {
  turn?: Turn;
  loading?: boolean;
  error?: string;
}) {
  return (
    <>
      <TurnHeader turn={turn} open />
      {loading && <Status message="正在读取轮次" />}
      {error && <Status kind="error" message={error} />}
    </>
  );
}

export default () => [
  <Frame
    {...frame("turn-summary", "header-states")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Stack>
        {turnHeaderExamples.map((turn, i) => (
          <TurnHeader turn={turn} focus={i === 0} />
        ))}
      </Stack>
    </div>
  </Frame>,
  <Frame
    {...frame("turn-summary", "summary-loading")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <TurnSummary loading />
    </div>
  </Frame>,
  <Frame
    {...frame("turn-summary", "summary-error")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <TurnSummary error="无法读取轮次" />
    </div>
  </Frame>,
];
