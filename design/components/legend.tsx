import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { modelLegend } from "../scenes/usage";
import { Panel, Grid } from "./layout";
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
  <Frame {...frame("legend", "models")}>
    <Panel>
      <Legend />
    </Panel>
  </Frame>,
];
