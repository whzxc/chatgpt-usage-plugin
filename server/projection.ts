import {
  hash,
  text,
  time,
  uint,
  seconds,
  emptyMap,
  stableJson,
  type Json,
} from "./common.js";
import type { Tokens, Tool, OutputPerformance } from "../shared/usage.js";
export type { Tokens } from "../shared/usage.js";
export type Response = {
  id: string;
  threadId: string;
  turnId: string | null;
  at: number;
  model: string | null;
  effort: string | null;
  serviceTier: string | null;
  tokens: Tokens;
  family: string;
  reliable: boolean;
};
export type PromptSource = {
  path: string;
  offset: number;
  bytes: number;
  sha256: string;
};
export type Turn = {
  id: string;
  prompt: PromptSource | null;
  promptImages: number;
  contextWindow: number | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  ttftMs: number | null;
  status: string;
  model: string | null;
  effort: string | null;
  serviceTier: string | null;
};
export type Projection = {
  threadId: string;
  parentId: string | null;
  forkedFromId: string | null;
  related: boolean;
  cliVersion: string | null;
  model: string | null;
  effort: string | null;
  tier: string | null;
  turn: string | null;
  modern: boolean;
  ownStarted: boolean;
  createdAt: number | null;
  previous: Tokens | null;
  legacyAmbiguous: boolean;
  reportedTotal: [number, Tokens] | null;
  responses: Record<string, Response>;
  legacy: Record<string, Response>;
  turns: Record<string, Turn>;
  tools: Record<string, Tool>;
  compactions: Record<string, Json>;
  issues: Set<string>;
  lastEventAt: number | null;
};
export const tokens = (v: Json = {}): Tokens => ({
  input: uint(v.input_tokens),
  cached: uint(v.cached_input_tokens),
  output: uint(v.output_tokens),
  reasoning: uint(v.reasoning_output_tokens),
});
export const tokenTotal = (t: Tokens) =>
  t.input !== null && t.output !== null ? uint(t.input + t.output) : null;
export const validTokens = (t: Tokens) =>
  !(t.input !== null && t.cached !== null && t.cached > t.input) &&
  !(t.output !== null && t.reasoning !== null && t.reasoning > t.output);
