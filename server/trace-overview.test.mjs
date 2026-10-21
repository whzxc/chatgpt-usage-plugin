import assert from "node:assert/strict";
import { test } from "node:test";
import { traceOverview } from "./trace-overview.ts";

test("full-turn density stays bounded for 595 requests and their tools", () => {
  const calls = Array.from({ length: 595 }, (_, i) => [
    {
      id: `request:${i}`,
      kind: "request",
      at: 1000 + i * 16000,
      requests: i + 1,
    },
    { id: `tool:${i}`, kind: "tool", at: 5000 + i * 16000, requests: i + 1 },
  ]).flat();
  const overview = traceOverview(1000, 10081000, calls, "request:560");
  assert.equal(overview.buckets.length, 64);
  assert.equal(
    overview.buckets.reduce((n, b) => n + b.requests, 0),
    595,
  );
  assert.equal(
    overview.buckets.reduce((n, b) => n + b.tools, 0),
    595,
  );
  assert.deepEqual(overview.slowest, {
    at: 8960000,
    target: { id: "request:560", requests: 561 },
  });
  assert.ok(JSON.stringify(overview).length < 12000);
  assert.equal(overview.buckets.at(-1).target.requests, 595);
  assert.equal(calls[0].at, 1000);
});
test("bucket edges count once and empty gaps still navigate to nearby calls", () => {
  const overview = traceOverview(
    1000,
    65000,
    [
      { id: "tool:orphan", kind: "tool", at: 1000, requests: 0 },
      { id: "request:first", kind: "request", at: 2000, requests: 1 },
      { id: "request:last", kind: "request", at: 65000, requests: 9 },
      { id: "tool:unknown", kind: "tool", at: null, requests: 9 },
    ],
    "request:last",
  );
  assert.equal(overview.buckets[0].tools, 1);
  assert.equal(overview.buckets[1].requests, 1);
  assert.equal(overview.buckets[63].requests, 1);
  assert.deepEqual(overview.buckets[20].target, {
    id: "request:first",
    requests: 1,
  });
  assert.deepEqual(overview.buckets[50].target, {
    id: "request:last",
    requests: 9,
  });
  assert.equal(overview.slowest.at, 64000);
});
test("unknown origin and missing call times do not invent a map position", () => {
  const calls = [
    { id: "request:unknown", kind: "request", at: null, requests: 1 },
  ];
  assert.equal(traceOverview(null, 5000, calls, "request:unknown"), null);
  const empty = traceOverview(1000, 1000, calls, "request:unknown");
  assert.equal(empty.slowest, null);
  assert.ok(
    empty.buckets.every(
      (b) => b.requests === 0 && b.tools === 0 && b.target === null,
    ),
  );
  assert.equal(empty.durationMs, 1000);
});
