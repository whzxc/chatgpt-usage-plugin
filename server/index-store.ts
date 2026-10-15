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
  Collector,
  fresh,
  scan,
  catalogue,
  discover,
  identity,
  lines,
  type FileState,
} from "./collector.js";
import { projection } from "./projection.js";

const families = [
  "responses",
  "legacy",
  "turns",
  "tools",
  "compactions",
] as const;
const schema = 2;
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
    this.db.exec("PRAGMA busy_timeout=3000; PRAGMA cache_size=-4096;");
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
        CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, thread TEXT NOT NULL, state TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS files_thread ON files(thread);
        CREATE TABLE IF NOT EXISTS entries(path TEXT NOT NULL, family TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(path,family,id));
        CREATE TABLE IF NOT EXISTS locations(path TEXT NOT NULL, offset INTEGER NOT NULL, length INTEGER NOT NULL, turn TEXT, tool TEXT, PRIMARY KEY(path,offset));
        CREATE INDEX IF NOT EXISTS locations_turn ON locations(path,turn);
        CREATE INDEX IF NOT EXISTS locations_tool ON locations(path,tool);
        CREATE TABLE IF NOT EXISTS turn_ranges(path TEXT NOT NULL, turn TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, PRIMARY KEY(path,turn));
        CREATE TABLE IF NOT EXISTS titles(id TEXT PRIMARY KEY, session TEXT, name TEXT, title TEXT);
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS leases(key TEXT PRIMARY KEY, owner TEXT NOT NULL, until INTEGER NOT NULL);
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
  load(file: string, value: string, detail = true): FileState {
    const s = this.state(value);
    const singleModern =
      !detail &&
      s.projection.modern &&
      this.prepare("SELECT count(*) AS n FROM files WHERE thread=?").get(
        s.projection.threadId,
      )!.n === 1;
    const query = detail
      ? "SELECT family,('{' || group_concat(json_quote(id) || ':' || value) || '}') AS value FROM entries WHERE path=? GROUP BY family"
      : `SELECT family,('{' || group_concat(json_quote(id) || ':' || value) || '}') AS value FROM entries WHERE path=? AND family != 'tools' ${singleModern ? "AND family != 'legacy'" : ""} GROUP BY family`;
    for (const r of this.prepare(query).iterate(file))
      (s.projection as any)[String(r.family)] = Object.assign(
        Object.create(null),
        JSON.parse(String(r.value)),
      );
    if (singleModern) {
      const r = this.prepare(
        "SELECT id,value FROM entries WHERE path=? AND family='legacy' ORDER BY json_extract(value,'$.at') LIMIT 1",
      ).get(file);
      if (r) s.projection.legacy[String(r.id)] = JSON.parse(String(r.value));
    }
    return s;
  }
  async refresh(selected: string | null) {
    if (!this.claim("scan")) return false;
    const started = performance.now(),
      issues = new Set<string>();
    let renewed = Date.now();
    let bytesRead = 0,
      scanned = 0;
    try {
      const paths: string[] = [];
      for (const dir of ["sessions", "archived_sessions"])
        discover(path.join(codexHome(), dir), paths, issues);
      const live = new Set(paths),
        cutoff = rangeStart(32);
      for (const file of paths.sort()) {
        if (Date.now() - renewed >= 10000) {
          if (!this.claim("scan")) return false;
          renewed = Date.now();
        }
        const row = this.db
          .prepare("SELECT state FROM files WHERE path=?")
          .get(file);
        const before = row ? String(row.state) : null;
        let s = before ? this.state(before) : fresh();
        let rebuilt = !before;
        let previousRows = new Map<string, string>();
        try {
          const m = statSync(file);
          const full =
            m.mtimeMs >= cutoff ||
            s.projection.threadId === selected ||
            (!!selected && path.basename(file).includes(selected));
          if (
            s.schema &&
            s.length === m.size &&
            s.stamp === m.mtimeMs &&
            s.identity === identity(m) &&
            (!full || !s.catalogueOnly)
          )
            continue;
          const locations: [number, number, string | null, string | null][] =
            [];
          if (!full && (!s.schema || s.catalogueOnly)) s = catalogue(file);
          else {
            if (before) {
              s = this.load(file, before);
              for (const family of families)
                for (const [id, value] of Object.entries(s.projection[family]))
                  previousRows.set(`${family}:${id}`, encode(value));
            }
            const result = await scan(
              file,
              s,
              true,
              (v, offset, length, current) => {
                const p = v.payload ?? {};
                const turn =
                  text(p, "turn_id") ??
                  text(
                    p.internal_chat_message_metadata_passthrough,
                    "turn_id",
                  ) ??
                  current;
                const tool =
                  v.type === "response_item" ? text(p, "call_id") : null;
                if (
                  v.type === "response_item" ||
                  (v.type === "event_msg" && p.type === "item_completed")
                )
                  locations.push([offset, length, turn, tool]);
              },
            );
            rebuilt ||= result.state !== s;
            s = result.state;
            bytesRead += result.bytesRead;
            scanned++;
          }
          const changed: [string, string, string][] = [];
          const header = { ...s, projection: { ...s.projection } };
          for (const family of families) {
            for (const [id, value] of Object.entries(s.projection[family])) {
              const encoded = encode(value);
              if (rebuilt || previousRows.get(`${family}:${id}`) !== encoded)
                changed.push([family, id, encoded]);
            }
            (header.projection as any)[family] = {};
          }
          const encodedHeader = encode(header);
          // Parse and serialize outside the short cursor-checked write transaction.
          this.transaction(() => {
            const current = this.db
              .prepare("SELECT state FROM files WHERE path=?")
              .get(file);
            if ((current ? String(current.state) : null) !== before) return;
            const write = this.prepare(
              "INSERT OR REPLACE INTO entries VALUES (?,?,?,?)",
            );
            if (rebuilt)
              this.prepare("DELETE FROM entries WHERE path=?").run(file);
            for (const [family, id, value] of changed)
              write.run(file, family, id, value);
            if (rebuilt) {
              this.prepare("DELETE FROM locations WHERE path=?").run(file);
              this.prepare("DELETE FROM turn_ranges WHERE path=?").run(file);
            }
            const locate = this.prepare(
              "INSERT OR REPLACE INTO locations VALUES (?,?,?,?,?)",
            );
            for (const [offset, length, turn, tool] of locations)
              locate.run(file, offset, length, turn, tool);
            const ranges = new Map<string, [number, number]>();
            for (const [offset, length, turn] of locations)
              if (turn) {
                const range = ranges.get(turn) ?? [offset, offset + length];
                range[0] = Math.min(range[0], offset);
                range[1] = Math.max(range[1], offset + length);
                ranges.set(turn, range);
              }
            const rangeWrite = this.prepare(
              "INSERT INTO turn_ranges VALUES (?,?,?,?) ON CONFLICT(path,turn) DO UPDATE SET start=min(turn_ranges.start,excluded.start),end=max(turn_ranges.end,excluded.end)",
            );
            for (const [turn, [start, end]] of ranges)
              rangeWrite.run(file, turn, start, end);
            this.db
              .prepare("INSERT OR REPLACE INTO files VALUES (?,?,?)")
              .run(file, s.projection.threadId, encodedHeader);
          });
        } catch {
          issues.add("file-read-failed");
        }
      }
      this.transaction(() => {
        if (
          !issues.has("directory-unreadable") &&
          !issues.has("file-discovery-limit")
        )
          for (const r of this.prepare("SELECT path FROM files").all())
            if (!live.has(String(r.path)))
              for (const table of [
                "files",
                "entries",
                "locations",
                "turn_ranges",
              ])
                this.db
                  .prepare(`DELETE FROM ${table} WHERE path=?`)
                  .run(r.path);
      });
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
      return true;
    } finally {
      this.release("scan");
    }
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
          this.set("titleDatabase", stamp);
        });
      } finally {
        source.close();
      }
    } catch {}
  }
  needsThread(id: string | null) {
    return (
      !!id &&
      this.db
        .prepare("SELECT state FROM files WHERE thread=?")
        .all(id)
        .some((r) => this.state(String(r.state)).catalogueOnly)
    );
  }
  collector(days: number, selected: string | null) {
    const c = new Collector(),
      info = this.get("scan");
    if (info) {
      c.observedAt = info.observedAt;
      c.scanMs = info.scanMs;
      c.bytesRead = info.bytesRead;
      c.issues = new Set(info.issues);
    }
    const cutoff = rangeStart(days);
    for (const r of this.db
      .prepare("SELECT path,state FROM files ORDER BY path")
      .iterate()) {
      const file = String(r.path),
        s = this.state(String(r.state));
      const include = selected
        ? s.projection.threadId === selected
        : s.stamp >= cutoff || (s.projection.lastEventAt ?? 0) >= cutoff;
      if (include && !s.catalogueOnly) {
        const full = this.load(file, String(r.state), !!selected);
        c.files.set(file, full);
      } else {
        const p = projection();
        for (const key of [
          "threadId",
          "createdAt",
          "parentId",
          "forkedFromId",
          "related",
          "cliVersion",
          "lastEventAt",
        ] as const)
          (p as any)[key] = s.projection[key];
        c.files.set(file, {
          ...s,
          projection: p,
          catalogueOnly: true,
          partial: false,
        });
      }
      const sources = c.sources.get(s.projection.threadId) ?? [];
      sources.push(file);
      c.sources.set(s.projection.threadId, sources);
    }
    for (const r of this.db
      .prepare(
        "SELECT id,COALESCE(NULLIF(name,''),session,NULLIF(title,'')) AS label FROM titles",
      )
      .iterate())
      if (r.label) c.titles.set(String(r.id), String(r.label));
    c.threads = c.merge();
    return c;
  }
  select(c: Collector, days: number) {
    const cutoff = rangeStart(days);
    for (const [file, s] of c.files) {
      if (s.stamp >= cutoff || (s.projection.lastEventAt ?? 0) >= cutoff)
        continue;
      const p = projection();
      for (const key of [
        "threadId",
        "createdAt",
        "parentId",
        "forkedFromId",
        "related",
        "cliVersion",
        "lastEventAt",
      ] as const)
        (p as any)[key] = s.projection[key];
      c.files.set(file, {
        ...s,
        projection: p,
        catalogueOnly: true,
        partial: false,
      });
    }
    c.threads = c.merge();
  }
  locations(thread: string, turn: string | null, tool: string | null) {
    return this.db
      .prepare(
        `SELECT l.path,l.offset,l.length FROM locations l JOIN files f ON f.path=l.path WHERE f.thread=? AND l.${tool ? "tool" : "turn"}=? ORDER BY l.path,l.offset`,
      )
      .all(thread, tool ?? turn);
  }
  close() {
    this.db.close();
  }
}
