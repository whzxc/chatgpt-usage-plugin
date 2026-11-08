import { Frame, Icon } from "sdg";
import { frame } from "../support/frame";
import { Stack } from "./layout";
import { searchExamples } from "../fixtures/search";
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
      class={[
        "flex items-center gap-2 rounded-control bg-surface px-3 h-(--control-height) min-w-0",
        focus ? "outline-2 outline-focus outline-offset-2" : "",
      ].join(" ")}
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
  <Frame
    {...frame("search", "field")}
    width={680}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-full p-1 font-ui text-body leading-normal"
    >
      <Stack>
        {searchExamples.map((p) => (
          <Search {...p} />
        ))}
      </Stack>
    </div>
  </Frame>,
];
