import {
  openSync,
  closeSync,
  readSync,
  fstatSync,
  statSync,
  readdirSync,
  createReadStream,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import parser from "stream-json/parser.js";
import filter from "stream-json/filters/filter.js";
import path from "node:path";
import {
  freshContext,
  ingestContext,
  estimate,
  type ContextState,
} from "./context.js";
import {
  hash,
  text,
  time,
  sortedValues,
  stableJson,
  type Json,
} from "./common.js";
import {
  projection,
  ingest,
  totals,
  tokenTotal,
  type Projection,
  type PromptSource,
} from "./projection.js";
// These caches are disposable. Never reinterpret another implementation's checkpoints.
const CACHE_SCHEMA = 1;
export const MAX_LINE = 8 * 1024 * 1024;
export type FileState = {
  schema: number;
  offset: number;
  length: number;
  stamp: number;
  identity: string;
  head: string;
  tail: string;
  partial: boolean;
  projection: Projection;
  catalogueOnly: boolean;
  detail: boolean;
  contentTurn: string | null;
  context: ContextState;
};
export const fresh = (): FileState => ({
  schema: 0,
  offset: 0,
  length: 0,
  stamp: 0,
  identity: "",
  head: "",
  tail: "",
  partial: false,
  projection: projection(),
  catalogueOnly: false,
  detail: false,
  contentTurn: null,
  context: freshContext(),
});
export const identity = (m: NonNullable<ReturnType<typeof statSync>>) =>
  `${m.dev}:${m.ino}:${m.birthtimeMs}`;
// Callers consume each range synchronously. Reuse storage for prompt reads and
// fingerprints instead of leaving many differently sized native allocations.
let rangeBuffer = Buffer.alloc(512);
function readRange(fd: number, offset: number, length: number): Buffer {
  if (rangeBuffer.length < length)
    rangeBuffer = Buffer.allocUnsafe(2 ** Math.ceil(Math.log2(length)));
  const bytes = rangeBuffer;
  let n = 0;
  while (n < length) {
    const read = readSync(fd, bytes, n, length - n, offset + n);
    if (!read) break;
    n += read;
  }
  return bytes.subarray(0, n);
}
const fingerprint = (fd: number, offset: number, length: number) =>
  hash(readRange(fd, offset, length));
// The writer scans files serially. Reuse bounded byte storage across files;
// yielded bytes are consumed before the iterator advances.
const lineChunk = Buffer.allocUnsafe(64 * 1024);
let linePending = Buffer.alloc(0);
export function* lines(
  file: string,
  offset = 0,
): Generator<{
  bytes: Buffer;
  offset: number;
  length: number;
  complete: boolean;
  oversized: boolean;
}> {
  const fd = openSync(file, "r");
  try {
    const chunk = lineChunk;
    let position = offset,
      start = offset,
      length = 0;
    for (;;) {
      const n = readSync(fd, chunk, 0, chunk.length, position);
      if (!n) break;
      let cursor = 0;
      while (cursor < n) {
        const found = chunk.indexOf(10, cursor),
          end = found >= 0 && found < n ? found + 1 : n;
        const part = chunk.subarray(cursor, end),
          previous = length;
        length += part.length;
        const oversized = length > MAX_LINE,
          complete = part.at(-1) === 10;
        let bytes = part;
        if (!oversized && (previous > 0 || !complete)) {
          if (linePending.length < length) {
            const next = Buffer.allocUnsafe(
              Math.min(
                MAX_LINE,
                Math.max(length, linePending.length * 2, 65536),
              ),
            );
            linePending.copy(next, 0, 0, previous);
            linePending = next;
          }
          part.copy(linePending, previous);
          bytes = linePending.subarray(0, length);
        }
        if (complete) {
          yield {
            bytes: oversized ? Buffer.alloc(0) : bytes,
            offset: start,
            length,
            complete: true,
            oversized,
          };
          start += length;
          length = 0;
        }
        cursor = end;
      }
      position += n;
    }
    if (length)
      yield {
        bytes:
          length > MAX_LINE ? Buffer.alloc(0) : linePending.subarray(0, length),
        offset: start,
        length,
        complete: false,
        oversized: length > MAX_LINE,
      };
  } finally {
    closeSync(fd);
  }
}
async function oversizedCompaction(
  file: string,
  offset: number,
  length: number,
): Promise<Json | null> {
  // Stream skipped histories without packing their strings or materializing arrays.
  const filtered = filter.asStream({
    filter:
      /^(timestamp|type|payload\.(compaction_response_id|replacement_history|message))(\.|$)/,
  });
  const strings: Record<string, string> = Object.create(null);
  // Filter emits streamed primitive tokens; pack only the retained metadata.
  let key = "",
    value = "",
    objectDepth = 0,
    replacementTokens = 0,
    messageTokens = 0,
    history = false;
  filtered.on("data", (token) => {
    if (token.name === "startObject") objectDepth++;
    if (token.name === "endObject") objectDepth--;
    if (token.name === "keyValue" && objectDepth <= 2) {
      key = token.value;
      if (key === "replacement_history") history = true;
    }
    if (token.name === "startString") value = "";
    if (token.name === "stringChunk") {
      if (key === "replacement_history")
        replacementTokens += estimate(token.value);
      else if (key === "message") messageTokens += estimate(token.value);
      else if (value.length < 4096) value += token.value;
    }
    if (token.name === "endString" && objectDepth <= 2) strings[key] = value;
  });
  await pipeline(
    createReadStream(file, {
      start: offset,
      end: offset + length - 1,
      highWaterMark: 64 * 1024,
    }),
    parser.asStream({ packStrings: false, packNumbers: false, packKeys: true }),
    filtered,
  );
  return strings.type === "compacted"
    ? {
        timestamp: strings.timestamp,
        type: "compacted",
        payload: {
          compaction_response_id: strings.compaction_response_id,
          replacement_tokens: history ? replacementTokens : messageTokens,
        },
      }
    : null;
}
export function catalogue(file: string): FileState {
  const fd = openSync(file, "r");
  try {
    const meta = fstatSync(fd);
    let first;
    for (const line of lines(file)) {
      first = line;
      break;
    }
    if (!first || first.oversized) throw new Error("invalid-session-header");
    const v = JSON.parse(first.bytes.toString("utf8"));
    if (v.type !== "session_meta") throw new Error("invalid-session-header");
    const s = fresh();
    ingest(s.projection, v, file, 0, first.bytes, false);
    s.projection.lastEventAt = s.projection.createdAt;
    const offset = Math.max(0, meta.size - 64 * 1024);
    const tail = readRange(fd, offset, meta.size - offset)
      .toString("utf8")
      .split("\n")
      .slice(offset ? 1 : 0);
    for (const line of tail)
      try {
        const at = time(JSON.parse(line).timestamp);
        if (at !== null)
          s.projection.lastEventAt = Math.max(
            s.projection.lastEventAt ?? at,
            at,
          );
      } catch {}
    if (!s.projection.threadId || s.projection.lastEventAt === null)
      throw new Error("incomplete-session-catalogue");
    return {
      ...s,
      schema: CACHE_SCHEMA,
      length: meta.size,
      identity: identity(meta),
      stamp: meta.mtimeMs,
      catalogueOnly: true,
    };
  } finally {
    closeSync(fd);
  }
}
export async function scan(
  file: string,
  state: FileState,
  detail: boolean,
  record?: (
    v: Json,
    offset: number,
    length: number,
    turn: string | null,
  ) => void,
): Promise<{ state: FileState; bytesRead: number; changed: boolean }> {
  let s = state;
  if (s.catalogueOnly || s.detail !== detail) s = fresh();
  const fd = openSync(file, "r");
  try {
    const m = fstatSync(fd),
      stamp = m.mtimeMs,
      id = identity(m);
    if (
      s.schema === CACHE_SCHEMA &&
      s.length === m.size &&
      s.stamp === stamp &&
      s.identity === id
    )
      return { state: s, bytesRead: 0, changed: false };
    const head = fingerprint(fd, 0, Math.min(s.offset, 512)),
      tail = fingerprint(
        fd,
        Math.max(0, s.offset - 512),
        Math.min(s.offset, 512),
      );
    if (
      s.schema !== CACHE_SCHEMA ||
      s.identity !== id ||
      s.offset > m.size ||
      s.head !== head ||
      s.tail !== tail ||
      (s.length === m.size && s.stamp !== stamp)
    ) {
      const rebuilt = s.schema === CACHE_SCHEMA && s.offset > 0;
      s = fresh();
      if (rebuilt)
        s.projection.issues.add("source-rewritten-history-coverage-unknown");
    }
    let bytesRead = 0;
    s.partial = false;
    for (const line of lines(file, s.offset)) {
      bytesRead += line.length;
      if (!line.complete) {
        s.partial = true;
        break;
      }
      if (line.oversized) {
        const value = await oversizedCompaction(
          file,
          line.offset,
          line.length,
        ).catch(() => null);
        if (value) {
          ingestContext(s.context, value, s.projection.threadId);
          ingest(
            s.projection,
            value,
            file,
            line.offset,
            Buffer.alloc(0),
            detail,
          );
          bytesRead += line.length;
        } else s.projection.issues.add("oversized-line-not-indexed");
      } else {
        try {
          const v = JSON.parse(line.bytes.toString("utf8"));
          ingestContext(s.context, v, s.projection.threadId || v.payload?.id);
          if (
            v.type === "turn_context" ||
            (v.type === "event_msg" && v.payload?.type === "task_started")
          )
            s.contentTurn = text(v.payload, "turn_id");
          record?.(v, line.offset, line.length, s.contentTurn);
          ingest(s.projection, v, file, line.offset, line.bytes, detail);
        } catch {
          s.projection.issues.add("invalid-json-line");
        }
      }
      s.offset = line.offset + line.length;
    }
    Object.assign(s, {
      head: fingerprint(fd, 0, Math.min(s.offset, 512)),
      tail: fingerprint(
        fd,
        Math.max(0, s.offset - 512),
        Math.min(s.offset, 512),
      ),
      length: m.size,
      stamp,
      identity: id,
      schema: CACHE_SCHEMA,
      detail,
    });
    return { state: s, bytesRead, changed: true };
  } finally {
    closeSync(fd);
  }
}
export function discover(
  dir: string,
  out: string[],
  issues: Set<string>,
  depth = 0,
) {
  if (depth > 8 || out.length >= 50000) {
    issues.add("file-discovery-limit");
    return;
  }
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= 50000) {
        issues.add("file-discovery-limit");
        break;
      }
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) discover(file, out, issues, depth + 1);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) out.push(file);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      issues.add("directory-unreadable");
  }
}
export function readPrompt(source: PromptSource): Json {
  if (source.bytes > MAX_LINE) throw new Error("prompt-source-too-large");
  const fd = openSync(source.path, "r");
  try {
    const bytes = readRange(fd, source.offset, source.bytes);
    if (hash(bytes) !== source.sha256) throw new Error("prompt-source-changed");
    return JSON.parse(bytes.toString("utf8"));
  } finally {
    closeSync(fd);
  }
}
export function mergeFiles(
  files: Map<string, FileState>,
): Map<string, Projection> {
  const counts = new Map<string, number>();
  for (const f of files.values())
    counts.set(
      f.projection.threadId,
      (counts.get(f.projection.threadId) ?? 0) + 1,
    );
  const threads = new Map<string, Projection>(),
    indexed = new Set<string>();
  for (const [, f] of [...files].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const p = f.projection;
    if (!p.threadId) continue;
    if (!f.catalogueOnly) indexed.add(p.threadId);
    let t = threads.get(p.threadId);
    if (!t) {
      t = counts.get(p.threadId)! > 1 ? structuredClone(p) : p;
      for (const k of [
        "responses",
        "legacy",
        "turns",
        "tools",
        "compactions",
      ] as const)
        t[k] = Object.assign(Object.create(null), t[k]);
      threads.set(p.threadId, t);
      if (f.partial) t.issues.add("partial-tail-pending");
      continue;
    }
    t.modern ||= p.modern;
    p.issues.forEach((i) => t!.issues.add(i));
    if (f.partial) t.issues.add("partial-tail-pending");
    for (const family of ["responses", "legacy"] as const)
      for (const r of sortedValues(p[family])) {
        const old = t[family][r.id];
        if (!old) t[family][r.id] = structuredClone(r);
        else {
          old.reliable &&= r.reliable;
          if (stableJson(old.tokens) !== stableJson(r.tokens)) {
            old.reliable = false;
            t.issues.add(
              family === "responses"
                ? "conflicting-response-usage"
                : "legacy-overlap-baseline-conflict",
            );
          }
        }
      }
    for (const incoming of sortedValues(p.turns)) {
      const old = t.turns[incoming.id];
      if (
        !old ||
        (incoming.completedAt ?? incoming.startedAt ?? -Infinity) >
          (old.completedAt ?? old.startedAt ?? -Infinity)
      )
        t.turns[incoming.id] = structuredClone(incoming);
      else {
        old.contextWindow ??= incoming.contextWindow;
        old.promptImages = Math.max(old.promptImages, incoming.promptImages);
        old.prompt ??= incoming.prompt;
        old.model ??= incoming.model;
        old.effort ??= incoming.effort;
      }
    }
    for (const incoming of sortedValues(p.tools)) {
      const old = t.tools[incoming.id];
      if (!old) {
        t.tools[incoming.id] = structuredClone(incoming);
        continue;
      }
      old.outputBytes ??= incoming.outputBytes;
      old.name ??= incoming.name;
      old.turnId ??= incoming.turnId;
      if (
        (incoming.completedAt ?? -Infinity) > (old.completedAt ?? -Infinity)
      ) {
        old.startedAt = incoming.startedAt;
        old.completedAt = incoming.completedAt;
        old.status = incoming.status;
      }
    }
    Object.assign(t.compactions, p.compactions);
    t.lastEventAt =
      t.lastEventAt === null
        ? p.lastEventAt
        : p.lastEventAt === null
          ? t.lastEventAt
          : Math.max(t.lastEventAt, p.lastEventAt);
    if (
      (p.reportedTotal?.[0] ?? -Infinity) > (t.reportedTotal?.[0] ?? -Infinity)
    )
      t.reportedTotal = p.reportedTotal;
  }
  for (const t of threads.values()) {
    if (!indexed.has(t.threadId)) continue;
    if (t.modern) {
      for (const id of Object.keys(t.compactions))
        if (!t.responses[id]) t.issues.add("compaction-response-not-observed");
      if (
        !t.related &&
        t.reportedTotal &&
        totals(sortedValues(t.responses)).total !==
          tokenTotal(t.reportedTotal[1])
      )
        t.issues.add("response-sum-cumulative-mismatch");
      const first = Object.values(t.responses).reduce(
        (at, r) => Math.min(at, r.at),
        Infinity,
      );
      if (Object.values(t.legacy).some((r) => r.at < first))
        t.issues.add("legacy-prefix-excluded-from-response-family");
    } else {
      t.issues.add("legacy-coverage-response-and-compaction-unknown");
      if (t.related) t.issues.add("legacy-related-history-partial");
    }
  }
  return new Map([...threads].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
