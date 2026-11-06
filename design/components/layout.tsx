import { Frame } from "sdg";
import { frame } from "../scenes/format";
export function Panel({ children }: { children?: unknown }) {
  return (
    <main class="w-full bg-canvas text-text font-ui text-body leading-normal p-6 flex flex-col gap-6">
      {children}
    </main>
  );
}
export function Stack({
  children,
  compact = false,
}: {
  children?: unknown;
  compact?: boolean;
}) {
  return (
    <div class={`flex flex-col ${compact ? "gap-3" : "gap-6"} min-w-0`}>
      {children}
    </div>
  );
}
export function Grid({
  children,
  columns = 3,
}: {
  children?: unknown;
  columns?: number;
}) {
  return (
    <div
      class={`grid ${columns === 2 ? "grid-cols-2" : columns === 6 ? "grid-cols-6" : "grid-cols-3"} gap-5 min-w-0`}
    >
      {children}
    </div>
  );
}
export function Section({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: unknown;
  children?: unknown;
}) {
  return (
    <section class="border-t border-border pt-5 flex flex-col gap-4 min-w-0">
      {(title || actions) && (
        <header class="flex items-center justify-between gap-4">
          <h2 class="text-body font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
export default () => [
  <Frame {...frame("layout", "shell")}>
    <Panel>
      <Section title="本机用量" />
    </Panel>
  </Frame>,
];
