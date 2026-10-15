import { parse } from "acorn";

type Call = { name: string; args: unknown };
function json(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Read static arguments from code-mode wrappers. Never evaluate log contents.
export function toolCalls(name: string, value: unknown): Call[] {
  const args = json(value);
  if (name !== "exec" || typeof args !== "string") return [{ name, args }];
  const calls: Call[] = [];
  const literal = (node: any): unknown => {
    if (node.type === "Literal") return node.value;
    if (node.type === "TemplateLiteral" && !node.expressions.length)
      return node.quasis[0].value.cooked;
    if (node.type === "ObjectExpression")
      return Object.fromEntries(
        node.properties
          .filter((p: any) => p.type === "Property" && !p.computed)
          .map((p: any) => [p.key.name ?? p.key.value, literal(p.value)]),
      );
    if (node.type === "ArrayExpression")
      return node.elements.map((n: any) => (n ? literal(n) : null));
    return args.slice(node.start, node.end);
  };
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.object.name === "tools" &&
      !node.callee.computed
    ) {
      calls.push({
        name: node.callee.property.name,
        args: node.arguments[0] ? literal(node.arguments[0]) : {},
      });
      return;
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  try {
    visit(parse(args, { ecmaVersion: "latest", sourceType: "module" }));
  } catch {}
  return calls.length ? calls : [{ name, args }];
}

export function toolPreview(name: string, value: unknown): string {
  const primary = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object") return;
    const p = value as Record<string, unknown>;
    for (const key of [
      "query",
      "q",
      "url",
      "path",
      "title",
      "description",
      "command",
      "threadId",
      "thread_id",
      "name",
      "id",
    ])
      if (typeof p[key] === "string") return p[key];
    for (const child of Object.values(p)) {
      const found = primary(child);
      if (found) return found;
    }
  };
  return toolCalls(name, value)
    .map(({ name, args }) => {
      const p = args as Record<string, unknown> | null;
      if (name === "exec_command" && typeof p?.cmd === "string")
        return p.cmd.trim().split(/\r?\n/, 1)[0];
      if (name === "write_stdin")
        return `write_stdin session ${p?.session_id ?? "—"}`;
      const parameter = primary(args);
      return name + (parameter ? " " + parameter : "");
    })
    .join("；")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

export function toolInput(name: string, value: unknown): string | null {
  if (value == null) return null;
  const calls = toolCalls(name, value);
  return calls
    .map(({ name, args }) => {
      const cmd = (args as Record<string, unknown> | null)?.cmd;
      const body =
        name === "exec_command" && typeof cmd === "string"
          ? cmd
          : JSON.stringify(args, null, 2);
      return calls.length > 1 ? `${name}\n${body}` : body;
    })
    .join("\n\n");
}

export function toolOutput(value: unknown) {
  let exitCode: number | null = null,
    durationMs: number | null = null,
    wrapperMs: number | null = null;
  const unpack = (value: unknown): string => {
    const parsed = json(value);
    if (Array.isArray(parsed))
      return parsed.some((part) => part && typeof part.text === "string")
        ? parsed
            .filter((part) => part && typeof part.text === "string")
            .map((part) => unpack(part.text))
            .filter(Boolean)
            .join("\n")
        : JSON.stringify(parsed, null, 2);
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      if ("output" in p) {
        if (typeof p.exit_code === "number") exitCode = p.exit_code;
        if (typeof p.wall_time_seconds === "number")
          durationMs = (durationMs ?? 0) + p.wall_time_seconds * 1000;
        return unpack(p.output);
      }
      if (Array.isArray(p.content)) return unpack(p.content);
      return JSON.stringify(parsed, null, 2);
    }
    if (typeof parsed !== "string") return parsed == null ? "" : String(parsed);
    const header =
      /^Script (?:completed|running[^\n]*)\nWall time ([\d.]+) seconds\nOutput:\s*$/.exec(
        parsed,
      );
    if (header) {
      wrapperMs = Number(header[1]) * 1000;
      return "";
    }
    return parsed;
  };
  const text = value == null ? null : unpack(value);
  return { text, exitCode, durationMs: wrapperMs ?? durationMs };
}
