import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { headerExamples, headerUpdated } from "../fixtures/header";
import { Button } from "./button";
export function Header({
  title,
  back = false,
  busy = false,
  updated = headerUpdated,
}: {
  title: string;
  back?: boolean;
  busy?: boolean;
  updated?: string;
}) {
  return (
    <header class="flex flex-col gap-3">
      {back && (
        <div>
          <Button label="全部任务" icon="arrow-left" />
        </div>
      )}
      <div class="flex items-start justify-between gap-4">
        <h1 class="min-w-0 text-title font-semibold break-words">{title}</h1>
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-meta text-muted">
            {busy ? "正在更新" : updated}
          </span>
          <Button label="刷新" icon="refresh-cw" busy={busy} />
        </div>
      </div>
    </header>
  );
}
export default () => [
  <Frame
    {...frame("header", "long-title")}
    width={680}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-full p-1 font-ui text-body leading-normal"
    >
      <Header {...headerExamples.longTitle} />
    </div>
  </Frame>,
  <Frame
    {...frame("header", "refreshing")}
    width={680}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-full p-1 font-ui text-body leading-normal"
    >
      <Header {...headerExamples.refreshing} />
    </div>
  </Frame>,
];
