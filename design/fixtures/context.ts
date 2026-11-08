import { primaryTurns, models } from "../scenes/usage";
export const contextCalls = primaryTurns.flatMap((turn, t) =>
  models(turn.calls).map((c, i) => ({
    ...c,
    id: `ctx-${t}-${i}`,
    turn: turn.sequence,
    sequence: t * models(turn.calls).length + i + 1,
  })),
);
export const compaction = {
  sequence: contextCalls.findIndex((c) => c.turn === 4) + 1,
  before: contextCalls.filter((c) => c.turn === 3).at(-1)!.input!,
  after: contextCalls.find((c) => c.turn === 4)!.input!,
};
export const currentInput = contextCalls.at(-1)!.input!;
export const contextWeights = [
  { label: "工具结果", weight: 40, tone: "bg-model-primary" },
  { label: "推理", weight: 18, tone: "bg-model-secondary" },
  { label: "工具调用", weight: 12, tone: "bg-tool" },
  { label: "压缩摘要", weight: 14, tone: "bg-context-compaction" },
  { label: "对话消息", weight: 10, tone: "bg-context-messages" },
  { label: "固定开销", weight: 6, tone: "bg-context-fixed" },
];
export const contextParts = contextWeights.map((p) => ({
  ...p,
  tokens:
    (currentInput * p.weight) /
    contextWeights.reduce((s, p) => s + p.weight, 0),
}));
export const fixedDetails = [
  { name: "指令", weight: 3 },
  { name: "技能", weight: 2 },
  { name: "环境", weight: 1 },
].map((p) => ({ ...p, tokens: (contextParts.at(-1)!.tokens * p.weight) / 6 }));
