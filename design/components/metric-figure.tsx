import { Frame } from "adg";
import { frame } from "../support/frame";
import { metricExamples } from "../fixtures/metric-figure";
import { Grid } from "./layout";
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
  <Frame
    {...frame("metric-figure", "grid-overview")}
    width={680}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-full p-1 font-ui text-body leading-normal"
    >
      <MetricGrid items={metricExamples.overview} />
    </div>
  </Frame>,
  <Frame
    {...frame("metric-figure", "grid-unknown")}
    width={680}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-full p-1 font-ui text-body leading-normal"
    >
      <MetricGrid items={metricExamples.unknown} small />
    </div>
  </Frame>,
];
