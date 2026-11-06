import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { copy } from "../scenes/usage";
import { Panel, Stack } from "./layout";
export function SingleChoice({
  items,
  value,
  label,
  disabled = false,
  focus = false,
}: {
  items: string[];
  value: string;
  label: string;
  disabled?: boolean;
  focus?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      class="inline-flex self-start rounded-control bg-surface p-1 gap-1"
    >
      {items.map((item) => (
        <button
          role="radio"
          aria-checked={item === value}
          disabled={disabled}
          tabIndex={item === value ? 0 : -1}
          class={`text-meta px-3 py-1 rounded-control ${disabled ? "bg-disabled text-subtle" : item === value ? "bg-raised font-semibold text-text" : "text-muted"} ${disabled ? "text-subtle" : ""} ${focus && item === value ? "outline-2 outline-focus outline-offset-2" : ""}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
export default () => [
  <Frame {...frame("single-choice", "selection")}>
    <Panel>
      <Stack>
        <SingleChoice label="用量范围" items={copy.ranges} value="7 天" focus />
        <SingleChoice label="图表指标" items={copy.metrics} value="Tokens" />
        <SingleChoice
          label="任务排序"
          items={copy.sorts}
          value="最近活动"
          disabled
        />
      </Stack>
    </Panel>
  </Frame>,
];
