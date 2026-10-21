import assert from "node:assert/strict";
import { test } from "node:test";
import {
  traceSpans,
  defaultExpanded,
  expandedByChoice,
  toolLabel,
  toolSummary,
} from "./waterfall-model.ts";

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
  assert.equal(spans.length, 1);
  assert.deepEqual(
    spans[0].children.map(({ id, start, end }) => ({ id, start, end })),
    [{ id: "tool:tool-1", start: 450, end: 700 }],
  );
  assert.equal(spans[0].label, "thinking");
  assert.deepEqual(
    spans[0].notes.map((n) => [n.kind, n.start, n.end]),
    [
      ["reasoning", 200, 400],
      ["reply", null, null],
    ],
  );
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

test("folded requests include late child tools in the viewport range", async () => {
  const { traceWindow } = await import("./waterfall-model.ts");
  const [span] = traceSpans([request()], false);
  assert.deepEqual(traceWindow(span, 100, false), {
    id: "request:request-1",
    start: 0,
    end: 400,
    running: false,
  });
  assert.deepEqual(traceWindow(span, 100, true), {
    id: "request:request-1",
    start: 0,
    end: 600,
    running: false,
  });
});
test("unowned reasoning and narration attach to the next request without adding tree rows", () => {
  const spans = traceSpans(
    [
      request({ tools: [] }),
      {
        kind: "reasoning",
        id: "gap",
        at: 650,
        durationMs: 100,
        summary: "**Next step**",
      },
      {
        kind: "reply",
        id: "reply",
        at: 780,
        durationMs: null,
        summary: "reply preview",
      },
      request({ id: "next", sequence: 2, startedAt: 800, at: 950, tools: [] }),
      {
        kind: "reply",
        id: "trailing",
        at: 960,
        durationMs: null,
        summary: "final",
      },
    ],
    false,
  );
  assert.equal(spans.length, 2);
  assert.equal(spans[0].notes.length, 0);
  assert.equal(spans[1].label, "Next step");
  assert.deepEqual(
    spans[1].notes.map((n) => n.id),
    ["reasoning:gap", "reply:reply", "reply:trailing"],
  );
  assert.equal(spans[1].children.length, 0);
});

test("default expansion has stable duration and ratio thresholds", () => {
  const span = (elapsed, end = 20000) =>
    traceSpans(
      [
        request({
          startedAt: 100,
          at: end + 100,
          tools: [
            tool({
              startedAt: 100,
              completedAt: elapsed + 100,
              durationMs: elapsed,
            }),
          ],
        }),
      ],
      false,
    )[0];
  assert.equal(defaultExpanded(span(999, 1000), null), false);
  assert.equal(defaultExpanded(span(1000, 2000), null), true);
  assert.equal(defaultExpanded(span(1000, 2001), null), false);
  assert.equal(defaultExpanded(span(9999), null), false);
  assert.equal(defaultExpanded(span(10000), null), true);
  assert.equal(
    defaultExpanded(
      traceSpans([request({ startedAt: null, tools: [] })], false)[0],
      null,
    ),
    false,
  );
  const parallel = span(5000);
  parallel.children.push({ ...parallel.children[0], id: "parallel" });
  assert.equal(defaultExpanded(parallel, null), true);
});

test("failed, running and slowest owners expand, but explicit choices win across refresh and append", () => {
  const [span] = traceSpans([request()], false);
  assert.equal(defaultExpanded(span, null), false);
  assert.equal(defaultExpanded(span, span.id), true);
  assert.equal(defaultExpanded(span, span.children[0].id), true);
  span.children[0].failed = true;
  assert.equal(defaultExpanded(span, null), true);
  span.children[0].failed = false;
  span.children[0].running = true;
  assert.equal(defaultExpanded(span, null), true);
  const choices = new Map([[span.id, false]]);
  assert.equal(expandedByChoice(span, null, choices), false);
  const refreshed = traceSpans(
    [request(), request({ id: "next", sequence: 2 })],
    false,
  );
  assert.equal(expandedByChoice(refreshed[0], refreshed[0].id, choices), false);
  assert.equal(expandedByChoice(refreshed[1], null, choices, true), true);
  assert.equal(
    expandedByChoice(refreshed[1], refreshed[1].id, choices, false),
    false,
  );
  choices.set(refreshed[1].id, true);
  assert.equal(expandedByChoice(refreshed[1], null, choices, false), true);
});

test("model titles never fall back to tool names; tools show informative arguments", () => {
  const [span] = traceSpans(
    [
      request({
        tools: [tool({ name: "exec" }), tool({ name: "exec", toolId: "two" })],
      }),
    ],
    false,
  );
  assert.equal(span.label, "模型调用 #1");
  assert.equal(toolSummary(span), "exec ×2");
  assert.equal(
    toolLabel({
      name: "exec",
      preview: "cd /some/project && rg -n replaceTab src",
    }),
    "rg -n replaceTab src",
  );
  assert.equal(
    toolLabel({ name: "exec", preview: "python3 - <<'PY'\nprint(1)" }),
    "python3 脚本",
  );
  assert.equal(
    toolLabel({
      name: "exec",
      preview: 'exec {"cmd":"ls /some/long/project"}',
    }),
    "ls …/project",
  );
  assert.equal(
    toolLabel({
      name: "apply_patch",
      preview: "*** Begin Patch\n*** Update File: src/app.ts\n@@",
    }),
    "src/app.ts",
  );
  assert.equal(
    toolLabel({ name: "search", preview: '{"query":"useful words"}' }),
    "useful words",
  );
  assert.equal(toolLabel({ name: "search", preview: null }), "search");
});
