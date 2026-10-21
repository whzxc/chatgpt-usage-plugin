import assert from "node:assert/strict";
import { test } from "node:test";
import {
  axisTime,
  interpolateRange,
  rangeTicks,
  viewportRange,
} from "./waterfall-range.ts";
const span = (start, end, running = false) => ({
  id: "sample",
  start,
  end,
  running,
});

test("long-turn viewport zooms to visible calls with small margins", () => {
  assert.deepEqual(
    viewportRange(
      [span(9000000, 9010000), span(9010000, 9142000)],
      10080000,
      0,
    ),
    { start: 8994320, end: 9147680 },
  );
});
test("a fully visible short turn uses the full turn and missing times retain the previous range", () => {
  assert.deepEqual(viewportRange([span(0, 4000)], 5000, 0, true), {
    start: 0,
    end: 5000,
  });
  assert.equal(viewportRange([span(null, null)], 5000, 0), null);
  assert.equal(viewportRange([], 5000, 0), null);
});
test("parallel spans take the outer bounds; running spans grow to now", () => {
  assert.deepEqual(
    viewportRange([span(1000, 12000), span(2000, 3000)], 20000, 0),
    { start: 560, end: 12440 },
  );
  const earlier = viewportRange([span(1000, null, true)], 2000, 2000);
  const later = viewportRange([span(1000, null, true)], 2000, 5000);
  assert.ok(later.end > earlier.end);
  assert.equal(later.end, 5000);
});
test("text event positions and zero-length spans get a usable nonnegative range", () => {
  assert.deepEqual(viewportRange([span(9900, 9900)], 10000, 0), {
    start: 9000,
    end: 10000,
  });
  assert.deepEqual(viewportRange([span(0, 0)], 0, 0), { start: 0, end: 1000 });
});
test("axis transition interpolates both ends; reduced motion can select its endpoint immediately", () => {
  const from = { start: 1000, end: 5000 },
    to = { start: 10000, end: 20000 };
  assert.deepEqual(interpolateRange(from, to, 0), from);
  assert.deepEqual(interpolateRange(from, to, 0.5), {
    start: 5500,
    end: 12500,
  });
  assert.deepEqual(interpolateRange(from, to, 1), to);
  assert.deepEqual(interpolateRange(from, to, 2), to);
});
test("rounded ticks remain absolute to the turn, with distinct labels beyond an hour", () => {
  const ticks = rangeTicks({ start: 10081000, end: 10111000 });
  assert.deepEqual(ticks, [10081000, 10089000, 10097000, 10105000]);
  assert.equal(axisTime(ticks[0]), "2:48:01");
  assert.equal(new Set(ticks.map(axisTime)).size, ticks.length);
});

test("bar metrics follow the tail and flip before the bar at the right edge", async () => {
  const { barLabelLeft } = await import("./waterfall-range.ts");
  const range = { start: 1000, end: 2000 };
  assert.equal(barLabelLeft(1100, 100, range, 400, 70), 88);
  assert.equal(barLabelLeft(1800, 100, range, 400, 70), 242);
  assert.equal(barLabelLeft(1100, 0, range, 400, 70), 54);
  assert.equal(barLabelLeft(1000, 1000, range, 400, 70), 4);
});

test("viewport ticks start within a second and provide four to five round references", () => {
  for (const range of [
    { start: 123456, end: 223456 },
    { start: 0, end: 9000 },
    { start: 11001, end: 900001 },
  ]) {
    const ticks = rangeTicks(range);
    assert.ok(ticks.length >= 4 && ticks.length <= 5);
    assert.ok(ticks[0] >= range.start && ticks[0] - range.start < 1000);
    assert.ok(ticks.every((tick) => tick % 1000 === 0 && tick <= range.end));
  }
});
