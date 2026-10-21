import assert from "node:assert/strict";
import { test } from "node:test";
import { traceSpans } from "./waterfall-model.ts";

const tool = (overrides = {}) => ({
  toolId: "tool-1",
  name: "example",
  at: 450,
  startedAt: 450,
  completedAt: 700,
  durationMs: 250,
  status: null,
  outputBytes: 4,
  preview: null,
  ...overrides,
});
const request = (overrides = {}) => ({
  kind: "request",
  id: "request-1",
  sequence: 1,
  at: 500,
  startedAt: 100,
  input: 100,
  cached: 50,
  output: 20,
  tokens: 120,
  reasoning: 10,
  model: "example",
  cost: 0.01,
  tools: [tool()],
  ...overrides,
});

test("measured reasoning uses its start, stays under its request, and tools remain distinct", () => {
  const spans = traceSpans(
    [
      {
        kind: "reasoning",
        id: "reason-1",
        at: 200,
        durationMs: 200,
        summary: "thinking",
      },
      request(),
      {
        kind: "reply",
        id: "reply-1",
        at: 510,
        durationMs: null,
        summary: "reply",
      },
    ],
    false,
  );
  assert.equal(spans.length, 2);
  assert.deepEqual(
    spans[0].children.map(({ id, start, end }) => ({ id, start, end })),
    [
      { id: "reasoning:reason-1", start: 200, end: 400 },
      { id: "tool:tool-1", start: 450, end: 700 },
    ],
  );
  assert.equal(spans[1].start, null);
  assert.equal(spans[1].elapsed, null);
});
test("only genuinely unfinished tools grow in a running turn", () => {
  const rows = [
    tool({
      toolId: "pending",
      completedAt: null,
      durationMs: null,
      outputBytes: null,
    }),
    tool({
      toolId: "failed",
      completedAt: null,
      durationMs: null,
      outputBytes: null,
      status: "failed",
    }),
    tool({ toolId: "missing-end", completedAt: null, durationMs: null }),
    tool({ toolId: "missing-start", startedAt: null, durationMs: null }),
  ].map((tool) => ({ kind: "tool", ...tool }));
  const spans = traceSpans(rows, true);
  assert.deepEqual(
    spans.map((s) => s.running),
    [true, false, false, false],
  );
  assert.equal(spans[1].failed, true);
  assert.equal(spans[3].start, null);
  assert.equal(spans[3].elapsed, null);
  assert.ok(traceSpans(rows, false).every((s) => !s.running));
});
test("loading later requests preserves earlier span identity and timing", () => {
  const first = request();
  const before = traceSpans([first], false);
  const after = traceSpans(
    [
      first,
      request({
        id: "request-2",
        sequence: 2,
        at: 900,
        startedAt: 700,
        tools: [],
      }),
    ],
    false,
  );
  assert.deepEqual(before[0], after[0]);
});
