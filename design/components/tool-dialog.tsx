import { Frame } from "sdg";
import { frame, bytes, utf8, duration } from "../scenes/format";
import { baseTurn, variant, elapsed } from "../scenes/usage";
import { Button } from "./button";
import { ToolBody, longOutput } from "./tool-body";
import { Status } from "./status";
export function ToolDialog({
  form = "ready",
}: {
  form?:
    | "ready"
    | "loading"
    | "error"
    | "long"
    | "failed"
    | "copy-error"
    | "unknown";
}) {
  const call = (form === "failed" ? variant("failed") : baseTurn).calls.find(
      (c) => c.id === "t2",
    )!,
    output =
      form === "unknown"
        ? null
        : form === "long"
          ? longOutput
          : (call.result ?? null),
    pending = form === "loading" || form === "error";
  return (
    <div class="w-full bg-overlay p-10 text-text font-ui text-body">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="工具调用"
        class="rounded-dialog bg-raised shadow-dialog p-6 flex flex-col gap-6"
      >
        <header class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex flex-col gap-2">
            <h2 class="text-title font-semibold">
              {pending ? "工具调用" : "exec_command 工具调用"}
            </h2>
            {!pending && (
              <p
                class={`text-meta ${form === "failed" ? "text-danger" : "text-muted"}`}
              >
                用时 {duration(form === "unknown" ? null : elapsed(call))} ·
                退出码 {form === "unknown" ? "—" : form === "failed" ? 1 : 0} ·
                返回 {output === null ? "—" : bytes(utf8(output))}
              </p>
            )}
          </div>
          <Button label="关闭" icon="x" focus />
        </header>
        {pending ? (
          <Status
            kind={form === "loading" ? "loading" : "error"}
            message={
              form === "loading" ? "正在读取工具调用" : "无法读取工具调用"
            }
          />
        ) : (
          <>
            {[
              {
                title: "输入",
                text: form === "unknown" ? null : (call.command ?? null),
              },
              { title: "输出", text: output },
            ].map((p) => (
              <ToolBody {...p} />
            ))}
            {form === "copy-error" && (
              <Status
                kind="error"
                message="无法复制。请重新复制。"
                retry={false}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
export default () => [
  <Frame {...frame("tool-dialog", "ready")}>
    <ToolDialog />
  </Frame>,
];