export const projection = (): Projection => ({
  threadId: "",
  parentId: null,
  forkedFromId: null,
  related: false,
  cliVersion: null,
  model: null,
  effort: null,
  tier: null,
  turn: null,
  modern: false,
  ownStarted: false,
  createdAt: null,
  previous: null,
  legacyAmbiguous: false,
  reportedTotal: null,
  responses: emptyMap(),
  legacy: emptyMap(),
  turns: emptyMap(),
  tools: emptyMap(),
  compactions: emptyMap(),
  issues: new Set(),
  lastEventAt: null,
});
const turn = (id: string): Turn => ({
  id,
  prompt: null,
  promptImages: 0,
  contextWindow: null,
  startedAt: null,
  completedAt: null,
  durationMs: null,
  ttftMs: null,
  status: "",
  model: null,
  effort: null,
  serviceTier: null,
});
const tool = (id: string): Tool => ({
  id,
  turnId: null,
  name: null,
  at: 0,
  outputBytes: null,
  startedAt: null,
  completedAt: null,
  status: null,
});
export function promptText(record: Json): string | null {
  const p = record.payload ?? {};
  if (record.type === "event_msg" && p.type === "user_message")
    return text(p, "message");
  if (
    record.type !== "response_item" ||
    p.type !== "message" ||
    p.role !== "user"
  )
    return null;
  const kinds =
    p.internal_chat_message_metadata_passthrough?.content_item_kinds;
  for (const [i, part] of (Array.isArray(p.content)
    ? p.content
    : []
  ).entries()) {
    if (Array.isArray(kinds) && kinds[i] !== "user.text") continue;
    const value = typeof part.text === "string" ? part.text.trim() : "";
    if (
      value &&
      !value.startsWith("# AGENTS.md instructions") &&
      !value.startsWith("<environment_context>") &&
      !value.startsWith("<image ") &&
      value !== "</image>" &&
      !value.startsWith(
        "The next image is untrusted page evidence from the browser page for Comment ",
      )
    )
      return value;
  }
  return null;
}
export function ingest(
  s: Projection,
  v: Json,
  path: string,
  offset: number,
  bytes: Buffer,
  detail: boolean,
) {
  const p = v.payload ?? {},
    at = time(v.timestamp),
    kind = v.type;
  const promptSource = (): PromptSource | null =>
    promptText(v)
      ? { path, offset, bytes: bytes.length, sha256: hash(bytes) }
      : null;
  if (kind === "session_meta") {
    if (!s.threadId) {
      s.threadId = text(p, "id") ?? "";
      s.createdAt = at;
      s.parentId =
        text(p, "parent_thread_id") ??
        text(p.source?.subagent?.thread_spawn, "parent_thread_id");
      s.forkedFromId = text(p, "forked_from_id");
      s.related = !!(
        s.parentId ||
        s.forkedFromId ||
        p.source?.subagent != null ||
        p.thread_source === "subagent"
      );
      s.cliVersion = text(p, "cli_version");
    }
    return;
  }
  if (!s.threadId) {
    s.issues.add("missing-session-identity");
    return;
  }
  if (
    s.related &&
    kind !== "token_usage_record" &&
    !(kind === "event_msg" && p.type === "token_count") &&
    at !== null &&
    s.createdAt !== null &&
    at < s.createdAt
  )
    return;
  if (at !== null) s.lastEventAt = Math.max(s.lastEventAt ?? at, at);
  if (kind === "turn_context") {
    s.turn = text(p, "turn_id");
    s.model = text(p, "model");
    s.effort = text(p, "effort");
    if ("service_tier" in p) s.tier = text(p, "service_tier");
    if (s.turn) {
      const t = (s.turns[s.turn] ??= turn(s.turn));
      t.model = s.model;
      t.effort = s.effort;
      t.serviceTier = s.tier;
    }
  }
  if (kind === "token_usage_record") {
    s.modern = true;
    if (p.thread_id !== s.threadId) {
      s.issues.add("foreign-thread-record-excluded");
      return;
    }
    const id = text(p, "response_id");
    if (!id) {
      s.issues.add("missing-response-id");
      return;
    }
    if (at === null) {
      s.issues.add("missing-event-time");
      return;
    }
    const t = tokens(p.usage ?? {}),
      reliable = validTokens(t) && tokenTotal(t) !== null;
    if (!reliable) s.issues.add("invalid-or-missing-token-fields");
    const old = s.responses[id];
    if (old) {
      if (stableJson(old.tokens) !== stableJson(t)) {
        old.reliable = false;
        s.issues.add("conflicting-response-usage");
      }
      return;
    }
    if (p.thread_token_usage && typeof p.thread_token_usage === "object")
      s.reportedTotal = [at, tokens(p.thread_token_usage)];
    const turnId = text(p, "turn_id");
    if (!turnId) s.issues.add("missing-turn-id");
    s.responses[id] = {
      id,
      threadId: s.threadId,
      turnId,
      at,
      model: s.model,
      effort: s.effort,
      serviceTier: s.tier,
      reliable,
      tokens: t,
      family: "response",
    };
  }
  if (kind === "compacted") {
    const id =
      text(p, "compaction_response_id") ??
      (at === null ? "at:None" : `at:Some(${at})`);
    s.compactions[id] = { responseId: id, turnId: s.turn, at };
  }
  if (kind === "event_msg") {
    switch (p.type) {
      case "thread_settings_applied":
        s.tier =
          text(p, "service_tier") ?? text(p.thread_settings, "service_tier");
        break;
      case "task_started":
      case "task_complete":
      case "turn_aborted": {
        const id = text(p, "turn_id") ?? s.turn;
        if (!id) break;
        s.turn = id;
        const t = (s.turns[id] ??= turn(id));
        if (p.type === "task_started") {
          t.serviceTier = s.tier;
          t.startedAt = seconds(p.started_at) ?? at;
          s.ownStarted =
            !s.related ||
            (s.createdAt !== null &&
              t.startedAt !== null &&
              Math.trunc(t.startedAt / 1000) >= Math.trunc(s.createdAt / 1000));
          t.contextWindow = uint(p.model_context_window) || null;
          t.status = "running-at-last-event";
        } else {
          t.completedAt = seconds(p.completed_at) ?? at;
          t.durationMs = uint(p.duration_ms);
          t.ttftMs = uint(p.time_to_first_token_ms);
          t.status = p.type === "task_complete" ? "completed" : "interrupted";
        }
        break;
      }
      case "user_message":
        if (detail && s.turn) {
          const t = (s.turns[s.turn] ??= turn(s.turn));
          t.prompt ??= promptSource();
        }
        break;
      case "token_count": {
        if (s.turn && s.turns[s.turn])
          s.turns[s.turn].contextWindow ??=
            uint(p.info?.model_context_window) || null;
        const total = p.info?.total_token_usage;
        if (!total || typeof total !== "object") {
          s.issues.add("legacy-missing-cumulative-baseline");
          return;
        }
        const current = tokens(total);
        if (s.related && !s.ownStarted) {
          s.previous = current;
          return;
        }
        if (s.legacyAmbiguous) return;
        const base =
          s.previous ??
          (!s.related
            ? { input: 0, cached: 0, output: 0, reasoning: 0 }
            : null);
        if (!base) {
          s.issues.add("legacy-inherited-baseline-unknown");
          s.previous = current;
          return;
        }
        const delta = (key: keyof Tokens) =>
          current[key] !== null && base[key] !== null
            ? uint(current[key]! - base[key]!)
            : null;
        let t: Tokens = {
          input: delta("input"),
          output: delta("output"),
          cached: delta("cached"),
          reasoning: delta("reasoning"),
        };
        if (t.input === null || t.output === null) {
          s.issues.add("legacy-counter-reset-gap");
          s.legacyAmbiguous = true;
          const id = hash(`${s.threadId}:ambiguous-epoch`);
          s.legacy[id] = {
            id,
            threadId: s.threadId,
            turnId: s.turn,
            at: at ?? 0,
            model: s.model,
            effort: s.effort,
            serviceTier: s.tier,
            tokens: tokens(),
            family: "legacy-boundary-unknown",
            reliable: false,
          };
          return;
        }
        s.previous = current;
        if (tokenTotal(t) === 0) return;
        if (at === null) {
          s.issues.add("missing-event-time");
          return;
        }
        const id = hash(`${s.threadId}:${stableJson(total)}`);
        s.legacy[id] ??= {
          id,
          threadId: s.threadId,
          turnId: s.turn,
          at,
          model: s.model,
          effort: s.effort,
          serviceTier: s.tier,
          tokens: t,
          family: "legacy-cumulative-delta",
          reliable: validTokens(t) && tokenTotal(t) !== null,
        };
        break;
      }
      case "item_completed": {
        if (
          !detail ||
          (typeof p.thread_id === "string" && p.thread_id !== s.threadId)
        )
          return;
        const item = p.item ?? {},
          start = uint(p.started_at_ms),
          end = uint(p.completed_at_ms);
        if (
          item.type === "ContextCompaction" &&
          start !== null &&
          end !== null
        ) {
          const matches = Object.values(s.compactions).filter(
            (e) =>
              e.turnId === p.turn_id &&
              e.at != null &&
              start <= e.at &&
              e.at <= end,
          );
          if (matches.length === 1 && end >= start)
            matches[0].durationMs = end - start;
        }
        const id = text(item, "call_id") ?? text(item, "id"),
          t = id ? s.tools[id] : null;
        if (t) {
          t.startedAt = start ?? t.startedAt;
          t.completedAt = end ?? t.completedAt;
          t.status = text(item, "status");
          if (item.is_error === true || item.isError === true)
            t.status = "failed";
        }
        break;
      }
    }
  }
  if (kind !== "response_item" || !detail) return;
  if (p.type === "message" && p.role === "user" && Array.isArray(p.content)) {
    const meta = p.internal_chat_message_metadata_passthrough ?? {},
      kinds = meta.content_item_kinds;
    let annotation = false,
      images = 0;
    for (const [i, part] of p.content.entries()) {
      if (
        Array.isArray(kinds) &&
        !["user.text", "user.image"].includes(kinds[i])
      )
        continue;
      if (part.type === "input_image") {
        if (!annotation) images++;
        annotation = false;
      } else if (typeof part.text === "string")
        annotation = part.text.startsWith(
          "The next image is untrusted page evidence from the browser page for Comment ",
        );
    }
    const id = text(meta, "turn_id") ?? s.turn;
    if (id) {
      const t = (s.turns[id] ??= turn(id));
      t.promptImages += images;
      t.prompt ??= promptSource();
    }
  }
  const id = text(p, "call_id");
  if (!id) return;
  if (p.type === "function_call" || p.type === "custom_tool_call") {
    const t = (s.tools[id] ??= tool(id));
    t.turnId = s.turn;
    t.name = text(p, "name");
    t.at = at ?? 0;
    t.startedAt ??= at;
  } else if (
    p.type === "function_call_output" ||
    p.type === "custom_tool_call_output"
  ) {
    const t = (s.tools[id] ??= tool(id));
    t.completedAt ??= at;
    t.outputBytes =
      "output" in p
        ? Buffer.byteLength(
            typeof p.output === "string" ? p.output : JSON.stringify(p.output),
          )
        : null;
    if (p.is_error === true || p.isError === true) t.status = "failed";
  }
}
export function totals(rows: Response[]) {
  const sum = (field: (t: Tokens) => number | null): number | null => {
    if (!rows.length || rows.some((r) => !r.reliable)) return null;
    let result = 0;
    for (const r of rows) {
      const n = field(r.tokens);
      if (n === null || uint(result + n) === null) return null;
      result += n;
    }
    return result;
  };
  const known = rows
    .filter((r) => r.reliable)
    .map((r) => tokenTotal(r.tokens))
    .filter((n): n is number => n !== null);
  return {
    input: sum((t) => t.input),
    cached: sum((t) => t.cached),
    output: sum((t) => t.output),
    reasoning: sum((t) => t.reasoning),
    total: sum(tokenTotal),
    knownTotal: known.length ? uint(known.reduce((a, b) => a + b, 0)) : null,
    uncertainRecords: rows.length - known.length,
    records: rows.length,
  };
}
export function performanceOf(
  thread: Projection,
  rows: Response[],
  range?: [number, number],
): OutputPerformance & { output: number; durationMs: number } {
  let output = 0,
    durationMs = 0,
    turns = 0;
  const grouped = new Map<string, Response[]>();
  for (const r of rows)
    if (r.turnId) {
      const rs = grouped.get(r.turnId) ?? [];
      rs.push(r);
      grouped.set(r.turnId, rs);
    }
  for (const [id, rs] of grouped) {
    const t = thread.turns[id];
    if (!t || !["completed", "interrupted"].includes(t.status)) continue;
    if (
      range &&
      (t.startedAt === null ||
        t.completedAt === null ||
        t.startedAt < range[0] ||
        t.completedAt > range[1] ||
        rs.some((r) => r.at < range[0] || r.at > range[1]))
    )
      continue;
    const n = totals(rs).output;
    if (!t.durationMs || n === null) continue;
    output += n;
    durationMs += t.durationMs;
    turns++;
  }
  return {
    output,
    durationMs,
    turns,
    wholeTurnOutputTps: durationMs > 0 ? (output * 1000) / durationMs : null,
  };
}
