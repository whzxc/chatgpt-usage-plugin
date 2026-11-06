import { Frame } from "sdg";
import { frame, compact, percent } from "../scenes/format";
import { baseTurn } from "../scenes/usage";
import { contextParts, currentInput, fixedDetails } from "../scenes/context";
import { Panel, Section } from "./layout";
export function ContextAllocation({
  unknownLimit = false,
}: {
  unknownLimit?: boolean;
}) {
  const limit = unknownLimit ? null : baseTurn.limit!,
    parts = [
      ...contextParts,
      ...(limit === null
        ? []
        : [
            {
              label: "剩余空间",
              weight: 0,
              tone: "bg-border",
              tokens: Math.max(0, limit - currentInput),
            },
          ]),
    ],
    total = parts.reduce((s, p) => s + p.tokens, 0);
  return (
    <Section
      title="当前占用"
      actions={
        <span class="text-meta text-muted">
          {compact(currentInput)} / {compact(limit)} tokens
        </span>
      }
    >
      <div
        class="flex h-3 rounded-control overflow-hidden"
        role="img"
        aria-label="上下文估算分布"
      >
        {parts.map((p) => (
          <span
            class={p.tone}
            style={{ width: `${(p.tokens / total) * 100}%` }}
          />
        ))}
      </div>
      <div class="flex flex-col gap-3">
        {parts.map((p) => (
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-3 text-meta">
              <i class={`w-2 h-2 rounded-control ${p.tone}`} />
              <span>{p.label}</span>
              <span class="ml-auto">{compact(p.tokens)}</span>
              <span class="w-14 text-right text-muted">
                {percent(limit ? (p.tokens / limit) * 100 : null)}
              </span>
            </div>
            {p.label === "固定开销" && (
              <p class="text-meta text-muted pl-5">
                {fixedDetails
                  .map((p) => `${p.name} ${compact(p.tokens)}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
      <p class="text-meta text-muted">
        分类为估算，合计等于最近一次请求的输入。
      </p>
    </Section>
  );
}
export default () => [
  <Frame {...frame("context-allocation", "estimated")}>
    <Panel>
      <ContextAllocation />
    </Panel>
  </Frame>,
  <Frame {...frame("context-allocation", "unknown-capacity")}>
    <Panel>
      <ContextAllocation unknownLimit />
    </Panel>
  </Frame>,
];
