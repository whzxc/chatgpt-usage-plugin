import { Frame, Icon } from "sdg";
import { frame } from "../scenes/format";
import { buttonActions } from "../fixtures/button";
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
      class={[
        "inline-flex shrink-0 items-center justify-center gap-2 h-(--control-height)",
        icon ? "w-8" : "px-3",
        "rounded-control text-meta",
        disabled ? "text-subtle bg-disabled" : "text-text bg-surface",
        focus ? "outline-2 outline-focus outline-offset-2" : "",
      ].join(" ")}
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
  <Frame
    {...frame("button", "actions")}
    width={undefined}
    capture={{ selector: "[data-design-button-actions]", viewport: "720x2400" }}
  >
    <div
      data-design-button-actions
      class="flex items-center gap-4 p-1 font-ui text-body leading-normal"
    >
      {buttonActions.map((p) => (
        <Button {...p} />
      ))}
    </div>
  </Frame>,
];
