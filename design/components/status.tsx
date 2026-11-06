import { Frame, Icon } from "sdg";
import { frame, number } from "../scenes/format";
import { copy, history } from "../scenes/usage";
import { Button } from "./button";
import { Panel, Stack } from "./layout";
export function Status({
  kind = "loading",
  message,
  retry = true,
  processed = history.length / 3,
  total = history.length,
}: {
  kind?: "loading" | "error" | "stale" | "empty" | "indexing" | "warning";
  message?: string;
  retry?: boolean;
  processed?: number;
  total?: number;
}) {
  const text =
    message ??
    (kind === "loading"
      ? copy.loading
      : kind === "error"
        ? copy.failure
        : kind === "stale"
          ? copy.stale
          : kind === "empty"
            ? copy.noUsage
            : kind === "indexing"
              ? copy.indexing
              : copy.unknownWarning);
  return (
    <div
      role="status"
      class={`flex flex-col gap-3 p-4 rounded-panel ${kind === "error" ? "bg-danger-surface text-danger" : kind === "stale" || kind === "warning" ? "bg-warning-surface text-warning" : "bg-surface text-muted"}`}
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
  <Frame {...frame("status", "feedback")}>
    <Panel>
      <Stack>
        <Status />
        <Status kind="indexing" />
        <Status kind="error" />
        <Status kind="stale" />
        <Status kind="empty" />
      </Stack>
    </Panel>
  </Frame>,
];
