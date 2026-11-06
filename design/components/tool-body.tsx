import { Frame } from "sdg";
import { frame, bytes, utf8 } from "../scenes/format";
import { Panel } from "./layout";
import { Button } from "./button";
import { longOutput } from "../scenes/tool";
export { longOutput } from "../scenes/tool";
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
  <Frame {...frame("tool-body", "truncated")}>
    <Panel>
      <ToolBody title="输出" text={longOutput} />
    </Panel>
  </Frame>,
];
