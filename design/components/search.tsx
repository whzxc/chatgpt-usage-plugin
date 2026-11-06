import { Frame, Icon } from "sdg";
import { frame } from "../scenes/format";
import { Panel, Stack } from "./layout";
const examples = [
  { value: "" },
  { value: "海岸", focus: true },
  { value: "跨季节观测记录", disabled: true },
];
export function Search({
  value = "",
  focus = false,
  disabled = false,
}: {
  value?: string;
  focus?: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      class={`flex items-center gap-2 rounded-control bg-surface px-3 h-(--control-height) min-w-0 ${focus ? "outline-2 outline-focus outline-offset-2" : ""}`}
    >
      <Icon name="search" class="text-muted shrink-0" />
      <input
        type="search"
        aria-label="搜索任务"
        placeholder="搜索任务"
        value={value}
        disabled={disabled}
        class="w-full min-w-0 bg-surface text-meta text-text outline-none placeholder:text-muted"
      />
    </label>
  );
}
export default () => [
  <Frame {...frame("search", "field")}>
    <Panel>
      <Stack>
        {examples.map((p) => (
          <Search {...p} />
        ))}
      </Stack>
    </Panel>
  </Frame>,
];
