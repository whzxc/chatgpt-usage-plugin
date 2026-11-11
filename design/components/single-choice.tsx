import { Frame } from "adg";
import { frame } from "../support/frame";
import { selectionExamples } from "../fixtures/single-choice";
import { Stack } from "./layout";
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
          class={[
            "text-meta px-3 py-1 rounded-control",
            disabled
              ? "bg-disabled text-subtle"
              : item === value
                ? "bg-raised font-semibold text-text"
                : "text-muted",
            disabled ? "text-subtle" : "",
            focus && item === value
              ? "outline-2 outline-focus outline-offset-2"
              : "",
          ].join(" ")}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
export default () => [
  <Frame
    {...frame("single-choice", "selection")}
    width={undefined}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-max p-1 font-ui text-body leading-normal"
    >
      <Stack>
        {selectionExamples.map((example) => (
          <SingleChoice {...example} />
        ))}
      </Stack>
    </div>
  </Frame>,
];
