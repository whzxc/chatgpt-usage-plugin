import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { copy } from "../scenes/usage";
import { Button } from "./button";
import { Panel } from "./layout";
export function Header({
  title,
  back = false,
  busy = false,
  updated = copy.updated,
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
  <Frame {...frame("header", "long-title")}>
    <Panel>
      <Header title={copy.longTitle} back />
    </Panel>
  </Frame>,
  <Frame {...frame("header", "refreshing")}>
    <Panel>
      <Header title="用量" busy />
    </Panel>
  </Frame>,
];
