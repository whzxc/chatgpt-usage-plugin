import assert from "node:assert/strict";
import { test } from "node:test";
import { inferRequestStarts as infer } from "./request-timing.ts";

const inferRequestStarts = (start, requests, tools) =>
  infer(
    start,
    requests.map((r, i) => ({ sequence: i + 1, ...r })),
    tools.map((t) => ({ requestSequence: null, ...t })),
  );

test("first request uses the turn start even if tools finish before it", () => {
  assert.deepEqual(
    inferRequestStarts(100, [{ at: 500 }], [{ completedAt: 300 }]),
    [100],
  );
});
test("later requests use the latest prior request or parallel tool completion", () => {
  assert.deepEqual(
    inferRequestStarts(
      100,
      [{ at: 500 }, { at: 1200 }, { at: 1800 }],
      [{ completedAt: 900 }, { completedAt: 700 }, { completedAt: 2000 }],
    ),
    [100, 900, 1200],
  );
});
test("missing timestamps and invalid chronology never invent a duration", () => {
  assert.deepEqual(
    inferRequestStarts(
      null,
      [{ at: 500 }, { at: 900 }],
      [{ completedAt: null }],
    ),
    [null, 500],
  );
  assert.deepEqual(
    inferRequestStarts(
      100,
      [{ at: null }, { at: 900 }],
      [{ completedAt: 700 }],
    ),
    [null, 700],
  );
  assert.deepEqual(
    inferRequestStarts(0, [{ at: 0 }, { at: 900 }], [{ completedAt: 0 }]),
    [null, null],
  );
  assert.deepEqual(inferRequestStarts(800, [{ at: 500 }, { at: 900 }], []), [
    null,
    800,
  ]);
  assert.deepEqual(
    inferRequestStarts(100, [{ at: 500 }, { at: 400 }, { at: 900 }], []),
    [100, null, 500],
  );
});
test("tool completion exactly at request completion gives a zero-length estimate", () => {
  assert.deepEqual(
    inferRequestStarts(100, [{ at: 500 }, { at: 900 }], [{ completedAt: 900 }]),
    [100, 900],
  );
});
test("inference happens before pagination and does not depend on the visible slice", () => {
  const requests = [{ at: 500 }, { at: 1200 }, { at: 1800 }];
  const result = inferRequestStarts(100, requests, [{ completedAt: 1100 }]);
  assert.deepEqual(result.slice(1, 3), [1100, 1200]);
});

test("a request never starts at completion of its own triggered tools", () => {
  assert.deepEqual(
    inferRequestStarts(
      100,
      [{ at: 500 }, { at: 900 }, { at: 1300 }],
      [
        { completedAt: 700, requestSequence: 1 },
        { completedAt: 850, requestSequence: 2 },
        { completedAt: 900, requestSequence: 2 },
        { completedAt: 1100, requestSequence: 2 },
      ],
    ),
    [100, 700, 1100],
  );
});
