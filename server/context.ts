import type { Json } from "./common.js";

export const contextKinds = [
  "toolResults",
  "reasoning",
  "toolCalls",
  "compaction",
  "messages",
] as const;
type Kind = (typeof contextKinds)[number];
const empty = (): Record<Kind, number> => ({
  toolResults: 0,
  reasoning: 0,
  toolCalls: 0,
  compaction: 0,
  messages: 0,
});
export const freshContext = () => ({
  used: null as number | null,
  at: 0,
  world: false,
  fixed: { system: 0, tools: 0, skills: 0, environment: 0 },
  parts: empty(),
  pending: empty(),
  replacement: null as number | null,
});
export type ContextState = ReturnType<typeof freshContext>;

// Only relative text weights, never a substitute for the observed input total.
export function estimate(value: unknown): number {
  if (typeof value === "string") {
    const runs = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g;
    let cjk = 0,
      match;
    while ((match = runs.exec(value))) cjk += match[0].length;
    return cjk * 0.75 + (value.length - cjk) / 3.8;
  }
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce<number>((n, v) => n + estimate(v), 0);
}
export function ingestContext(s: ContextState, record: Json, thread: string) {
  const p = record.payload ?? {};
  if (record.type === "session_meta" && s.used === null)
    s.fixed.system = estimate(p.base_instructions?.text ?? p.base_instructions);
  if (record.type === "world_state" && p.full && !s.world) {
    s.world = true;
    const { host_skills, agents_md, tools, ...environment } = p.state ?? {};
    s.fixed.skills = estimate(host_skills?.body);
    s.fixed.system += estimate(agents_md) + estimate(tools);
    s.fixed.environment = estimate(environment);
  }
  if (record.type === "turn_context" && s.used === null)
    s.fixed.environment += estimate(
      p.collaboration_mode?.settings?.developer_instructions,
    );
  if (record.type === "compacted") {
    s.replacement =
      p.replacement_tokens ?? estimate(p.replacement_history ?? p.message);
    s.pending = empty();
  }
  if (record.type === "response_item") {
    const kind: Kind | undefined =
      p.type === "reasoning"
        ? "reasoning"
        : ["function_call", "custom_tool_call"].includes(p.type)
          ? "toolCalls"
          : ["function_call_output", "custom_tool_call_output"].includes(p.type)
            ? "toolResults"
            : p.type === "message"
              ? "messages"
              : undefined;
    if (kind) s.pending[kind] += estimate(p);
  }
  if (record.type !== "token_usage_record" || p.thread_id !== thread) return;
  const used = p.usage?.input_tokens;
  if (!Number.isSafeInteger(used) || used < 0) return;
  const pending = Object.values(s.pending).reduce((a, b) => a + b, 0);
  let baseline = s.used;
  if (s.replacement != null) {
    s.parts = empty();
    s.parts.compaction = s.replacement;
    baseline =
      Object.values(s.fixed).reduce((a, b) => a + b, 0) + s.replacement;
    s.replacement = null;
  }
  if (baseline === null) {
    s.fixed.tools = Math.max(
      0,
      used - Object.values(s.fixed).reduce((a, b) => a + b, 0) - pending,
    );
    s.parts = { ...s.pending };
  } else {
    const delta = used - baseline;
    if (delta >= 0 && pending > 0) {
      for (const kind of contextKinds)
        s.parts[kind] += (delta * s.pending[kind]) / pending;
    } else if (delta >= 0) s.fixed.environment += delta;
    else {
      const fixed = Object.values(s.fixed).reduce((a, b) => a + b, 0);
      const dynamic = Object.values(s.parts).reduce((a, b) => a + b, 0);
      const ratio = dynamic ? Math.max(0, used - fixed) / dynamic : 0;
      for (const kind of contextKinds) s.parts[kind] *= ratio;
    }
  }
  // Largest-remainder rounding guarantees exact allocation even at resets.
  const values = [
    ...contextKinds.map((k) => s.parts[k]),
    ...Object.values(s.fixed),
  ];
  const sum = values.reduce((a, b) => a + b, 0);
  const scaled = values.map((n) => (sum ? (n * used) / sum : 0));
  const rounded = scaled.map(Math.floor);
  const order = scaled
    .map((n, i) => ({ i, fraction: n - rounded[i] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (
    let left = used - rounded.reduce((a, b) => a + b, 0), i = 0;
    i < left;
    i++
  )
    rounded[order[i % order.length].i]++;
  contextKinds.forEach((k, i) => (s.parts[k] = rounded[i]));
  (Object.keys(s.fixed) as (keyof ContextState["fixed"])[]).forEach(
    (k, i) => (s.fixed[k] = rounded[i + contextKinds.length]),
  );
  s.used = used;
  s.at = Date.parse(record.timestamp) || 0;
  s.pending = empty();
}
