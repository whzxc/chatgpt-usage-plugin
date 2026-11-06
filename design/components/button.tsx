import { Frame, Icon } from "sdg";
import { frame } from "../scenes/format";
import { Panel } from "./layout";
const examples = [
  { label: "重试" },
  { label: "正在更新", busy: true },
  { label: "下一页", disabled: true },
  { label: "刷新", icon: "refresh-cw", focus: true },
  { label: "关闭", icon: "x" },
];
export function Button({
  label,
  icon,
  disabled = false,
  busy = false,
  focus = false,
}: {
  label: string;
  icon?: string;
  disabled?: boolean;
  busy?: boolean;
  focus?: boolean;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      class={`inline-flex shrink-0 items-center justify-center gap-2 h-(--control-height) ${icon ? "w-8" : "px-3"} rounded-control text-meta ${disabled ? "text-subtle bg-disabled" : "text-text bg-surface"} ${focus ? "outline-2 outline-focus outline-offset-2" : ""}`}
    >
      {icon ? (
        <Icon name={icon} />
      ) : (
        <>
          {busy && <Icon name="loader-circle" />}
          {label}
        </>
      )}
    </button>
  );
}
export default () => [
  <Frame {...frame("button", "actions")}>
    <Panel>
      <div class="flex gap-4 items-center">
        {examples.map((p) => (
          <Button {...p} />
        ))}
      </div>
    </Panel>
  </Frame>,
];
