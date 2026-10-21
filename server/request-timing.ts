// Zero is the index's missing-event-time sentinel, not a measured timestamp.
const timestamp = (value: number | null) =>
  value !== null && Number.isFinite(value) && value > 0 ? value : null;

/** Requests must be in sequence order. Tool completion order may be arbitrary. */
export function inferRequestStarts(
  startedAt: number | null,
  requests: { at: number | null; sequence: number }[],
  tools: { completedAt: number | null; requestSequence: number | null }[],
): (number | null)[] {
  const completions = tools
    .flatMap((tool) => {
      const at = timestamp(tool.completedAt);
      return at === null ? [] : [{ at, owner: tool.requestSequence }];
    })
    .sort((a, b) => a.at - b.at);
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
        if (completions[mid].at <= end) low = mid + 1;
        else high = mid;
      }
      // A tool triggered by this request cannot define its own start.
      while (low > 0 && completions[low - 1].owner === request.sequence) low--;
      if (low > 0) start = Math.max(start ?? 0, completions[low - 1].at);
    }
    previous = Math.max(previous ?? 0, end);
    return start !== null && start <= end ? start : null;
  });
}
