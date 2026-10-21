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
  notes?: TraceSpan[];
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
      label: toolLabel(tool),
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
            label: `模型调用 #${row.sequence}`,
            kind: "request",
            at: time(row.at),
            start: row.startedAt,
            end: time(row.at),
            elapsed: elapsed(row.startedAt, time(row.at)),
            running: false,
            failed: false,
            request: row,
            notes: [],
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
      // Containment is strongest evidence; otherwise narration belongs to the
      // next completed request. Trailing text stays with the last loaded one.
      const parent =
        requests.find(
          (r) =>
            start !== null &&
            r.start !== null &&
            r.end !== null &&
            r.start <= start &&
            r.end >= (end ?? start),
        ) ??
        requests.find(
          (r) => start !== null && r.end !== null && r.end >= start,
        ) ??
        requests.at(-1);
      parent?.notes!.push(span);
    }
  }
  for (const request of requests) {
    request.children.sort(
      (a, b) => (a.start ?? Infinity) - (b.start ?? Infinity),
    );
    const heading = request.notes
      ?.find((note) => note.kind === "reasoning" && note.text)
      ?.text?.split(/[\n；]/)[0]
      .replace(/^[#*\s]+|[*\s]+$/g, "");
    request.label = heading || request.label;
  }
  return roots;
}

// Folded parents keep child tool intervals in the viewport range.
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

export function toolCategory(name: string | null): string {
  if (/exec|terminal|shell|stdin|command/i.test(name ?? "")) return "terminal";
  if (/patch|edit|write.*file/i.test(name ?? "")) return "edit";
  if (/search|find|grep|glob|web|fetch|browse|http/i.test(name ?? ""))
    return "search";
  if (/mcp/i.test(name ?? "")) return "mcp";
  return "file";
}

export function toolLabel(tool: Pick<TraceTool, "name" | "preview">): string {
  let text = tool.preview?.trim() ?? "";
  if (tool.name && text.startsWith(tool.name + " "))
    text = text.slice(tool.name.length).trim();
  if (text.startsWith("{")) {
    try {
      const args = JSON.parse(text);
      text =
        [
          "cmd",
          "command",
          "query",
          "q",
          "pattern",
          "path",
          "file_path",
          "url",
          "input",
        ]
          .map((key) => args[key])
          .find((value) => typeof value === "string") ?? text;
    } catch {
      /* Indexed previews can be truncated JSON. */
    }
  }
  const patch = text.match(/\*\*\* (?:Update|Add|Delete) File: (.+)/);
  if (patch) text = patch[1];
  if (toolCategory(tool.name) === "terminal") {
    const commands = text.split(/(?:&&|;|；|\n)/).map((s) => s.trim());
    text =
      commands.find((s) => s && !/^(?:cd|pwd|echo|printf|export)\b/.test(s)) ||
      commands[0];
    if (/^(?:python[\d.]*|node|bash|sh)\s+.*<</.test(text))
      return `${text.split(/\s/)[0]} 脚本`;
  }
  text = text.replace(
    /(?:~|[A-Za-z]:)?\/(?:[\w.@-]+\/){2,}([\w.@-]+)(?:\/([\w.@-]+))?/g,
    (_match, tail, last) => `…/${last ? `${tail}/${last}` : tail}`,
  );
  return text.replace(/\s+/g, " ").slice(0, 180) || tool.name || "工具调用";
}

export function toolSummary(span: TraceSpan): string {
  const counts = new Map<string, number>();
  for (const child of span.children) {
    const name = child.tool?.name || "工具";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(" · ");
}

export function defaultExpanded(
  span: TraceSpan,
  slowest: string | null,
): boolean {
  if (
    span.running ||
    span.failed ||
    span.id === slowest ||
    span.children.some(
      (child) => child.running || child.failed || child.id === slowest,
    )
  )
    return true;
  const total = span.children.reduce(
    (sum, child) => sum + (child.elapsed ?? 0),
    0,
  );
  const end = Math.max(
    span.end ?? 0,
    ...span.children.map((child) => child.end ?? 0),
  );
  const window = span.start !== null ? end - span.start : 0;
  return (
    total >= 10_000 || (total >= 1000 && window > 0 && total / window >= 0.5)
  );
}

export function expandedByChoice(
  span: TraceSpan,
  slowest: string | null,
  choices: ReadonlyMap<string, boolean>,
  all?: boolean,
): boolean {
  return choices.get(span.id) ?? all ?? defaultExpanded(span, slowest);
}
