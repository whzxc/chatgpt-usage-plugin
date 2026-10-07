import {
  openSync,
  closeSync,
  readSync,
  fstatSync,
  statSync,
  readdirSync,
  readFileSync,
  existsSync,
  unlinkSync,
  createReadStream,
} from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { pipeline } from "node:stream/promises";
import parser from "stream-json/parser.js";
import filter from "stream-json/filters/filter.js";
import path from "node:path";
import {
  codexHome,
  root,
  hash,
  text,
  time,
  sortedValues,
  stableJson,
  saveBytes,
  rangeStart,
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
};
const fresh = (): FileState => ({
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
});
const identity = (m: NonNullable<ReturnType<typeof statSync>>) =>
  `${m.dev}:${m.ino}:${m.birthtimeMs}`;
function readRange(fd: number, offset: number, length: number): Buffer {
  const bytes = Buffer.alloc(length);
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
    const chunk = Buffer.alloc(256 * 1024);
    let position = offset,
      start = offset,
      length = 0,
      parts: Buffer[] = [],
      oversized = false;
    for (;;) {
      const n = readSync(fd, chunk, 0, chunk.length, position);
      if (!n) break;
      let cursor = 0;
      while (cursor < n) {
        const found = chunk.indexOf(10, cursor),
          end = found >= 0 && found < n ? found + 1 : n;
        const part = chunk.subarray(cursor, end);
        length += part.length;
        if (length > MAX_LINE) {
          parts = [];
          oversized = true;
        } else if (!oversized) parts.push(Buffer.from(part));
        cursor = end;
        if (part.at(-1) === 10) {
          yield {
            bytes: oversized ? Buffer.alloc(0) : Buffer.concat(parts, length),
            offset: start,
            length,
            complete: true,
            oversized,
          };
          start += length;
          length = 0;
          parts = [];
          oversized = false;
        }
      }
      position += n;
    }
    if (length)
      yield {
        bytes: oversized ? Buffer.alloc(0) : Buffer.concat(parts, length),
        offset: start,
        length,
        complete: false,
        oversized,
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
    filter: /^(timestamp|type|payload\.compaction_response_id)$/,
  });
  const strings: Record<string, string> = Object.create(null);
  // Filter emits streamed primitive tokens; pack only the retained metadata.
  let key = "",
    value = "",
    objectDepth = 0;
  filtered.on("data", (token) => {
    if (token.name === "startObject") objectDepth++;
    if (token.name === "endObject") objectDepth--;
    if (token.name === "keyValue") key = token.value;
    if (token.name === "startString") value = "";
    if (token.name === "stringChunk" && value.length < 4096)
      value += token.value;
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
        payload: { compaction_response_id: strings.compaction_response_id },
      }
    : null;
}
function catalogue(file: string): FileState {
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
async function scan(
  file: string,
  state: FileState,
  detail: boolean,
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
        const record = await oversizedCompaction(
          file,
          line.offset,
          line.length,
        ).catch(() => null);
        if (record) {
          ingest(
            s.projection,
            record,
            file,
            line.offset,
            Buffer.alloc(0),
            detail,
          );
          bytesRead += line.length;
        } else s.projection.issues.add("oversized-line-not-indexed");
      } else {
        try {
          ingest(
            s.projection,
            JSON.parse(line.bytes.toString("utf8")),
            file,
            line.offset,
            line.bytes,
            detail,
          );
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
function discover(dir: string, out: string[], issues: Set<string>, depth = 0) {
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
function restore(file: string, detail: boolean): FileState {
  try {
    const s = JSON.parse(
      gunzipSync(readFileSync(file), {
        maxOutputLength: 128 * 1024 * 1024,
      }).toString("utf8"),
    ) as FileState;
    if (s.schema !== CACHE_SCHEMA || s.detail !== detail) return fresh();
    s.projection.issues = new Set(s.projection.issues);
    for (const key of [
      "responses",
      "legacy",
      "turns",
      "tools",
      "compactions",
    ] as const)
      s.projection[key] = Object.assign(Object.create(null), s.projection[key]);
    return s;
  } catch {
    return fresh();
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
export class Collector {
  files = new Map<string, FileState>();
  titles = new Map<string, string>();
  issues = new Set<string>();
  checked = 0;
  observedAt: string | null = null;
  bytesRead = 0;
  scanMs = 0;
  prunedAt = 0;
  threads = new Map<string, Projection>();
  sources = new Map<string, string[]>();
  async refresh(period: number | null, selected: string | null) {
    if (Date.now() - this.checked < 4000) return;
    const start = performance.now();
    this.issues.clear();
    this.bytesRead = 0;
    this.titles.clear();
    const home = codexHome();
    try {
      for (const l of lines(path.join(home, "session_index.jsonl")))
        try {
          const r = JSON.parse(l.bytes.toString("utf8"));
          if (text(r, "id") && text(r, "thread_name"))
            this.titles.set(r.id, r.thread_name);
        } catch {}
    } catch {}
    try {
      const databases = readdirSync(home)
        .map((n) => ({
          name: n,
          version: Number(/^state_(\d+)\.sqlite$/.exec(n)?.[1] ?? -1),
        }))
        .filter((n) => n.version >= 0)
        .sort((a, b) => b.version - a.version);
      if (databases.length) {
        const db = new DatabaseSync(path.join(home, databases[0].name), {
          readOnly: true,
        });
        try {
          for (const r of db
            .prepare("SELECT id, name, title FROM threads")
            .iterate())
            if (typeof r.id === "string") {
              if (typeof r.name === "string" && r.name)
                this.titles.set(r.id, r.name);
              else if (
                typeof r.title === "string" &&
                r.title &&
                !this.titles.has(r.id)
              )
                this.titles.set(r.id, r.title);
            }
        } finally {
          db.close();
        }
      }
    } catch {}
    const paths: string[] = [];
    for (const dir of ["sessions", "archived_sessions"])
      discover(path.join(home, dir), paths, this.issues);
    const live = new Set(paths);
    for (const p of this.files.keys()) if (!live.has(p)) this.files.delete(p);
    const cutoff = period === null ? null : rangeStart(period);
    const metadata = new Map(
      paths.map((p) => {
        try {
          return [p, statSync(p)] as const;
        } catch {
          return [p, null] as const;
        }
      }),
    );
    paths.sort(
      (a, b) =>
        (metadata.get(b)?.mtimeMs ?? 0) - (metadata.get(a)?.mtimeMs ?? 0),
    );
    for (const file of paths) {
      const meta = metadata.get(file);
      if (!meta) {
        this.issues.add("file-metadata-unavailable");
        continue;
      }
      let detail = !!selected && path.basename(file).includes(selected);
      const cachePath = () =>
        path.join(
          root(),
          "usage-ts",
          detail ? "tasks" : "files",
          `${hash(file)}.json.gz`,
        );
      const old = cutoff !== null && meta.mtimeMs < cutoff;
      let other = selected !== null && !detail;
      let s =
        this.files.get(file) ??
        (old || other ? fresh() : restore(cachePath(), detail));
      if (old || other) {
        if (
          s.schema !== CACHE_SCHEMA ||
          s.length !== meta.size ||
          s.stamp !== meta.mtimeMs ||
          s.identity !== identity(meta)
        )
          try {
            s = catalogue(file);
          } catch {}
        if (other && selected === s.projection.threadId) {
          detail = true;
          other = false;
          s = restore(cachePath(), true);
        }
        if (
          s.schema === CACHE_SCHEMA &&
          s.length === meta.size &&
          s.stamp === meta.mtimeMs &&
          s.identity === identity(meta) &&
          (other ||
            (cutoff !== null &&
              s.projection.lastEventAt !== null &&
              s.projection.lastEventAt < cutoff))
        ) {
          this.files.set(file, s);
          continue;
        }
      }
      try {
        const result = await scan(file, s, detail);
        s = result.state;
        this.bytesRead += result.bytesRead;
        if (result.changed)
          try {
            saveBytes(
              cachePath(),
              gzipSync(
                JSON.stringify(s, (_key, v) =>
                  v instanceof Set ? [...v].sort() : v,
                ),
                { level: 1 },
              ),
            );
          } catch {
            this.issues.add("checkpoint-unavailable");
          }
      } catch {
        this.issues.add("file-read-failed");
      }
      this.files.set(file, s);
    }
    this.threads = this.merge();
    this.sources.clear();
    for (const [p, f] of [...this.files].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const paths = this.sources.get(f.projection.threadId) ?? [];
      paths.push(p);
      this.sources.set(f.projection.threadId, paths);
    }
    this.observedAt = new Date().toISOString();
    this.checked = Date.now();
    this.scanMs = Math.round(performance.now() - start);
    if (Date.now() - this.prunedAt >= 60000) {
      this.prune();
      this.prunedAt = Date.now();
    }
  }
  merge(): Map<string, Projection> {
    const threads = new Map<string, Projection>(),
      indexed = new Set<string>();
    for (const [, f] of [...this.files].sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      const p = f.projection;
      if (!p.threadId) continue;
      if (!f.catalogueOnly) indexed.add(p.threadId);
      let t = threads.get(p.threadId);
      if (!t) {
        t = structuredClone(p);
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
        (p.reportedTotal?.[0] ?? -Infinity) >
        (t.reportedTotal?.[0] ?? -Infinity)
      )
        t.reportedTotal = p.reportedTotal;
    }
    for (const t of threads.values()) {
      if (!indexed.has(t.threadId)) continue;
      if (t.modern) {
        for (const id of Object.keys(t.compactions))
          if (!t.responses[id])
            t.issues.add("compaction-response-not-observed");
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
    return new Map(
      [...threads].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
  prune() {
    const live = new Map(
      [...this.files].map(([p, s]) => [`${hash(p)}.json.gz`, s.length]),
    );
    const entries: {
      path: string;
      size: number;
      source: number;
      stamp: number;
    }[] = [];
    for (const dir of ["files", "tasks"]) {
      const folder = path.join(root(), "usage-ts", dir);
      if (!existsSync(folder)) continue;
      for (const name of readdirSync(folder)) {
        if (!/^[a-f0-9]{64}\.json\.gz$/.test(name)) continue;
        const file = path.join(folder, name);
        try {
          const m = statSync(file);
          if (!m.isFile()) continue;
          const source = live.get(name);
          if (source !== undefined)
            entries.push({
              path: file,
              size: m.size,
              source,
              stamp: m.mtimeMs,
            });
          else if (!this.issues.size) unlinkSync(file);
        } catch {}
      }
    }
    let total = entries.reduce((n, e) => n + e.size, 0);
    entries.sort(
      (a, b) =>
        a.source / Math.max(a.size, 1) - b.source / Math.max(b.size, 1) ||
        a.stamp - b.stamp,
    );
    for (const e of entries) {
      if (total <= 40 * 1024 * 1024) break;
      try {
        unlinkSync(e.path);
        total -= e.size;
      } catch {}
    }
  }
}
