import { Frame } from "sdg";
import { frame, compact, money } from "../scenes/format";
import { trend, costTrend, modelNames } from "../scenes/usage";
import { Panel } from "./layout";
export function Tooltip({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <aside
      role="tooltip"
      class="bg-raised border border-border rounded-control p-3 flex flex-col gap-2 text-meta"
    >
      <strong>{title}</strong>
      {rows.map((r) => (
        <div class="flex justify-between gap-5">
          <span class="text-muted">{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </aside>
  );
}
export const trendTip = (i: number) =>
  modelNames.map((label, j) => ({
    label,
    value: `${compact(trend[i].values[j])} · ${money(costTrend[i].values[j])}`,
  }));
export default () => [
  <Frame {...frame("tooltip", "bucket")}>
    <Panel>
      <Tooltip title={trend[4].label} rows={trendTip(4)} />
    </Panel>
  </Frame>,
];
