export type TimeRange = { start: number; end: number };
export type ViewportSpan = {
  id: string;
  start: number | null;
  end: number | null;
  running: boolean;
};

export function viewportRange(
  spans: ViewportSpan[],
  total: number,
  now: number,
  whole = false,
): TimeRange | null {
  let start = Infinity,
    end = -Infinity;
  for (const span of spans) {
    if (span.start === null || !Number.isFinite(span.start)) continue;
    start = Math.min(start, span.start);
    end = Math.max(end, span.running ? now : (span.end ?? span.start));
  }
  if (!Number.isFinite(start)) return null;
  total = Math.max(1000, total, end);
  if (whole) return { start: 0, end: total };
  const padding = Math.max(100, (end - start) * 0.04);
  start = Math.max(0, start - padding);
  end = Math.min(total, Math.max(end + padding, start + 1000));
  return { start: Math.max(0, Math.min(start, end - 1000)), end };
}

export function interpolateRange(
  from: TimeRange,
  to: TimeRange,
  progress: number,
): TimeRange {
  const t = Math.max(0, Math.min(1, progress));
  return {
    start: from.start + (to.start - from.start) * t,
    end: from.end + (to.end - from.end) * t,
  };
}

export function rangeTicks(range: TimeRange): number[] {
  const rough = Math.max(1000, (range.end - range.start) / 4);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find((n) => n * power >= rough)! * power;
  const first = Math.ceil(range.start / step) * step;
  const ticks: number[] = [];
  for (let at = first; at <= range.end; at += step) ticks.push(at);
  return ticks;
}

export function axisTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const tail = String(seconds % 60).padStart(2, "0");
  return seconds < 3600
    ? `${Math.floor(seconds / 60)}:${tail}`
    : `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${tail}`;
}
