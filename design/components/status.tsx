import { Frame, Icon } from "sdg";
import { frame } from "../support/frame";
import { number } from "../support/format";
import {
  statusMessages,
  statusProgress,
  statusExamples,
} from "../fixtures/status";
import { Button } from "./button";
import { Stack } from "./layout";
export function Status({
  kind = "loading",
  message,
  retry = true,
  processed = statusProgress.processed,
  total = statusProgress.total,
}: {
  kind?: "loading" | "error" | "stale" | "empty" | "indexing" | "warning";
  message?: string;
  retry?: boolean;
  processed?: number;
  total?: number;
}) {
  const text = message ?? statusMessages[kind];
  return (
    <div
      role="status"
      class={[
        "flex flex-col gap-3 p-4 rounded-panel",
        kind === "error"
          ? "bg-danger-surface text-danger"
          : kind === "stale" || kind === "warning"
            ? "bg-warning-surface text-warning"
            : "bg-surface text-muted",
      ].join(" ")}
    >
      <div class="flex items-center gap-3">
        <Icon
          name={
            kind === "error" || kind === "warning" || kind === "stale"
              ? "triangle-alert"
              : kind === "empty"
                ? "inbox"
                : kind === "indexing"
                  ? "database"
                  : "loader-circle"
          }
          class="shrink-0"
        />
        <span class="flex-1 text-body break-words">{text}</span>
        {retry && (kind === "error" || kind === "stale") && (
          <Button label="重试" />
        )}
      </div>
      {kind === "indexing" && (
        <>
          <div class="text-meta">
            已读取 {number(processed)} / {number(total)}
          </div>
          <div class="bg-border h-2 rounded-control">
            <div
              class="h-full bg-accent rounded-control"
              style={{ width: `${(processed / total) * 100}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
export default () => [
  <Frame
    {...frame("status", "feedback")}
    width={680}
    capture={{ selector: "[data-design-specimen]", viewport: "720x2400" }}
  >
    <div
      data-design-specimen
      class="w-full p-1 font-ui text-body leading-normal"
    >
      <Stack>
        {statusExamples.map((kind) => (
          <Status kind={kind} />
        ))}
      </Stack>
    </div>
  </Frame>,
];
