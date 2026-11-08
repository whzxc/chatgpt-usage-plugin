import { Frame } from "sdg";
import { frame, bytes, utf8, duration } from "../scenes/format";
import { Button } from "../components/button";
import { Status } from "../components/status";
import {
  longOutput,
  toolDialogProps,
  toolDialogDefaults,
} from "../fixtures/tool-dialog";
export function ToolDialog({
  input = toolDialogDefaults.input,
  output = toolDialogDefaults.output,
  durationMs = toolDialogDefaults.durationMs,
  exitCode = toolDialogDefaults.exitCode,
  loading = false,
  error = false,
  copyError = false,
}: {
  input?: string | null;
  output?: string | null;
  durationMs?: number | null;
  exitCode?: number | null;
  loading?: boolean;
  error?: boolean;
  copyError?: boolean;
}) {
  const pending = loading || error;
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
            <h2 class="text-title leading-[28px] font-semibold">
              {pending ? "工具调用" : "exec_command 工具调用"}
            </h2>
            {!pending && (
              <p
                class={`text-meta ${exitCode !== null && exitCode !== 0 ? "text-danger" : "text-muted"}`}
              >
                用时 {duration(durationMs)} · 退出码 {exitCode ?? "—"} · 返回{" "}
                {output === null ? "—" : bytes(utf8(output))}
              </p>
            )}
          </div>
          <Button label="关闭" icon="x" focus />
        </header>
        {pending ? (
          <Status
            kind={loading ? "loading" : "error"}
            message={loading ? "正在读取工具调用" : "无法读取工具调用"}
          />
        ) : (
          <>
            {[
              {
                title: "输入",
                text: input,
              },
              { title: "输出", text: output },
            ].map((p) => (
              <ToolBody {...p} />
            ))}
            {copyError && (
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

export function ToolBody({
  title,
  text,
}: {
  title: string;
  text: string | null;
}) {
  const original = text ?? "",
    display = original.slice(0, 16000),
    truncated = original.length > display.length;
  return (
    <section class="flex flex-col gap-3 min-w-0">
      <header class="flex items-center justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h3 class="text-body font-semibold">{title}</h3>
          {truncated && (
            <p class="text-meta text-muted">
              {bytes(utf8(original))} · 只显示前 16,000 字符
            </p>
          )}
        </div>
        <Button label={`复制${title}`} disabled={text === null} />
      </header>
      <pre
        tabindex={0}
        class="font-mono text-meta bg-surface rounded-control p-4 max-h-64 overflow-auto whitespace-pre-wrap break-words leading-relaxed"
      >
        <code>{text === null ? "—" : display}</code>
      </pre>
    </section>
  );
}

export default () => [
  <Frame
    {...frame("tool-dialog", "dialog-ready")}
    note="Approved 2026-11-08 by Leo"
    width={728}
    capture={{ selector: "[data-design-module]", viewport: "728x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolDialog />
    </div>
  </Frame>,
  <Frame
    {...frame("tool-dialog", "body-truncated")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolBody title="输出" text={longOutput} />
    </div>
  </Frame>,
  <Frame
    {...frame("tool-dialog", "dialog-loading")}
    note="Approved 2026-11-08 by Leo"
    width={728}
    capture={{ selector: "[data-design-module]", viewport: "728x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolDialog {...toolDialogProps("loading")} />
    </div>
  </Frame>,
  <Frame
    {...frame("tool-dialog", "dialog-error")}
    note="Approved 2026-11-08 by Leo"
    width={728}
    capture={{ selector: "[data-design-module]", viewport: "728x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolDialog {...toolDialogProps("error")} />
    </div>
  </Frame>,
  <Frame
    {...frame("tool-dialog", "dialog-long")}
    note="Approved 2026-11-08 by Leo"
    width={728}
    capture={{ selector: "[data-design-module]", viewport: "728x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolDialog {...toolDialogProps("long")} />
    </div>
  </Frame>,
  <Frame
    {...frame("tool-dialog", "dialog-failed")}
    note="Approved 2026-11-08 by Leo"
    width={728}
    capture={{ selector: "[data-design-module]", viewport: "728x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolDialog {...toolDialogProps("failed")} />
    </div>
  </Frame>,
  <Frame
    {...frame("tool-dialog", "dialog-copy-error")}
    note="Approved 2026-11-08 by Leo"
    width={728}
    capture={{ selector: "[data-design-module]", viewport: "728x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolDialog {...toolDialogProps("copy-error")} />
    </div>
  </Frame>,
  <Frame
    {...frame("tool-dialog", "dialog-unknown")}
    note="Approved 2026-11-08 by Leo"
    width={728}
    capture={{ selector: "[data-design-module]", viewport: "728x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <ToolDialog {...toolDialogProps("unknown")} />
    </div>
  </Frame>,
];
