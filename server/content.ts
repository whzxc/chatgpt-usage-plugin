import { text, time, hash, type Json } from "./common.js";
export function readTurnContent(
  threadId: string,
  turnId: string,
  visitRecords: (
    threadId: string,
    turnId: string | null,
    toolId: string | null,
    visit: (record: Json) => void,
  ) => void,
): Json {
  let turn: string | null = turnId;
  const entries = new Map<string, Json>(),
    messages = new Map<string, Json>();
  visitRecords(threadId, turnId, null, (record) => {
    const p = record.payload ?? {},
      kind = record.type;
    if (
      kind === "turn_context" ||
      (kind === "event_msg" && p.type === "task_started")
    )
      turn = text(p, "turn_id");
    if (typeof p.thread_id === "string" && p.thread_id !== threadId) return;
    if (
      (text(p, "turn_id") ??
        text(p.internal_chat_message_metadata_passthrough, "turn_id") ??
        turn) !== turnId
    )
      return;
    const at = time(record.timestamp);
    if (
      kind === "response_item" &&
      p.type === "message" &&
      p.role === "assistant"
    ) {
      const body = (Array.isArray(p.content) ? p.content : [])
        .filter(
          (part: Json) =>
            part.type === "output_text" && typeof part.text === "string",
        )
        .map((part: Json) => part.text)
        .join("\n\n");
      if (body.trim() && at !== null) {
        const id = text(p, "id") ?? hash(`${turnId}:${at}:${body}`);
        if (!messages.has(id)) messages.set(id, { id, turnId, at, text: body });
      }
      return;
    }
    const completed =
      kind === "event_msg" &&
      p.type === "item_completed" &&
      p.item?.type === "Reasoning";
    if (!completed && !(kind === "response_item" && p.type === "reasoning"))
      return;
    const item = completed ? p.item : p,
      parts = completed ? item.summary_text : item.summary;
    const body = (Array.isArray(parts) ? parts : [])
      .map((part: any) => (completed ? part : part.text))
      .filter((s: any) => typeof s === "string" && s.trim())
      .join("\n\n");
    if (!body || at === null) return;
    const id = text(item, "id") ?? hash(`${turnId}:${at}:${body}`),
      entry = entries.get(id) ?? { id, turnId, at, text: body };
    if (
      completed &&
      Number.isSafeInteger(p.started_at_ms) &&
      Number.isSafeInteger(p.completed_at_ms) &&
      p.completed_at_ms >= p.started_at_ms
    ) {
      entry.at = p.started_at_ms;
      entry.durationMs = p.completed_at_ms - p.started_at_ms;
    }
    entries.set(id, entry);
  });
  return {
    reasoning: [...entries.values()].sort(
      (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1),
    ),
    messages: [...messages.values()].sort((a, b) => a.at - b.at),
  };
}
