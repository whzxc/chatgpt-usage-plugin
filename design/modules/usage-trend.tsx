import { Frame } from "sdg";
import { frame } from "../support/frame";
import { compact, axisCompact, money } from "../support/format";
import { modelTones, copy, modelLegend } from "../fixtures/usage";
import { chartScene } from "../fixtures/usage-trend";
import { Section, Grid } from "../components/layout";
import { SingleChoice } from "../components/single-choice";
import { Tooltip } from "../components/tooltip";
export function UsageChart({
  metric = "Tokens",
  selected,
  mode = "daily",
}: {
  metric?: string;
  selected?: number;
  mode?: "daily" | "hourly" | "single";
}) {
  const scene = chartScene(mode, metric),
    data = scene.buckets,
    step = metric === "Tokens" ? 100000 : 0.5,
    maximum = Math.max(
      step,
      Math.ceil(
        Math.max(...data.map((d) => d.values.reduce((s, x) => s + x, 0))) /
          step,
      ) * step,
    ),
    format = metric === "Tokens" ? compact : money;
  return (
    <Section
      title={mode === "hourly" ? "今天每小时用量" : "每日用量"}
      actions={
        <SingleChoice label="图表指标" items={copy.metrics} value={metric} />
      }
    >
      <div data-free class="flex gap-3 text-meta text-muted">
        <div class="flex flex-col justify-between pb-7 w-12 shrink-0">
          {[maximum, maximum / 2, 0].map((v) => (
            <span>{metric === "Tokens" ? axisCompact(v) : money(v)}</span>
          ))}
        </div>
        <div
          class={`grid ${mode === "hourly" ? "grid-cols-24 gap-1" : "grid-cols-7 gap-3"} flex-1 min-w-0`}
        >
          {data.map((d, i) => (
            <div class="flex flex-col gap-2 items-center min-w-0">
              <div
                class={[
                  "w-full h-32 flex flex-col-reverse items-center border-b border-border",
                  selected === i ? "bg-selected outline-2 outline-focus" : "",
                ].join(" ")}
              >
                {d.values.map((v, j) => (
                  <div
                    class={`${mode === "hourly" ? "w-full" : "w-7"} ${modelTones[j]}`}
                    style={{ height: `${(v / maximum) * 100}%` }}
                  />
                ))}
              </div>
              <span class="text-meta">
                {mode !== "hourly" || i % 4 === 0 ? d.label : " "}
              </span>
            </div>
          ))}
        </div>
      </div>
      {selected !== undefined && (
        <div data-free class="relative h-32">
          <div
            class="absolute top-0 w-[240px]"
            style={{
              left: `${Math.min(432, Math.max(0, 60 + ((selected + 0.5) / data.length) * 612 - 120))}px`,
            }}
          >
            <Tooltip
              title={data[selected].label}
              rows={scene.names.map((label, j) => ({
                label,
                value: format(data[selected].values[j]),
              }))}
            />
          </div>
        </div>
      )}
      {scene.names.length > 1 && <Legend items={scene.legend} />}
    </Section>
  );
}

export function Legend({
  items = modelLegend,
}: {
  items?: typeof modelLegend;
}) {
  return (
    <Grid columns={2}>
      {items.map((m) => (
        <div class="flex flex-col gap-1 min-w-0">
          <div class="flex items-center gap-2 text-body">
            <i class={`h-2 w-2 shrink-0 rounded-control ${m.tone}`} />
            <span class="truncate">{m.label}</span>
            <strong class="ml-auto shrink-0">{m.value}</strong>
          </div>
          <span class="text-meta text-muted">{m.detail}</span>
        </div>
      ))}
    </Grid>
  );
}

export default () => [
  <Frame
    {...frame("usage-trend", "chart-tokens")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <UsageChart />
    </div>
  </Frame>,
  <Frame
    {...frame("usage-trend", "chart-selected")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <UsageChart selected={4} />
    </div>
  </Frame>,
  <Frame
    {...frame("usage-trend", "legend-models")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <Legend />
    </div>
  </Frame>,
  <Frame
    {...frame("usage-trend", "chart-hourly-cost")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <UsageChart mode="hourly" metric="费用" selected={14} />
    </div>
  </Frame>,
  <Frame
    {...frame("usage-trend", "chart-single-model")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <UsageChart mode="single" />
    </div>
  </Frame>,
];
