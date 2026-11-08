import { Frame } from "sdg";
import { frame } from "../support/frame";
import { tooltipExample } from "../fixtures/tooltip";
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
export default () => [
  <Frame
    {...frame("tooltip", "bucket")}
    note="Proposal pending Leo review"
    width={248}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-full p-1 font-ui text-body leading-normal"
    >
      <Tooltip {...tooltipExample} />
    </div>
  </Frame>,
];
