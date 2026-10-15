import type { IndexStore } from "./index-store.js";
import { Collector, readPrompt, type FileState } from "./collector.js";
import { promptText, type Response } from "./projection.js";
import type { Pricing } from "./pricing.js";

export const relationalSchema = `
CREATE TABLE IF NOT EXISTS threads(threadId TEXT PRIMARY KEY,title TEXT,session TEXT,firstAt INTEGER,lastAt INTEGER,model TEXT,serviceTier TEXT,running INTEGER,contextWindow INTEGER,incomplete INTEGER,catalogueOnly INTEGER);
CREATE TABLE IF NOT EXISTS turns(threadId TEXT,turnId TEXT,sequence INTEGER,prompt TEXT,startedAt INTEGER,completedAt INTEGER,durationMs INTEGER,ttftMs INTEGER,status TEXT,contextWindow INTEGER,PRIMARY KEY(threadId,turnId));
CREATE TABLE IF NOT EXISTS requests(threadId TEXT,id TEXT,turnId TEXT,sequence INTEGER,at INTEGER,model TEXT,serviceTier TEXT,input INTEGER,cached INTEGER,output INTEGER,reasoning INTEGER,reliable INTEGER,family TEXT,cost REAL,priceVersion TEXT,PRIMARY KEY(threadId,id));
CREATE INDEX IF NOT EXISTS requests_time ON requests(at);
CREATE INDEX IF NOT EXISTS requests_model_time ON requests(model,at);
CREATE INDEX IF NOT EXISTS requests_turn ON requests(threadId,turnId,sequence);
CREATE TABLE IF NOT EXISTS compactions(threadId TEXT,id TEXT,turnId TEXT,at INTEGER,requestSequence INTEGER,beforeTokens INTEGER,afterTokens INTEGER,PRIMARY KEY(threadId,id));
CREATE TABLE IF NOT EXISTS tools(threadId TEXT,toolId TEXT,turnId TEXT,name TEXT,at INTEGER,durationMs INTEGER,preview TEXT,inputPath TEXT,inputOffset INTEGER,inputLength INTEGER,inputBytes INTEGER,outputPath TEXT,outputOffset INTEGER,outputLength INTEGER,outputBytes INTEGER,completedAt INTEGER,PRIMARY KEY(threadId,toolId));
CREATE INDEX IF NOT EXISTS tools_turn ON tools(threadId,turnId,at);
CREATE TABLE IF NOT EXISTS content_locations(path TEXT,offset INTEGER,length INTEGER,turn TEXT,tool TEXT,kind TEXT,bytes INTEGER,preview TEXT,PRIMARY KEY(path,offset));
CREATE INDEX IF NOT EXISTS content_turn ON content_locations(path,turn,kind);
CREATE INDEX IF NOT EXISTS content_tool ON content_locations(path,tool,kind);
`;
export function writeThread(
  index: IndexStore,
  id: string,
  pricing: Pricing,
  current?: { file: string; state: FileState },
) {
  const c = new Collector();
  for (const row of index
    .prepare("SELECT path,state FROM files WHERE thread=? ORDER BY path")
    .all(id)) {
    const file = String(row.path);
    c.files.set(
      file,
      current?.file === file
        ? current.state
        : index.load(file, String(row.state)),
    );
  }
  const t = c.merge().get(id);
  for (const table of ["threads", "turns", "requests", "compactions", "tools"])
    index.prepare(`DELETE FROM ${table} WHERE threadId=?`).run(id);
  if (!t) return;
  const turns = Object.values(t.turns).sort(
    (a, b) =>
      (a.startedAt ?? 0) - (b.startedAt ?? 0) || a.id.localeCompare(b.id),
  );
  const rows = Object.values(t.modern ? t.responses : t.legacy).sort(
    (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1),
  );
  const latest = turns.at(-1);
  const title =
    index
      .prepare(
        "SELECT COALESCE(NULLIF(name,''),session,NULLIF(title,'')) AS title FROM titles WHERE id=?",
      )
      .get(id)?.title ?? null;
  index
    .prepare("INSERT INTO threads VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(
      id,
      title,
      id,
      t.createdAt,
      t.lastEventAt,
      rows.at(-1)?.model ?? t.model,
      rows.at(-1)?.serviceTier ?? t.tier,
      Number(latest?.status === "running-at-last-event"),
      latest?.contextWindow ?? null,
      Number(t.issues.size > 0),
      Number([...c.files.values()].every((s) => s.catalogueOnly)),
    );
  for (const [i, r] of rows.entries())
    index
      .prepare("INSERT INTO requests VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        r.id,
        r.turnId,
        i + 1,
        r.at,
        r.model ?? "unknown",
        r.serviceTier,
        r.tokens.input,
        r.tokens.cached,
        r.tokens.output,
        r.tokens.reasoning,
        Number(r.reliable),
        r.family,
        pricing.estimate(r),
        pricing.version,
      );
  for (const [i, t] of turns.entries()) {
    let prompt: string | null = null;
    try {
      if (t.prompt)
        prompt = promptText(readPrompt(t.prompt))?.slice(0, 300) ?? null;
    } catch {}
    index
      .prepare("INSERT INTO turns VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        t.id,
        i + 1,
        prompt,
        t.startedAt,
        t.completedAt,
        t.durationMs,
        t.ttftMs,
        t.status,
        t.contextWindow,
      );
  }
  for (const e of Object.values(t.compactions)) {
    const before = rows.findLast((r) => r.at <= (e.at ?? 0)),
      after = rows.find((r) => r.at > (e.at ?? 0));
    const input = (r: Response | undefined) =>
      r?.reliable && r.family === "response" ? r.tokens.input : null;
    index
      .prepare("INSERT INTO compactions VALUES (?,?,?,?,?,?,?)")
      .run(
        id,
        e.responseId,
        e.turnId,
        e.at,
        before ? rows.indexOf(before) + 1 : null,
        input(before),
        input(after),
      );
  }
  for (const tool of Object.values(t.tools)) {
    const locations = index
      .prepare(
        `SELECT l.* FROM content_locations l JOIN files f ON f.path=l.path WHERE f.thread=? AND l.tool=? ORDER BY l.path,l.offset`,
      )
      .all(id, tool.id);
    const input = locations.findLast((l) => l.kind === "input"),
      output = locations.findLast((l) => l.kind === "output");
    index
      .prepare("INSERT INTO tools VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        tool.id,
        tool.turnId,
        tool.name,
        tool.at,
        tool.startedAt !== null && tool.completedAt !== null
          ? tool.completedAt - tool.startedAt
          : null,
        input?.preview ?? null,
        input?.path ?? null,
        input?.offset ?? null,
        input?.length ?? null,
        input?.bytes ?? null,
        output?.path ?? null,
        output?.offset ?? null,
        output?.length ?? null,
        tool.outputBytes,
        tool.completedAt,
      );
  }
}
export function reprice(index: IndexStore, pricing: Pricing) {
  if (index.get("priceVersion") === pricing.version) return;
  index.transaction(() => {
    const update = index.prepare(
      "UPDATE requests SET cost=?,priceVersion=? WHERE threadId=? AND id=?",
    );
    for (const r of index.prepare("SELECT * FROM requests").iterate()) {
      const response = {
        model: r.model,
        serviceTier: r.serviceTier,
        reliable: !!r.reliable,
        tokens: {
          input: r.input,
          cached: r.cached,
          output: r.output,
          reasoning: r.reasoning,
        },
      } as Response;
      update.run(pricing.estimate(response), pricing.version, r.threadId, r.id);
    }
    index.set("priceVersion", pricing.version);
    index.bump();
  });
}
