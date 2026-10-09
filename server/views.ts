import type { Metrics } from "../shared/usage.js";
import {
  version,
  sortedValues,
  text,
  time,
  hash,
  localDay,
  rangeStart,
  type Json,
} from "./common.js";
import { Collector, lines, readPrompt } from "./collector.js";
import {
  type Response,
  type Projection,
  totals,
  performanceOf,
  promptText,
} from "./projection.js";
import { Pricing } from "./pricing.js";
const rowsOf = (t: Projection) =>
  sortedValues(t.modern ? t.responses : t.legacy);
const perValue = (p: ReturnType<typeof performanceOf>) => ({
  wholeTurnOutputTps: p.wholeTurnOutputTps,
  turns: p.turns,
});
export class Views {
  constructor(
    readonly collector: Collector,
    readonly pricing: Pricing,
  ) {}
  metrics(rows: Response[]): Metrics {
    const prices = rows
      .map((r) => this.pricing.estimate(r))
      .filter((n): n is number => n !== null);
    return {
      ...totals(rows),
      estimatedUsd:
        !prices.length && rows.length
          ? null
          : prices.reduce((a, b) => a + b, 0),
      unpricedRecords: rows.length - prices.length,
      requests: rows.filter((r) => r.family === "response").length,
    };
  }
  overview(days: number): Json {
    const c = this.collector,
      end = Date.now(),
      start = rangeStart(days, end),
      tasks: Json[] = [],
      events: Response[] = [],
      models = new Map<string, Response[]>(),
      daily = new Map<string, Response[]>(),
      series = new Map<string, Map<string, Response[]>>();
    let output = 0,
      durationMs = 0,
      turnCount = 0;
    const add = (map: Map<string, Response[]>, key: string, r: Response) => {
      const rs = map.get(key) ?? [];
      rs.push(r);
      map.set(key, rs);
    };
    for (const [id, t] of c.threads) {
      const rows = rowsOf(t),
        period = rows.filter((r) => r.at >= start && r.at <= end);
      events.push(...period);
      for (const r of period) {
        const model = r.model ?? "unknown",
          day = localDay(r.at),
          date = new Date(r.at),
          offset = -date.getTimezoneOffset(),
          sign = offset >= 0 ? "+" : "-",
          zone = `${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`,
          bucket =
            days === 1
              ? `${day}T${String(date.getHours()).padStart(2, "0")}:00:00${zone}`
              : day;
        add(models, model, r);
        add(daily, day, r);
        const group = series.get(bucket) ?? new Map();
        add(group, model, r);
        series.set(bucket, group);
      }
      const turns = new Set(
        period.flatMap((r) => (r.turnId ? [r.turnId] : [])),
      );
      for (const turn of Object.values(t.turns))
        if (
          [turn.startedAt, turn.completedAt].some(
            (at) => at !== null && at >= start && at <= end,
          )
        )
          turns.add(turn.id);
      const perf = performanceOf(t, rows, [start, end]);
      output += perf.output;
      durationMs += perf.durationMs;
      turnCount += perf.turns;
      tasks.push({
        id,
        label: c.titles.get(id) ?? null,
        lastEventAt: t.lastEventAt,
        period: {
          ...this.metrics(period),
          turns:
            t.lastEventAt !== null && t.lastEventAt < start
              ? 0
              : !Object.keys(t.turns).length &&
                  rows.every((r) => r.turnId === null)
                ? null
                : turns.size,
        },
        performance: perValue(perf),
        family: t.modern ? "response" : "legacy",
        issues: [...t.issues].sort(),
        parentId: t.parentId,
        forkedFromId: t.forkedFromId,
      });
    }
    tasks.sort((a, b) => (b.lastEventAt ?? 0) - (a.lastEventAt ?? 0));
    const sort = <T>(m: Map<string, T>) =>
      [...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return {
      schemaVersion: 1,
      pluginVersion: version,
      scope: "global",
      state: "ready",
      source: "local-native-jsonl",
      coverage:
        "this-device-readable-logs; account attribution unknown; child tasks separate",
      observedAt: c.observedAt,
      scanMs: c.scanMs,
      bytesRead: c.bytesRead,
      files: c.files.size,
      issues: [
        ...new Set([
          ...c.issues,
          ...[...c.threads.values()].flatMap((t) => [...t.issues]),
        ]),
      ].sort(),
      binding: "unknown",
      thread: null,
      tasks,
      taskCount: tasks.length,
      range: {
        start,
        end,
        days,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        startDay: localDay(start),
        endDay: localDay(end),
        kind: "event-time",
      },
      usage: this.metrics(events),
      performance: {
        wholeTurnOutputTps: durationMs ? (output * 1000) / durationMs : null,
        turns: turnCount,
      },
      models: sort(models).map(([name, rs]) => ({
        name,
        usage: this.metrics(rs),
      })),
      daily: sort(daily).map(([day, rs]) => ({ day, usage: this.metrics(rs) })),
      series: sort(series).map(([at, m]) => ({
        at,
        models: sort(m).map(([name, rs]) => ({
          name,
          usage: this.metrics(rs),
        })),
      })),
    };
  }
  visitRecords(threadId: string, visit: (v: Json) => void) {
    for (const source of this.collector.sources.get(threadId) ?? [])
      for (const line of lines(source)) {
        if (line.oversized || !line.complete) continue;
        let record: Json;
        try {
          record = JSON.parse(line.bytes.toString("utf8"));
        } catch {
          continue;
        }
        visit(record);
      }
  }
  turnContent(threadId: string, turnId: string): Json {
    let turn: string | null = null;
    const entries = new Map<string, Json>(),
      messages = new Map<string, Json>(),
      previews: Json = Object.create(null);
    this.visitRecords(threadId, (record) => {
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
          if (!messages.has(id))
            messages.set(id, { id, turnId, at, text: body });
        }
        return;
      }
      if (
        kind === "response_item" &&
        ["function_call", "custom_tool_call"].includes(p.type)
      ) {
        const id = text(p, "call_id");
        if (!id) return;
        let value = p.type === "function_call" ? p.arguments : p.input;
        if (typeof value === "string")
          try {
            value = JSON.parse(value);
          } catch {}
        const summary =
          ["title", "description", "cmd", "command", "query", "url", "path"]
            .map((k) => (typeof value?.[k] === "string" ? value[k] : null))
            .find(Boolean) ?? (typeof value === "string" ? value : null);
        if (summary?.trim())
          previews[id] = Array.from(summary.trim().replace(/\s+/g, " "))
            .slice(0, 240)
            .join("");
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
      toolPreviews: previews,
    };
  }
  toolDetail(args: Json): Json {
    const thread = this.collector.threads.get(args.threadId);
    if (!thread) throw new Error("thread-not-found");
    const tool = thread.tools[args.toolId];
    if (!tool) throw new Error("tool-not-found");
    if (typeof args.turnId === "string" && tool.turnId !== args.turnId)
      throw new Error("tool-turn-mismatch");
    let input: unknown = null,
      output: unknown = null;
    this.visitRecords(args.threadId, (record) => {
      const p = record.payload ?? {};
      if (record.type !== "response_item" || p.call_id !== args.toolId) return;
      if (p.type === "function_call") input = p.arguments ?? null;
      else if (p.type === "custom_tool_call") input = p.input ?? null;
      else if (
        ["function_call_output", "custom_tool_call_output"].includes(p.type)
      )
        output = p.output ?? null;
    });
    return { id: args.toolId, input, output };
  }
  snapshot(args: Json, meta: Json, scope: string): Json {
    const days = [1, 7, 30].includes(args.days) ? args.days : 7,
      overview = this.overview(days),
      search = (args.taskSearch ?? "").trim().toLowerCase();
    const tasks = overview.tasks.filter(
      (t: Json) =>
        !search ||
        (t.label ?? "").toLowerCase().includes(search) ||
        t.id.toLowerCase().includes(search),
    );
    const size = [5, 10, 20, 50, 100].includes(args.taskPageSize)
        ? args.taskPageSize
        : 10,
      page = Math.min(
        Math.max(1, args.taskPage ?? 1),
        Math.max(1, Math.ceil(tasks.length / size)),
      );
    const data: Json = {
      ...overview,
      taskMatchCount: tasks.length,
      taskPage: page,
      taskPageSize: size,
      tasks: tasks.slice((page - 1) * size, page * size),
      scope,
    };
    let binding = "unknown",
      candidate: string | null = null;
    const explicit = text(args, "threadId"),
      a = text(meta, "threadId"),
      b = text(meta, "thread_id");
    if (scope !== "global") {
      if (explicit) {
        binding = "selected";
        candidate = explicit;
      } else if (a && b && a !== b) binding = "conflict";
      else {
        binding = "host";
        candidate = a ?? b;
      }
    }
    const t = candidate ? this.collector.threads.get(candidate) : null;
    if (!t && binding !== "conflict") binding = "unknown";
    data.binding = binding;
    if (!t) return data;
    const rows = rowsOf(t),
      ordered = [...rows].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    const observation = (r: Response) => ({
      id: r.id,
      at: r.at,
      input: r.reliable && r.family === "response" ? r.tokens.input : null,
      model: r.model,
      contextWindow: r.turnId
        ? (t.turns[r.turnId]?.contextWindow ?? null)
        : null,
    });
    const previous = new Map(
      ordered.slice(1).map((r, i) => [r.id, observation(ordered[i])]),
    );
    const compactions = sortedValues(t.compactions).map((e) => ({
      ...e,
      before: ordered.findLast((r) => r.at <= (e.at ?? 0))
        ? observation(ordered.findLast((r) => r.at <= (e.at ?? 0))!)
        : null,
      after: ordered.find((r) => r.at > (e.at ?? 0))
        ? observation(ordered.find((r) => r.at > (e.at ?? 0))!)
        : null,
    }));
    const turnId = text(args, "turnId");
    const turns = sortedValues(t.turns)
      .filter((turn) => !turnId || turn.id === turnId)
      .map((turn) => {
        const rs = ordered.filter((r) => r.turnId === turn.id),
          usage = this.metrics(rs),
          value: Json = { ...turn, usage };
        try {
          value.prompt = turn.prompt
            ? promptText(readPrompt(turn.prompt))
            : null;
        } catch (error) {
          value.prompt = null;
          value.promptError = (error as Error).message;
        }
        value.contextStart = rs.length ? observation(rs[0]) : null;
        value.contextEnd = rs.length ? observation(rs.at(-1)!) : null;
        value.wholeTurnOutputTps =
          turn.durationMs && turn.durationMs > 0 && usage.output !== null
            ? (usage.output * 1000) / turn.durationMs
            : null;
        value.toolCount = Object.values(t.tools).filter(
          (tool) => tool.turnId === turn.id,
        ).length;
        return value;
      })
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    const responseRows = rows
        .filter((r) => !turnId || r.turnId === turnId)
        .sort((a, b) => b.at - a.at),
      tools = sortedValues(t.tools)
        .filter((tool) => !turnId || tool.turnId === turnId)
        .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    const offset = turnId ? 0 : (args.responseOffset ?? 0),
      toolOffset = turnId ? 0 : (args.toolOffset ?? 0),
      limit = turnId ? Infinity : 50;
    const responses = responseRows.slice(offset, offset + limit).map((r) => ({
      ...r,
      context: observation(r),
      previousContext: previous.get(r.id) ?? null,
      estimatedUsd: this.pricing.estimate(r),
    }));
    let content: Json = { reasoning: [], messages: [], toolPreviews: {} },
      contentError: string | null = null;
    try {
      if (turnId) content = this.turnContent(t.threadId, turnId);
    } catch (error) {
      contentError = (error as Error).message;
    }
    data.thread = {
      ...content,
      contentError,
      id: t.threadId,
      label: this.collector.titles.get(t.threadId) ?? null,
      cliVersion: t.cliVersion,
      usage: this.metrics(rows),
      performance: perValue(performanceOf(t, rows)),
      issues: [...t.issues].sort(),
      family: t.modern ? "response" : "legacy",
      lastEventAt: t.lastEventAt,
      turns,
      turnCount: Object.keys(t.turns).length,
      responses,
      responseCount: responseRows.length,
      tools: tools.slice(toolOffset, toolOffset + limit),
      toolCount: tools.length,
      compactions,
      parentId: t.parentId,
      forkedFromId: t.forkedFromId,
      children: [...this.collector.threads.values()]
        .filter((c) => c.parentId === t.threadId)
        .map((c) => c.threadId),
      credits: null,
      creditsState: "not-observed",
      resolvedModel: null,
      generationTps: null,
    };
    return data;
  }
}
