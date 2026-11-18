import { Frame } from "adg";
import { frame } from "../../support/frame";
import {
  baseTurn,
  variant,
  copy,
  turnMetrics,
  turnMeta,
  type Turn,
} from "../../fixtures/usage";
import { waterfallProps } from "../../fixtures/waterfall";
import { Stack, Section } from "../../components/layout";
import { MetricGrid } from "../../components/metric-figure";
import { Status } from "../../components/status";
import { Button } from "../../components/button";
import { Minimap } from "./minimap";
import { TimeAxis, WaterfallRow } from "./row";
import { RequestDetails } from "./request-details";
export function Waterfall({
  turn = baseTurn,
  details = false,
  narrative = "collapsed",
  partial = false,
  all = false,
  viewRange,
}: {
  turn?: Turn;
  details?: boolean;
  narrative?: "collapsed" | "full" | "loading" | "error";
  partial?: boolean;
  all?: boolean;
  viewRange?: [number, number];
}) {
  const expanded = all
      ? turn.calls.filter((c) => c.kind === "model").map((c) => c.id)
      : ["r2"],
    visible = turn.calls.filter(
      (c) =>
        (!c.parent || expanded.includes(c.parent)) &&
        (!partial || (c.start ?? c.at) < 24000),
    ),
    range: [number, number] =
      viewRange ?? (partial ? [0, 24000] : [0, turn.end ?? turn.now]),
    hidden = turn.calls.filter(
      (c) => c.kind === "model" && !visible.includes(c),
    ).length;
  return (
    <Stack>
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
        {turn.state === "running" && (
          <p class="text-meta text-muted">
            尚未记录完成的模型请求暂无独立时间条。
          </p>
        )}
        {turn.calls.some((c) => c.start === null) && (
          <Status kind="warning" message={copy.unknownWarning} />
        )}
      </Section>
      {partial && <Button label={`显示其余 ${hidden} 次请求`} />}
    </Stack>
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
    {...frame("waterfall", "request-details-collapsed")}
    fixture="cup-request-details-collapsed"
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="collapsed" />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "request-details-full")}
    fixture="cup-request-details-full"
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="full" />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "request-details-loading")}
    fixture="cup-request-details-loading"
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="loading" />
    </div>
  </Frame>,
  <Frame
    {...frame("waterfall", "request-details-error")}
    fixture="cup-request-details-error"
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <RequestDetails narrative="error" />
    </div>
  </Frame>,
];
