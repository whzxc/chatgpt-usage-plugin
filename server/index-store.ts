import { DatabaseSync, type StatementSync } from "node:sqlite";
import { realpathSync, statSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  codexHome,
  root,
  hash,
  privateDir,
  rangeStart,
  text,
} from "./common.js";
import {
  fresh,
  scan,
  catalogue,
  discover,
  identity,
  lines,
  type FileState,
} from "./collector.js";
import { relationalSchema, writeThread, reprice } from "./relational.js";
import type { Pricing } from "./pricing.js";
import { projection } from "./projection.js";

const families = [
  "responses",
  "legacy",
  "turns",
  "tools",
  "compactions",
] as const;
const schema = 4;
export function indexPath() {
  let home = path.resolve(codexHome());
  try {
    home = realpathSync(home);
  } catch {}
  return path.join(root(), "index", `${hash(home).slice(0, 16)}.sqlite`);
}
const encode = (v: unknown) =>
  JSON.stringify(v, (_, value) =>
    value instanceof Set ? [...value].sort() : value,
  );
export class IndexStore {
  db: DatabaseSync;
  owner = randomUUID();
  statements = new Map<string, StatementSync>();
  prepare(sql: string) {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.db.prepare(sql);
      this.statements.set(sql, statement);
    }
    return statement;
  }
  constructor(readonly readOnly = false) {
    const file = indexPath();
    if (!readOnly) privateDir(path.dirname(file));
    this.db = new DatabaseSync(file, { readOnly });
    this.db.exec(
      `PRAGMA busy_timeout=${readOnly ? 0 : 3000}; PRAGMA cache_size=-4096;`,
    );
    if (readOnly) {
      if (this.prepare("PRAGMA user_version").get()!.user_version !== schema) {
        this.db.close();
        throw new Error("index-initializing");
      }
      return;
    }
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
    this.transaction(() => {
      if (this.prepare("PRAGMA user_version").get()!.user_version !== schema) {
        for (const table of [
          "cursors",
          "context_parts",
          "threads",
          "turns",
          "requests",
          "compactions",
          "tools",
          "content_locations",
          "files",
          "entries",
          "locations",
          "turn_ranges",
          "titles",
          "metadata",
          "leases",
        ])
          this.db.exec(`DROP TABLE IF EXISTS ${table}`);
      }
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cursors(path TEXT PRIMARY KEY, thread TEXT NOT NULL, state TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS cursors_thread ON cursors(thread);
        CREATE TABLE IF NOT EXISTS titles(id TEXT PRIMARY KEY, session TEXT, name TEXT, title TEXT);
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS leases(key TEXT PRIMARY KEY, owner TEXT NOT NULL, until INTEGER NOT NULL);
        ${relationalSchema}
        PRAGMA user_version=${schema};
      `);
    });
    rmSync(path.join(root(), "usage-ts"), { recursive: true, force: true });
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(key: string): any {
    const row = this.db
      .prepare("SELECT value FROM metadata WHERE key=?")
      .get(key);
    return row ? JSON.parse(String(row.value)) : null;
  }
  set(key: string, value: unknown) {
    this.db
      .prepare("INSERT OR REPLACE INTO metadata VALUES (?,?)")
      .run(key, encode(value));
  }
  claim(key: string, duration = 60000) {
    return (
      this.db
        .prepare(
          `INSERT INTO leases VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET owner=excluded.owner, until=excluded.until WHERE leases.until < ? OR leases.owner=excluded.owner`,
        )
        .run(key, this.owner, Date.now() + duration, Date.now()).changes > 0
    );
  }
  release(key: string) {
    this.db
      .prepare("DELETE FROM leases WHERE key=? AND owner=?")
      .run(key, this.owner);
  }
  state(value: string): FileState {
    const s = JSON.parse(value);
    s.projection = {
      ...projection(),
      ...s.projection,
      issues: new Set(s.projection.issues),
    };
    return s;
  }
  load(value: string): FileState {
    const s = this.state(value),
      p = s.projection,
      id = p.threadId;
    for (const r of this.prepare(
      "SELECT * FROM requests WHERE threadId=?",
    ).iterate(id)) {
      const response = {
        id: String(r.id),
        threadId: id,
        turnId: r.turnId,
        at: r.at,
        model: r.model,
        effort: r.effort,
        serviceTier: r.serviceTier,
        reliable: !!r.reliable,
        family: r.family,
        tokens: {
          input: r.input,
          cached: r.cached,
          output: r.output,
          reasoning: r.reasoning,
        },
      };
      (p.modern ? p.responses : p.legacy)[String(r.id)] = response as any;
    }
    for (const r of this.prepare(
      "SELECT * FROM turns WHERE threadId=?",
    ).iterate(id))
      p.turns[String(r.turnId)] = {
        id: String(r.turnId),
        prompt: r.promptSource ? JSON.parse(String(r.promptSource)) : null,
        promptImages: r.promptImages,
        contextWindow: r.contextWindow,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        durationMs: r.durationMs,
        ttftMs: r.ttftMs,
        status: r.status,
        model: r.model,
        effort: r.effort,
        serviceTier: r.serviceTier,
      } as any;
    for (const r of this.prepare(
      "SELECT * FROM tools WHERE threadId=?",
    ).iterate(id))
      p.tools[String(r.toolId)] = {
        id: r.toolId,
        turnId: r.turnId,
        name: r.name,
        at: r.at,
        outputBytes: r.outputBytes,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        status: r.status,
      } as any;
    for (const r of this.prepare(
      "SELECT * FROM compactions WHERE threadId=?",
    ).iterate(id))
      p.compactions[String(r.id)] = {
        responseId: r.id,
        turnId: r.turnId,
        at: r.at,
      };
    return s;
  }
  bump() {
    this.set("generation", (this.get("generation") ?? 0) + 1);
  }
  async refresh(selected: string | null, pricing: Pricing) {
    if (!this.claim("scan")) return false;
    const started = performance.now(),
      issues = new Set<string>();
    let renewed = Date.now(),
      bytesRead = 0,
      scanned = 0;
    try {
      const paths: string[] = [];
      for (const dir of ["sessions", "archived_sessions"])
        discover(path.join(codexHome(), dir), paths, issues);
      const live = new Set(paths),
        cutoff = rangeStart(32);
      reprice(this, pricing);
      for (const [i, file] of paths.sort().entries()) {
        this.set("progress", {
          state: "indexing",
          processed: i,
          total: paths.length,
          reason: null,
        });
        if (Date.now() - renewed >= 10000) {
          if (!this.claim("scan")) return false;
          renewed = Date.now();
        }
        const before = this.prepare(
          "SELECT state FROM cursors WHERE path=?",
        ).get(file)?.state;
        let state = before ? this.state(String(before)) : fresh();
        try {
          const m = statSync(file),
            full =
              m.mtimeMs >= cutoff ||
              state.projection.threadId === selected ||
              (!!selected && path.basename(file).includes(selected));
          if (
            state.schema &&
            state.length === m.size &&
            state.stamp === m.mtimeMs &&
            state.identity === identity(m) &&
            (!full || !state.catalogueOnly)
          )
            continue;
          if (
            !before ||
            state.identity !== identity(m) ||
            m.size < state.length ||
            (m.size === state.length && m.mtimeMs !== state.stamp)
          )
            state = catalogue(file);
          const id = state.projection.threadId;
          const oldId = before
            ? this.state(String(before)).projection.threadId
            : id;
          const siblings = this.prepare(
            "SELECT path FROM cursors WHERE thread IN (?,?) AND path!=?",
          )
            .all(id, oldId, file)
            .map((r) => String(r.path))
            .filter((p) => live.has(p));
          const files = new Map<string, FileState>(),
            locations: any[][] = [],
            rebuiltPaths: string[] = [];
          // A normal thread resumes from relational rows. Multiple source copies are
          // merged only in the writer, so rewrites/removals cannot retain stale rows.
          const sources = [file, ...siblings].sort();
          let restored = false;
          for (const source of sources) {
            // A newly discovered copy can merge with the already indexed thread.
            // Rewrites still rescan all copies, since their old rows must be removed.
            if (!before && source !== file) {
              const saved = String(
                this.prepare("SELECT state FROM cursors WHERE path=?").get(
                  source,
                )!.state,
              );
              files.set(
                source,
                restored ? this.state(saved) : this.load(saved),
              );
              restored = true;
              continue;
            }
            let current =
              source === file && before && !siblings.length
                ? this.load(String(before))
                : fresh();
            if (source === file && !full && (!before || state.catalogueOnly))
              current = state = catalogue(file);
            else {
              const prior = current;
              const result = await scan(
                source,
                current,
                true,
                (v, offset, length, turn) =>
                  this.locate(locations, source, v, offset, length, turn),
              );
              current = result.state;
              if (!prior.schema || current !== prior) rebuiltPaths.push(source);
              bytesRead += result.bytesRead;
              scanned++;
            }
            files.set(source, current);
            for (const row of this.prepare(
              "SELECT path FROM cursors WHERE thread=?",
            ).all(current.projection.threadId)) {
              const sibling = String(row.path);
              if (live.has(sibling) && !sources.includes(sibling))
                sources.push(sibling);
            }
          }
          this.transaction(() => {
            for (const source of rebuiltPaths)
              this.prepare("DELETE FROM content_locations WHERE path=?").run(
                source,
              );
            for (const row of locations)
              this.prepare(
                "INSERT OR REPLACE INTO content_locations VALUES (?,?,?,?,?,?,?,?)",
              ).run(...row);
            for (const thread of new Set([
              id,
              oldId,
              ...[...files.values()].map((s) => s.projection.threadId),
            ]))
              writeThread(this, thread, pricing, files);
            for (const [source, current] of files) {
              const header = {
                ...current,
                projection: { ...current.projection },
              };
              for (const family of families)
                (header.projection as any)[family] = {};
              this.prepare("INSERT OR REPLACE INTO cursors VALUES (?,?,?)").run(
                source,
                current.projection.threadId,
                encode(header),
              );
            }
            this.bump();
          });
        } catch {
          issues.add("file-read-failed");
        }
      }
      if (
        !issues.has("directory-unreadable") &&
        !issues.has("file-discovery-limit")
      ) {
        for (const r of this.prepare("SELECT path,thread FROM cursors").all())
          if (!live.has(String(r.path))) {
            const files = new Map<string, FileState>();
            for (const source of this.prepare(
              "SELECT path FROM cursors WHERE thread=? AND path!=?",
            ).all(r.thread, r.path)) {
              if (!live.has(String(source.path))) continue;
              const result = await scan(String(source.path), fresh(), true);
              files.set(String(source.path), result.state);
              bytesRead += result.bytesRead;
              scanned++;
            }
            this.transaction(() => {
              this.prepare("DELETE FROM cursors WHERE path=?").run(r.path);
              this.prepare("DELETE FROM content_locations WHERE path=?").run(
                r.path,
              );
              writeThread(this, String(r.thread), pricing, files);
              this.bump();
            });
          }
      }
      this.refreshTitles();
      const totals = this.get("scanTotals") ?? { files: 0, bytes: 0 };
      this.set("scanTotals", {
        files: totals.files + scanned,
        bytes: totals.bytes + bytesRead,
      });
      this.set("scan", {
        observedAt: new Date().toISOString(),
        scanMs: Math.round(performance.now() - started),
        bytesRead,
        scanned,
        issues: [...issues],
      });
      this.set("progress", {
        state: "ready",
        processed: paths.length,
        total: paths.length,
        reason: issues.size ? [...issues].join(",") : null,
      });
      return true;
    } finally {
      this.release("scan");
    }
  }
  locate(
    locations: any[][],
    file: string,
    v: any,
    offset: number,
    length: number,
    current: string | null,
  ) {
    const p = v.payload ?? {};
    const turn =
      text(p, "turn_id") ??
      text(p.internal_chat_message_metadata_passthrough, "turn_id") ??
      current;
    const tool = v.type === "response_item" ? text(p, "call_id") : null;
    let kind: string | null = null,
      value: any = null;
    if (v.type === "response_item") {
      if (["function_call", "custom_tool_call"].includes(p.type)) {
        kind = "input";
        value = p.type === "function_call" ? p.arguments : p.input;
      } else if (
        ["function_call_output", "custom_tool_call_output"].includes(p.type)
      ) {
        kind = "output";
        value = p.output;
      } else if (
        p.type === "reasoning" ||
        (p.type === "message" && p.role === "assistant")
      )
        kind = "narrative";
    } else if (
      v.type === "event_msg" &&
      p.type === "item_completed" &&
      p.item?.type === "Reasoning"
    )
      kind = "narrative";
    if (kind) {
      const body =
        value == null
          ? null
          : typeof value === "string"
            ? value
            : JSON.stringify(value);
      let preview = body;
      if (kind === "input") {
        let parsed = value;
        try {
          if (typeof value === "string") parsed = JSON.parse(value);
        } catch {}
        preview =
          ["title", "description", "cmd", "command", "query", "url", "path"]
            .map((k) => (typeof parsed?.[k] === "string" ? parsed[k] : null))
            .find(Boolean) ?? (typeof parsed === "string" ? parsed : null);
      }
      locations.push([
        file,
        offset,
        length,
        turn,
        tool,
        kind,
        body === null ? null : Buffer.byteLength(body),
        kind === "input"
          ? preview == null
            ? null
            : Buffer.from(
                preview.trim().replace(/\s+/g, " ").slice(0, 200),
                "utf16le",
              ).toString("utf16le")
          : null,
      ]);
    }
  }
  syncTitles() {
    this.prepare(
      "UPDATE threads SET title=(SELECT COALESCE(NULLIF(name,''),session,NULLIF(title,'')) FROM titles WHERE id=threadId) WHERE title IS NOT (SELECT COALESCE(NULLIF(name,''),session,NULLIF(title,'')) FROM titles WHERE id=threadId)",
    ).run();
  }
  refreshTitles() {
    const file = path.join(codexHome(), "session_index.jsonl");
    try {
      const m = statSync(file),
        previous = this.get("titleCursor");
      if (
        !previous ||
        previous.stamp !== m.mtimeMs ||
        previous.size !== m.size ||
        previous.identity !== identity(m)
      ) {
        let offset =
          previous &&
          previous.identity === identity(m) &&
          previous.size < m.size
            ? previous.offset
            : 0;
        this.transaction(() => {
          if (!offset) this.db.exec("UPDATE titles SET session=NULL");
          for (const line of lines(file, offset)) {
            if (!line.complete) break;
            offset = line.offset + line.length;
            try {
              const r = JSON.parse(line.bytes.toString("utf8"));
              if (text(r, "id") && text(r, "thread_name"))
                this.db
                  .prepare(
                    "INSERT INTO titles(id,session) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET session=excluded.session",
                  )
                  .run(r.id, r.thread_name);
            } catch {}
          }
          this.syncTitles();
          this.bump();
          this.set("titleCursor", {
            offset,
            size: m.size,
            stamp: m.mtimeMs,
            identity: identity(m),
          });
        });
      }
    } catch {}
    try {
      const name = readdirSync(codexHome())
        .filter((n) => /^state_\d+\.sqlite$/.test(n))
        .sort(
          (a, b) => Number(b.match(/\d+/)![0]) - Number(a.match(/\d+/)![0]),
        )[0];
      if (!name) return;
      const file = path.join(codexHome(), name),
        m = statSync(file);
      let wal = 0;
      try {
        wal = statSync(file + "-wal").mtimeMs;
      } catch {}
      const stamp = `${file}:${m.mtimeMs}:${wal}`;
      if (stamp === this.get("titleDatabase")) return;
      const source = new DatabaseSync(file, { readOnly: true });
      try {
        const rows = source.prepare("SELECT id,name,title FROM threads").all();
        this.transaction(() => {
          this.db.exec("UPDATE titles SET name=NULL,title=NULL");
          const write = this.prepare(
            "INSERT INTO titles(id,name,title) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,title=excluded.title",
          );
          for (const r of rows)
            if (typeof r.id === "string") write.run(r.id, r.name, r.title);
          this.syncTitles();
          this.bump();
          this.set("titleDatabase", stamp);
        });
      } finally {
        source.close();
      }
    } catch {}
  }
  close() {
    this.db.close();
  }
}
