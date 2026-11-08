import {
  quotaForms,
  quotaWindows,
  quotaAccount,
} from "../../design/fixtures/quota";
// Fictional design-review records are projected into the production tool schema.
import {
  baseTurn,
  copy,
  history,
  primaryHistory,
  primaryTurns,
  totals,
  models,
  cost,
  variant,
  density,
  slowest,
} from "../../design/scenes/usage";
import type { Turn as SceneTurn, Call } from "../../design/scenes/usage";
import {
  contextCalls,
  compaction,
  contextParts,
  fixedDetails,
} from "../../design/fixtures/context";
import { longOutput } from "../../design/fixtures/tool-dialog";
import type {
  Summary,
  Tasks,
  Quota,
  Turn,
  TurnSummary,
  ThreadData,
  ToolData,
  TimelineRow,
  ContextPart,
} from "../../ui/shared/types";
export const reviewClock = Date.parse("2026-11-06T06:32:00Z");
// A longer fictional turn makes viewport-following and reduced motion reviewable.
export const scrollTurn: SceneTurn = {
  ...baseTurn,
  id: "fictional-scroll-turn",
  now: 360000,
  end: 360000,
  calls: Array.from({ length: 8 }, (_, index) =>
    baseTurn.calls.map((call) => ({
      ...call,
      id: `${call.id}-${index}`,
      parent: call.parent ? `${call.parent}-${index}` : undefined,
      start: call.start === null ? null : call.start + index * 45000,
      end: call.end === null ? null : call.end + index * 45000,
      at: call.at + index * 45000,
    })),
  ).flat(),
};
export const readyIndex = {
  state: "ready" as const,
  processed: history.length,
  total: history.length,
  reason: null,
};
const date = (day: string, hour = 0) =>
  Date.parse(
    `2026-${day.replace("/", "-")}T${String(hour).padStart(2, "0")}:00:00+08:00`,
  );
