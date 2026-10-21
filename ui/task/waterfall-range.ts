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
  // Anchor the first label within one second of the visible start. Rounding
  // to seconds avoids the large leading gap caused by global nice-step grids.
  const first = Math.ceil(range.start / 1000) * 1000;
  const step = Math.max(1000, Math.ceil((range.end - first) / 4 / 1000) * 1000);
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

// Keep metrics next to the visible bar, moving before it at the right edge.
export function barLabelLeft(
  start: number,
  elapsed: number,
  range: TimeRange,
  trackWidth: number,
  labelWidth: number,
): number {
  const unit = trackWidth / (range.end - range.start);
  const left = (start - range.start) * unit;
  const tail = left + Math.max(6, elapsed * unit);
  const x =
    tail + 8 + labelWidth <= trackWidth ? tail + 8 : left - 8 - labelWidth;
  return Math.max(4, Math.min(trackWidth - labelWidth - 4, x));
}
