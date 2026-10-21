// Zero is the index's missing-event-time sentinel, not a measured timestamp.
const timestamp = (value: number | null) =>
  value !== null && Number.isFinite(value) && value > 0 ? value : null;

/** Requests must be in sequence order. Tool completion order may be arbitrary. */
export function inferRequestStarts(
  startedAt: number | null,
  requests: { at: number | null }[],
  tools: { completedAt: number | null }[],
): (number | null)[] {
  const completions = tools
    .flatMap((tool) => {
      const at = timestamp(tool.completedAt);
      return at === null ? [] : [at];
    })
    .sort((a, b) => a - b);
  let previous = timestamp(startedAt);
  return requests.map((request, index) => {
    const end = timestamp(request.at);
    if (end === null) return null;
    let start = previous;
    if (index > 0) {
      // Upper bound finds the last completed parallel tool, never a future one.
      let low = 0,
        high = completions.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (completions[mid] <= end) low = mid + 1;
        else high = mid;
      }
      if (low > 0) start = Math.max(start ?? 0, completions[low - 1]);
    }
    previous = Math.max(previous ?? 0, end);
    return start !== null && start <= end ? start : null;
  });
}
