import type { TimelineRow } from "../shared/types";

type RequestRow = Extract<TimelineRow, { kind: "request" }>;
export type TraceTool = RequestRow["tools"][number];
export type TraceSpan = {
  id: string;
  label: string;
  kind: "request" | "tool" | "reasoning" | "reply";
  at: number | null;
  start: number | null;
  end: number | null;
  elapsed: number | null;
  running: boolean;
  failed: boolean;
  children: TraceSpan[];
  request?: RequestRow;
  tool?: TraceTool;
  text?: string;
};
const time = (n: number | null) => (n !== null && n > 0 ? n : null);
const elapsed = (start: number | null, end: number | null) =>
  start !== null && end !== null && end >= start ? end - start : null;

export function traceSpans(
  timeline: TimelineRow[],
  running: boolean,
): TraceSpan[] {
  const toolSpan = (tool: TraceTool): TraceSpan => {
    const start = time(tool.startedAt),
      end = time(tool.completedAt);
    const failed = tool.status === "failed" || tool.status === "error";
    return {
      id: `tool:${tool.toolId}`,
      label: tool.name || "工具调用",
      kind: "tool",
      at: time(tool.at),
      start,
      end,
      elapsed: tool.durationMs ?? elapsed(start, end),
      running:
        running &&
        start !== null &&
        end === null &&
        !failed &&
        tool.outputBytes === null &&
        tool.status !== "completed",
      failed,
      children: [],
      tool,
    };
  };
  const requests = timeline.flatMap((row): TraceSpan[] =>
    row.kind === "request"
      ? [
          {
            id: `request:${row.id}`,
            label: `LLM 请求 ${row.sequence}`,
            kind: "request",
            at: time(row.at),
            start: row.startedAt,
            end: time(row.at),
            elapsed: elapsed(row.startedAt, time(row.at)),
            running: false,
            failed: false,
            request: row,
            children: row.tools.map(toolSpan),
          },
        ]
      : [],
  );
  const byId = new Map(requests.map((span) => [span.request!.id, span]));
  const roots: TraceSpan[] = [];
  for (const row of timeline) {
    if (row.kind === "request") roots.push(byId.get(row.id)!);
    else if (row.kind === "tool") roots.push(toolSpan(row));
    else {
      // Reasoning's `at` is its START when a measured duration is available.
      const start = time(row.at),
        measured =
          row.kind === "reasoning" &&
          row.durationMs !== null &&
          row.durationMs >= 0;
      const end = measured && start !== null ? start + row.durationMs! : null;
      const span: TraceSpan = {
        id: `${row.kind}:${row.id}`,
        label: row.kind === "reasoning" ? "思考" : "回复",
        kind: row.kind,
        at: start,
        start: measured ? start : null,
        end,
        elapsed: measured ? row.durationMs : null,
        running: false,
        failed: false,
        children: [],
        text: row.summary,
      };
      const parent =
        row.kind === "reasoning" && end !== null
          ? requests.find(
              (r) =>
                r.start !== null &&
                r.end !== null &&
                r.start <= start! &&
                r.end >= end,
            )
          : undefined;
      if (parent) parent.children.push(span);
      else roots.push(span);
    }
  }
  for (const request of requests)
    request.children.sort(
      (a, b) => (a.start ?? Infinity) - (b.start ?? Infinity),
    );
  return roots;
}

// Folded parents keep child intervals in the viewport range; text contributes
// its event position without pretending to have a measured duration.
export function traceWindow(
  span: TraceSpan,
  origin: number | null,
  folded: boolean,
) {
  const items = folded ? [span, ...span.children] : [span];
  const times = items.flatMap((item) => {
    const start = item.start ?? item.at;
    return origin === null || start === null
      ? []
      : [
          {
            start: Math.max(0, start - origin),
            end: Math.max(0, (item.end ?? start) - origin),
          },
        ];
  });
  return {
    id: span.id,
    start: times.length ? Math.min(...times.map((item) => item.start)) : null,
    end: times.length ? Math.max(...times.map((item) => item.end)) : null,
    running: items.some((item) => item.running),
  };
}