const sum = (entries: typeof history) => {
  const t = totals(entries.flatMap((h) => h.turn.calls)),
    times = entries
      .map((h) => h.turn.ttft)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b),
    mid = Math.floor(times.length / 2),
    seconds = entries.reduce(
      (s, h) => s + ((h.turn.end ?? h.turn.start) - h.turn.start) / 1000,
      0,
    );
  return {
    ...t,
    costIncomplete: t.cost === null,
    outputTps: seconds && t.output !== null ? t.output / seconds : null,
    ttftMedianMs: times.length
      ? times.length % 2
        ? times[mid]
        : (times[mid - 1] + times[mid]) / 2
      : null,
    ttftP90Ms: times[Math.max(0, Math.ceil(times.length * 0.9) - 1)] ?? null,
    ttftP99Ms: times[Math.max(0, Math.ceil(times.length * 0.99) - 1)] ?? null,
    ttftTurns: times.length,
  };
};
export function summaryData(
  form = "ready",
  hourly = false,
  single = false,
): Summary {
  const entries =
    form === "empty"
      ? []
      : form === "unpriced"
        ? history.map((h) => ({ ...h, turn: variant("unknown") }))
        : single
          ? primaryHistory
          : hourly
            ? history.filter((h) => h.day === "11/06")
            : history;
  const names = [
    ...new Set(
      entries.flatMap((h) => models(h.turn.calls).map((c) => c.model)),
    ),
  ];
  const keys = hourly
    ? Array.from({ length: 24 }, (_, i) => i)
    : [...new Set(history.map((h) => h.day))];
  return {
    totals: {
      ...sum(entries),
      tasks: new Set(entries.map((h) => h.task)).size,
    },
    models: names.map((id, i) => {
      const t = sum(
        entries.filter((h) => models(h.turn.calls)[0]?.model === id),
      );
      return {
        id,
        slot: i + 1,
        tokens: t.tokens,
        cost: t.cost,
        requests: t.requests,
        outputTps: t.outputTps,
      };
    }),
    buckets: keys.map((key) => ({
      at: typeof key === "number" ? date("11/06", key) : date(key),
      models: names.map((id) => {
        const t = totals(
          entries
            .filter((h) =>
              typeof key === "number" ? h.hour === key : h.day === key,
            )
            .flatMap((h) => h.turn.calls)
            .filter((c) => c.model === id),
        );
        return { id, tokens: t.tokens, cost: t.cost };
      }),
    })),
    index:
      form === "indexing"
        ? { ...readyIndex, state: "indexing", processed: history.length / 3 }
        : form === "unavailable"
          ? { ...readyIndex, state: "unavailable", reason: copy.failure }
          : readyIndex,
  };
}
export function tasksData(form = "ready"): Tasks {
  const entries =
    form === "unpriced"
      ? history.map((h) => ({ ...h, turn: variant("unknown") }))
      : history;
  return {
    index: readyIndex,
    page: 1,
    pageSize: 10,
    total: form === "search-empty" || form === "empty" ? 0 : 3,
    tasks:
      form === "search-empty" || form === "empty"
        ? []
        : [0, 1, 2].map((i) => {
            const records = entries.filter((h) => h.task === i),
              t = sum(records),
              last = records.at(-1)!;
            return {
              threadId: `fictional-task-${i}`,
              title:
                i === 0 && form === "selection-long"
                  ? copy.longTitle
                  : last.title,
              turns: records.length,
              requests: t.requests,
              tokens: t.tokens,
              input: t.input,
              cached: t.cached,
              cost: t.cost,
              outputTps: t.outputTps,
              ttftMedianMs: t.ttftMedianMs,
              lastActivity: date(last.day, last.hour),
              running: false,
            };
          }),
  };
}
export function quotaData(form = "ready"): Quota {
  const windows =
    form === "windows"
      ? quotaForms
      : form === "credits-and-exhaustion"
        ? quotaForms.slice(2)
        : quotaWindows;
  return {
    state:
      form === "indexing"
        ? "loading"
        : form === "quota-unavailable"
          ? "unavailable"
          : "ready",
    reason: form === "quota-unavailable" ? "账户不可用" : null,
    observedAt: reviewClock,
    plan: quotaAccount.plan,
    credits: form === "credits-and-exhaustion" ? quotaAccount.credits : null,
    availableResets:
      form === "credits-and-exhaustion" ? quotaAccount.availableResets : null,
    windows: windows.map((w, i) => ({
      id: `window-${i}`,
      durationMinutes: w.duration,
      usedPercent: w.used,
      resetsAt: w.duration === 300 ? date("11/06", 18) : date("11/09", 9),
      elapsedPercent: (w.elapsed / w.duration) * 100,
      exhaustsAt: null,
      cycleUsd: null,
      cycleIncomplete: false,
    })),
  };
}
export function turnSummary(scene: SceneTurn = baseTurn): TurnSummary {
  const t = totals(scene.calls),
    ms = scene.end === null ? null : scene.end - scene.start;
  return {
    ...t,
    costIncomplete: t.cost === null,
    turnId: scene.id,
    sequence: scene.sequence,
    prompt: scene.prompt,
    scheduled: !!scene.scheduled,
    serviceTier: null,
    startedAt: reviewClock - scene.now,
    durationMs: ms,
    ttftMs: scene.ttft,
    outputTps:
      (scene.state === "done" || scene.state === "interrupted") &&
      ms &&
      t.output !== null
        ? t.output / (ms / 1000)
        : null,
    status:
      scene.state === "running"
        ? "running-at-last-event"
        : scene.state === "done"
          ? "completed"
          : scene.state,
    compacted: !!scene.compacted,
  };
}
export function turnData(scene: SceneTurn = baseTurn): Turn {
  const origin = reviewClock - scene.now,
    t = totals(scene.calls),
    rs = models(scene.calls),
    slow = slowest(scene),
    summary = turnSummary(scene);
  const tool = (c: Call) => ({
    toolId: c.id,
    name: "exec_command",
    at: origin + c.at,
    preview: c.command ?? c.label,
    outputBytes:
      c.result === undefined ? null : new TextEncoder().encode(c.result).length,
    startedAt: c.start === null ? null : origin + c.start,
    completedAt: c.end === null ? null : origin + c.end,
    durationMs: c.start === null || c.end === null ? null : c.end - c.start,
    status: c.status === "done" ? "completed" : c.status,
  });
  const timeline: TimelineRow[] = rs.flatMap((c, i) => [
    {
      kind: "request" as const,
      id: c.id,
      sequence: i + 1,
      at: origin + (c.end ?? c.at),
      startedAt: c.start === null ? null : origin + c.start,
      input: c.input,
      cached: c.cached,
      output: c.output,
      reasoning: c.reasoning,
      tokens: c.input === null || c.output === null ? null : c.input + c.output,
      model: c.model,
      cost: cost(c),
      tools: scene.calls.filter((x) => x.parent === c.id).map(tool),
    },
    {
      kind: "reasoning" as const,
      id: `note-${c.id}`,
      at: origin + (c.start ?? c.at),
      summary: c.label,
      durationMs: null,
    },
    ...(c.id === "r2"
      ? [
          {
            kind: "reply" as const,
            id: `reply-${c.id}`,
            at: origin + (c.end ?? c.at),
            summary: copy.reply,
            durationMs: null,
          },
        ]
      : []),
  ]);
  const target = (c: Call) => ({
    id: `${c.kind === "model" ? "request" : "tool"}:${c.id}`,
    requests: rs.findIndex((r) => r.id === (c.parent ?? c.id)) + 1,
  });
  const end = scene.end ?? scene.now;
  return {
    turnId: scene.id,
    prompt: scene.prompt,
    metrics: {
      cost: t.cost,
      tokens: t.tokens,
      cachePercent: t.hit,
      output: t.output,
      durationMs: summary.durationMs,
      ttftMs: scene.ttft,
      outputTps: summary.outputTps,
      context: {
        start: rs[0]?.input ?? null,
        end: rs.at(-1)?.input ?? null,
        limit: scene.limit,
      },
    },
    calls: { tools: t.tools, failed: t.failed, model: rs[0]?.model ?? null },
    timeline,
    overview: {
      durationMs: end - scene.start,
      buckets: density(scene).map((b, i) => {
        const c = scene.calls.find(
          (c) =>
            Math.min(
              11,
              Math.floor(
                (((c.start ?? c.at) - scene.start) / (end - scene.start)) * 12,
              ),
            ) === i,
        );
        return {
          requests: b.models,
          tools: b.tools,
          target: c ? target(c) : null,
        };
      }),
      slowest: slow
        ? { at: slow.start ?? slow.at, target: target(slow) }
        : null,
    },
    slowestCall: slow
      ? { kind: slow.kind === "model" ? "request" : "tool", id: slow.id }
      : null,
    timelineTotal: timeline.length,
    requestTotal: rs.length,
    nextOffset: null,
    offset: 0,
    limit: 100,
  };
}
export function threadData(form = "ready"): ThreadData {
  const t = sum(primaryHistory),
    unknown = form === "unknown-capacity",
    parts: ContextPart["kind"][] = [
      "toolResults",
      "reasoning",
      "toolCalls",
      "compaction",
      "messages",
      "fixed",
    ];
  return {
    index:
      form === "indexing"
        ? { ...readyIndex, state: "indexing", processed: history.length / 3 }
        : form === "unavailable"
          ? { ...readyIndex, state: "unavailable", reason: copy.failure }
          : readyIndex,
    reason: null,
    thread:
      form === "empty"
        ? null
        : {
            threadId: "fictional-task-0",
            title: form === "long-title" ? copy.longTitle : copy.task,
            model: "gpt-6",
            models: ["gpt-6"],
            serviceTier: null,
            lastActivity: date("11/06", 14),
            running: false,
            totals: {
              ...t,
              turns: primaryTurns.length,
              ttftMaxMs: t.ttftP99Ms,
            },
            contextWindow: unknown ? null : baseTurn.limit,
            context: {
              used: contextCalls.at(-1)!.input,
              window: unknown ? null : baseTurn.limit,
              parts: contextParts.map((p, i) => ({
                kind: parts[i],
                tokens: p.tokens,
                ...(i === 5
                  ? {
                      details: fixedDetails.map((d) => ({
                        name: d.name,
                        tokens: d.tokens,
                      })),
                    }
                  : {}),
              })),
            },
            requestInputs: contextCalls.map((c, i) =>
              form === "missing-measurements" && i === 6 ? null : c.input,
            ),
            requestDetails: contextCalls.map((c) => [
              date("11/06", 14) + c.at,
              c.output,
              cost(c),
            ]),
            turnStarts: primaryTurns.map((turn, i) => ({
              turnId: turn.id,
              requestSequence: i * 4 + 1,
            })),
            compactions: [
              {
                turnId: primaryTurns[3].id,
                at: date("11/06", 14),
                requestSequence: compaction.sequence,
                beforeTokens: compaction.before,
                afterTokens: compaction.after,
              },
            ],
            turns: primaryTurns.map(turnSummary),
          },
  };
}
export function body(text: string | null) {
  const n = text === null ? null : new TextEncoder().encode(text).length;
  return {
    text: text === null ? null : text.slice(0, 16000),
    bytes: n,
    truncated: text !== null && text.length > 16000,
  };
}
export function toolData(form = "ready"): ToolData {
  const c = (form === "failed" ? variant("failed") : baseTurn).calls.find(
    (c) => c.id === "t2",
  )!;
  return {
    index: readyIndex,
    reason: null,
    tool: {
      toolId: "t2",
      name: "exec_command",
      at: reviewClock,
      durationMs: form === "unknown" ? null : 12000,
      input: body(form === "unknown" ? null : c.command!),
      output: body(
        form === "unknown" ? null : form === "long" ? longOutput : c.result!,
      ),
      exitCode: form === "unknown" ? null : form === "failed" ? 1 : 0,
    },
  };
}
