export type OverviewCall = {
  id: string;
  kind: "request" | "tool";
  at: number | null;
  requests: number;
};

// Fixed-size call-density buckets, never per-call detail on the wire.
export function traceOverview(
  origin: number | null,
  end: number,
  calls: OverviewCall[],
  slowestId: string | null,
) {
  if (origin === null || origin <= 0) return null;
  const timed = calls
    .filter(
      (call) =>
        call.at !== null && Number.isFinite(call.at) && call.at >= origin,
    )
    .sort((a, b) => a.at! - b.at!);
  const durationMs = Math.max(
    1000,
    end - origin,
    (timed.at(-1)?.at ?? origin) - origin,
  );
  const target = (call: OverviewCall) => ({
    id: call.id,
    requests: call.requests,
  });
  const buckets = Array.from({ length: 64 }, (_, i) => {
    const midpoint = origin + ((i + 0.5) * durationMs) / 64;
    let low = 0,
      high = timed.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (timed[mid].at! < midpoint) low = mid + 1;
      else high = mid;
    }
    const before = timed[low - 1],
      after = timed[low];
    const nearest = !before
      ? after
      : !after
        ? before
        : midpoint - before.at! <= after.at! - midpoint
          ? before
          : after;
    return { requests: 0, tools: 0, target: nearest ? target(nearest) : null };
  });
  for (const call of timed) {
    const bucket =
      buckets[
        Math.min(63, Math.floor(((call.at! - origin) * 64) / durationMs))
      ];
    bucket[call.kind === "request" ? "requests" : "tools"]++;
  }
  const slowest = timed.find((call) => call.id === slowestId);
  return {
    durationMs,
    buckets,
    slowest: slowest
      ? { at: slowest.at! - origin, target: target(slowest) }
      : null,
  };
}
