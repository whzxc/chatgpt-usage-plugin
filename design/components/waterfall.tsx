import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { baseTurn, variant, copy, type Turn } from "../scenes/usage";
import { Panel, Stack, Section } from "./layout";
import { TurnHeader } from "./turn-header";
import { MetricGrid } from "./metric-figure";
import { turnMetrics, turnMeta } from "../scenes/usage";
import { Minimap } from "./minimap";
import { TimeAxis, WaterfallRow } from "./waterfall-row";
import { RequestDetails } from "./request-details";
import { Status } from "./status";
import { Button } from "./button";
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
export default () => [
  <Frame {...frame("waterfall", "completed")}>
    <Panel>
      <Waterfall />
    </Panel>
  </Frame>,
];
