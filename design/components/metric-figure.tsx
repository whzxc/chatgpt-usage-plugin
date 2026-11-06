import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { summaryMetrics, variant, turnMetrics } from "../scenes/usage";
import { Panel, Grid } from "./layout";
export function MetricFigure({
  label,
  value,
  detail,
  small = false,
}: {
  label: string;
  value: string;
  detail?: string;
  small?: boolean;
}) {
  return (
    <div class="flex flex-col gap-1 min-w-0">
      <span class="text-meta text-muted">{label}</span>
      <strong
        class={`${small ? "text-title" : "text-display"} font-semibold leading-tight`}
      >
        {value}
      </strong>
      {detail && <span class="text-meta text-muted">{detail}</span>}
    </div>
  );
}
export function MetricGrid({
  items,
  small = false,
  columns = 3,
}: {
  columns?: number;
  items: { label: string; value: string; detail?: string }[];
  small?: boolean;
}) {
  return (
    <Grid columns={columns}>
      {items.map((m) => (
        <MetricFigure {...m} small={small} />
      ))}
    </Grid>
  );
}
export default () => [
  <Frame {...frame("metric-figure", "overview")}>
    <Panel>
      <MetricGrid items={summaryMetrics()} />
    </Panel>
  </Frame>,
  <Frame {...frame("metric-figure", "unknown")}>
    <Panel>
      <MetricGrid items={turnMetrics(variant("unknown"))} small />
    </Panel>
  </Frame>,
];
