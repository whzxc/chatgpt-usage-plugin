import { z } from "zod";
const n = z.number(),
  nullable = n.nullable(),
  str = z.string().nullable();
const index = z.object({
  state: z.enum(["ready", "indexing", "unavailable"]),
  processed: n,
  total: n,
  reason: str,
});
const totals = z.object({
  tokens: nullable,
  input: nullable,
  cached: nullable,
  output: nullable,
  cost: nullable,
  costIncomplete: z.boolean(),
  requests: n,
});
const performance = {
  outputTps: nullable,
  ttftMedianMs: nullable,
  ttftP90Ms: nullable,
  ttftP99Ms: nullable,
  ttftTurns: n,
};
export const range = z.enum(["today", "7d", "30d"]);
const id = z.string().min(1).max(128);
const turn = z
  .object({
    turnId: z.string(),
    sequence: n,
    prompt: str,
    scheduled: z.boolean(),
    serviceTier: str,
    startedAt: nullable,
    durationMs: nullable,
    ttftMs: nullable,
    outputTps: nullable,
    status: z.string(),
    compacted: z.boolean(),
  })
  .extend(totals.shape);
const toolBody = z.object({
  text: str,
  bytes: nullable,
  truncated: z.boolean(),
});
const context = z.object({
  used: nullable,
  window: nullable,
  parts: z.array(
    z.object({
      kind: z.enum([
        "toolResults",
        "reasoning",
        "toolCalls",
        "compaction",
        "messages",
        "fixed",
      ]),
      tokens: n,
      details: z.array(z.object({ name: z.string(), tokens: n })).optional(),
    }),
  ),
});
export const dataTools = {
  usage_summary: {
    input: z.object({ range }).strict(),
    output: z.object({
      totals: totals.extend({ tasks: n, ...performance }),
      models: z.array(
        z.object({
          id: z.string(),
          slot: n,
          outputTps: nullable,
          tokens: nullable,
          cost: nullable,
          requests: n,
        }),
      ),
      buckets: z.array(
        z.object({
          at: n,
          models: z.array(
            z.object({ id: z.string(), tokens: nullable, cost: nullable }),
          ),
        }),
      ),
      index,
    }),
  },
  usage_tasks: {
    input: z
      .object({
        range,
        sort: z.enum(["recent", "cost", "tokens"]),
        query: z.string().max(200).optional(),
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(100).default(10),
      })
      .strict(),
    output: z.object({
      total: n,
      page: n,
      pageSize: n,
      tasks: z.array(
        z.object({
          threadId: z.string(),
          title: str,
          turns: nullable,
          requests: n,
          tokens: nullable,
          input: nullable,
          cached: nullable,
          cost: nullable,
          outputTps: nullable,
          ttftMedianMs: nullable,
          lastActivity: nullable,
          running: z.boolean(),
        }),
      ),
      index,
    }),
  },
  usage_quota: {
    input: z.object({ refresh: z.boolean().optional() }).strict(),
    output: z.object({
      plan: str,
      credits: nullable,
      availableResets: nullable,
      windows: z.array(
        z.object({
          id: z.string(),
          durationMinutes: nullable,
          usedPercent: n,
          resetsAt: nullable,
          elapsedPercent: nullable,
          exhaustsAt: nullable,
          cycleUsd: nullable,
          cycleIncomplete: z.boolean(),
        }),
      ),
      state: z.string(),
      reason: str,
      observedAt: nullable,
    }),
  },
  usage_thread: {
    input: z.object({ threadId: id.optional() }).strict(),
    output: z.object({
      thread: z
        .object({
          threadId: z.string(),
          title: str,
          model: str,
          models: z.array(z.string()),
          serviceTier: str,
          lastActivity: nullable,
          running: z.boolean(),
          totals: totals.extend({
            turns: n,
            tools: n,
            ...performance,
            ttftMaxMs: nullable,
          }),
          contextWindow: nullable,
          context,
          requestInputs: z.array(nullable),
          requestDetails: z.array(z.tuple([n, nullable, nullable])),
          turnStarts: z.array(
            z.object({ turnId: z.string(), requestSequence: nullable }),
          ),
          compactions: z.array(
            z.object({
              turnId: str,
              at: nullable,
              requestSequence: nullable,
              beforeTokens: nullable,
              afterTokens: nullable,
            }),
          ),
          turns: z.array(turn),
        })
        .nullable(),
      index,
      reason: str,
    }),
  },
  usage_turn: {
    input: z
      .object({
        threadId: id,
        turnId: id,
        offset: z.number().int().nonnegative().default(0),
        limit: z.number().int().min(1).max(100).default(100),
      })
      .strict(),
    output: z.object({
      turn: z
        .object({
          turnId: z.string(),
          prompt: str,
          metrics: z.object({
            cost: nullable,
            tokens: nullable,
            cachePercent: nullable,
            output: nullable,
            durationMs: nullable,
            ttftMs: nullable,
            outputTps: nullable,
            context: z.object({
              start: nullable,
              end: nullable,
              limit: nullable,
            }),
          }),
          timeline: z.array(
            z.union([
              z.object({
                kind: z.literal("tool"),
                toolId: z.string(),
                name: str,
                at: n,
                preview: str,
                outputBytes: nullable,
              }),
              z.object({
                kind: z.literal("request"),
                id: z.string(),
                sequence: n,
                at: n,
                input: nullable,
                output: nullable,
                cost: nullable,
                tools: z.array(
                  z.object({
                    toolId: z.string(),
                    name: str,
                    preview: str,
                    outputBytes: nullable,
                  }),
                ),
              }),
              z.object({
                kind: z.enum(["reply", "reasoning"]),
                id: z.string(),
                at: n,
                summary: z.string(),
                durationMs: nullable,
              }),
            ]),
          ),
          timelineTotal: n,
          requestTotal: n,
          nextOffset: nullable,
          offset: n,
          limit: n,
        })
        .nullable(),
      index,
      reason: str,
    }),
  },
  usage_tool: {
    input: z
      .object({ threadId: id, toolId: z.string().min(1).max(256) })
      .strict(),
    output: z.object({
      tool: z
        .object({
          toolId: z.string(),
          name: str,
          at: n,
          durationMs: nullable,
          input: toolBody,
          output: toolBody,
          exitCode: nullable,
        })
        .nullable(),
      index,
      reason: str,
    }),
  },
};

export const overviewInitial = z.object({
  range,
  summary: dataTools.usage_summary.output,
  tasks: dataTools.usage_tasks.output,
  quota: dataTools.usage_quota.output,
});
export const taskInitial = dataTools.usage_thread.output;
