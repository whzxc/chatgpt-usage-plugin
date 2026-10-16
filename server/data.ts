import { openSync, closeSync, readSync } from "node:fs";
import type { IndexStore } from "./index-store.js";
import { rangeStart, type Json } from "./common.js";
import { readTurnContent } from "./content.js";
import { readPrompt } from "./collector.js";
import { promptText } from "./projection.js";
import { toolInput, toolOutput } from "./tool-content.js";

const sum = (field: string) =>
  `CASE WHEN count(*)>0 AND min(reliable)=1 AND count(${field})=count(*) AND sum(${field})<=9007199254740991 THEN sum(${field}) END`;
export const metricsSql = `${sum("input+output")} AS tokens,${sum("input")} AS input,${sum("cached")} AS cached,${sum("output")} AS output,CASE WHEN count(*)=0 THEN 0 ELSE sum(cost) END AS cost, count(*)-count(cost) AS unpriced,coalesce(sum(family='response'),0) AS requests`;
const normalize = (r: Json): Json => {
  const { unpriced, ...rest } = r;
  return { ...rest, costIncomplete: unpriced > 0 };
};
export class DataViews {
  constructor(
    readonly index: IndexStore,
    readonly now = Date.now(),
  ) {}
  all(sql: string, ...args: any[]): Json[] {
    return this.index.prepare(sql).all(...args);
  }
  one(sql: string, ...args: any[]): Json {
    return this.index.prepare(sql).get(...args) ?? {};
  }
  metrics(where: string, ...args: any[]) {
    return normalize(
      this.one(`SELECT ${metricsSql} FROM requests WHERE ${where}`, ...args),
    );
  }
  performance(threadId: string | null, bounds?: number[]) {
    const filter = threadId ? "threadId=?" : "1=1";
    const args = threadId ? [threadId] : [];
    const output = this.one(
      `WITH outputs AS (SELECT threadId,turnId,${sum("output")} AS output,min(at) AS firstAt,max(at) AS lastAt FROM requests WHERE ${filter} AND turnId IS NOT NULL GROUP BY threadId,turnId) SELECT sum(o.output)*1000.0/sum(t.durationMs) AS outputTps FROM outputs o JOIN turns t ON t.threadId=o.threadId AND t.turnId=o.turnId WHERE t.status IN ('completed','interrupted') AND t.durationMs>0 AND o.output IS NOT NULL ${bounds ? "AND t.startedAt>=? AND t.completedAt<=? AND o.firstAt>=? AND o.lastAt<=?" : ""}`,
      ...args,
      ...(bounds ? [...bounds, ...bounds] : []),
    );
    const ttft = this.one(
      `WITH ordered AS (SELECT ttftMs,row_number() OVER(ORDER BY ttftMs) AS position,count(*) OVER() AS n FROM turns WHERE ${filter} AND ttftMs IS NOT NULL ${bounds ? "AND startedAt>=? AND completedAt<=?" : ""}) SELECT avg(CASE WHEN position IN ((n+1)/2,(n+2)/2) THEN ttftMs END) AS ttftMedianMs,max(CASE WHEN position=(n*9+9)/10 THEN ttftMs END) AS ttftP90Ms,max(CASE WHEN position=(n*99+99)/100 THEN ttftMs END) AS ttftP99Ms,count(*) AS ttftTurns,max(ttftMs) AS ttftMaxMs FROM ordered`,
      ...args,
      ...(bounds ?? []),
    );
    return { ...output, ...ttft };
  }
  bounds(range: string) {
    return [
      rangeStart(range === "today" ? 1 : range === "7d" ? 7 : 30, this.now),
      this.now,
    ];
  }
  status() {
    return (
      this.index.get("progress") ?? {
        state: "indexing",
        processed: 0,
        total: 0,
        reason: null,
      }
    );
  }
  summary(args: Json) {
    const bounds = this.bounds(args.range);
    const slots = `WITH ranked AS (SELECT model,row_number() OVER(ORDER BY sum(CASE WHEN reliable THEN input+output END) DESC,model) AS slot FROM requests WHERE at BETWEEN ? AND ? GROUP BY model)`;
    const models = this.all(
      `${slots} SELECT r.model AS id,CASE WHEN ranked.slot<=3 THEN ranked.slot ELSE 0 END AS slot,${sum("input+output")} AS tokens,sum(cost) AS cost,coalesce(sum(family='response'),0) AS requests FROM requests r JOIN ranked ON r.model=ranked.model WHERE at BETWEEN ? AND ? GROUP BY r.model ORDER BY r.model`,
      ...this.bounds("30d"),
      ...bounds,
    );
    const speeds = this.all(
      `WITH outputs AS (SELECT threadId,turnId,min(model) AS model,${sum("output")} AS output,min(at) AS firstAt,max(at) AS lastAt FROM requests WHERE turnId IS NOT NULL GROUP BY threadId,turnId HAVING count(DISTINCT model)=1) SELECT o.model,sum(o.output)*1000.0/sum(t.durationMs) AS outputTps FROM outputs o JOIN turns t ON t.threadId=o.threadId AND t.turnId=o.turnId WHERE t.status IN ('completed','interrupted') AND t.durationMs>0 AND o.output IS NOT NULL AND t.startedAt>=? AND t.completedAt<=? AND o.firstAt>=? AND o.lastAt<=? GROUP BY o.model`,
      ...bounds,
      ...bounds,
    );
    for (const model of models)
      model.outputTps =
        speeds.find((row) => row.model === model.id)?.outputTps ?? null;
    const intervals: number[][] = [];
    let day = new Date(bounds[0]);
    day.setHours(0, 0, 0, 0);
    while (day.getTime() <= bounds[1]) {
      const start = day.getTime();
      day.setDate(day.getDate() + 1);
      intervals.push([start, day.getTime()]);
    }
    // Daily boundaries are calendar dates in the host timezone, including DST.
    const hour =
      "at-(CAST(strftime('%M',at/1000,'unixepoch','localtime') AS INTEGER)*60+CAST(strftime('%S',at/1000,'unixepoch','localtime') AS INTEGER))*1000-at%1000";
    const rows =
      args.range === "today"
        ? this.all(
            `SELECT ${hour} AS at,model AS id,${sum("input+output")} AS tokens,sum(cost) AS cost FROM requests WHERE at BETWEEN ? AND ? GROUP BY 1,2 ORDER BY 1,2`,
            ...bounds,
          )
        : this.all(
            `WITH buckets(start,end) AS (VALUES ${intervals.map(() => "(?,?)").join(",")}) SELECT b.start AS at,r.model AS id,${sum("input+output")} AS tokens,sum(cost) AS cost FROM buckets b CROSS JOIN requests r WHERE r.at>=max(b.start,?) AND r.at<min(b.end,?+1) GROUP BY b.start,r.model ORDER BY b.start,r.model`,
            ...intervals.flat(),
            ...bounds,
          );
    const buckets: Json[] = [];
    for (const { at, ...model } of rows) {
      let b = buckets.at(-1);
      if (!b || b.at !== at) {
        b = { at, models: [] };
        buckets.push(b);
      }
      b.models.push(model);
    }
    const { ttftMaxMs: _max, ...performance } = this.performance(null, bounds);
    return {
      totals: {
        ...this.metrics("at BETWEEN ? AND ?", ...bounds),
        ...performance,
        tasks: this.one("SELECT count(*) AS n FROM threads").n,
      },
      models,
      buckets,
      index: this.status(),
    };
  }
  tasks(args: Json) {
    const bounds = this.bounds(args.range),
      query = (args.query ?? "").trim().toLowerCase();
    const where =
      "(?='' OR instr(lower(coalesce(title,'')),?)>0 OR instr(lower(threadId),?)>0)";
    const total = this.one(
      `SELECT count(*) AS n FROM threads WHERE ${where}`,
      query,
      query,
      query,
    ).n;
    const page = Math.min(
      args.page,
      Math.max(1, Math.ceil(total / args.pageSize)),
    );
    const sql = `WITH usage AS (SELECT threadId,${metricsSql} FROM requests WHERE at BETWEEN ? AND ? GROUP BY threadId), activeTurns AS (SELECT threadId,turnId FROM requests WHERE at BETWEEN ? AND ? AND turnId IS NOT NULL UNION SELECT threadId,turnId FROM turns WHERE startedAt BETWEEN ? AND ? OR completedAt BETWEEN ? AND ?) SELECT t.threadId,t.title,t.lastAt AS lastActivity,t.running AS running,u.tokens,u.input,u.cached,CASE WHEN u.threadId IS NULL THEN 0 ELSE u.cost END AS cost,coalesce(u.requests,0) AS requests,CASE WHEN t.lastAt<? THEN 0 WHEN NOT EXISTS(SELECT 1 FROM turns z WHERE z.threadId=t.threadId) AND NOT EXISTS(SELECT 1 FROM requests z WHERE z.threadId=t.threadId AND z.turnId IS NOT NULL) THEN NULL ELSE (SELECT count(*) FROM activeTurns a WHERE a.threadId=t.threadId) END AS turns FROM threads t LEFT JOIN usage u ON u.threadId=t.threadId WHERE (?='' OR instr(lower(coalesce(t.title,'')),?)>0 OR instr(lower(t.threadId),?)>0) ORDER BY ${args.sort === "cost" ? "cost" : args.sort === "tokens" ? "tokens" : "lastActivity"} DESC,t.threadId LIMIT ? OFFSET ?`;
    return {
      total,
      page,
      pageSize: args.pageSize,
      tasks: this.all(
        sql,
        ...bounds,
        ...bounds,
        ...bounds,
        ...bounds,
        bounds[0],
        query,
        query,
        query,
        args.pageSize,
        (page - 1) * args.pageSize,
      ).map((r) => {
        const { outputTps, ttftMedianMs } = this.performance(
          r.threadId,
          bounds,
        );
        return { ...r, running: !!r.running, outputTps, ttftMedianMs };
      }),
      index: this.status(),
    };
  }
  thread(args: Json) {
    const t = this.one("SELECT * FROM threads WHERE threadId=?", args.threadId);
    if (!t.threadId)
      return { thread: null, index: this.status(), reason: "thread-not-found" };
    const rows = this.all(
      `SELECT sequence,at,output,cost,CASE WHEN reliable AND family='response' THEN input END AS input FROM requests WHERE threadId=? ORDER BY sequence`,
      t.threadId,
    );
    const turns: Json[] = this.all(
      `SELECT t.turnId,t.sequence,t.prompt,t.scheduled,t.serviceTier,t.startedAt,t.durationMs,t.ttftMs,t.status,(SELECT min(sequence) FROM requests r WHERE r.threadId=t.threadId AND r.turnId=t.turnId) AS startRequest,EXISTS(SELECT 1 FROM compactions c WHERE c.threadId=t.threadId AND c.turnId=t.turnId) AS compacted FROM turns t WHERE threadId=? ORDER BY sequence`,
      t.threadId,
    ).map((r) => {
      const usage = this.metrics(
        "threadId=? AND turnId=?",
        t.threadId,
        r.turnId,
      );
      return {
        ...r,
        compacted: !!r.compacted,
        scheduled: !!r.scheduled,
        ...usage,
        outputTps:
          r.durationMs > 0 && usage.output !== null
            ? (usage.output * 1000) / r.durationMs
            : null,
      };
    });
    return {
      thread: {
        threadId: t.threadId,
        title: t.title,
        model: t.model,
        models: this.all(
          "SELECT DISTINCT model FROM requests WHERE threadId=? ORDER BY model",
          t.threadId,
        ).map((r) => r.model),
        serviceTier: t.serviceTier,
        lastActivity: t.lastAt,
        running: !!t.running,
        totals: {
          ...this.metrics("threadId=?", t.threadId),
          ...this.performance(t.threadId),
          turns: turns.length,
          tools: this.one(
            "SELECT count(*) AS n FROM tools WHERE threadId=?",
            t.threadId,
          ).n,
        },
        contextWindow: t.contextWindow,
        context: this.context(t.threadId, t.contextWindow),
        requestInputs: rows.map((r) => r.input),
        requestDetails: rows.map((r) => [r.at, r.output, r.cost]),
        turnStarts: turns.map((r) => ({
          turnId: r.turnId,
          requestSequence: r.startRequest,
        })),
        compactions: this.all(
          "SELECT turnId,at,requestSequence,beforeTokens,afterTokens FROM compactions WHERE threadId=? ORDER BY at,id",
          t.threadId,
        ),
        turns: turns.map(({ startRequest, ...r }) => r),
      },
      index: this.status(),
      reason: null,
    };
  }
  context(threadId: string, window: number | null) {
    const rows = this.all(
      "SELECT kind,tokens FROM context_parts WHERE threadId=? ORDER BY position",
      threadId,
    );
    const fixed = rows.filter((r) => r.kind.startsWith("fixed:"));
    const details = fixed.map((r) => ({
      name: (
        {
          system: "系统指令",
          tools: "工具定义（推算）",
          skills: "Skills",
          environment: "环境与其他",
        } as Json
      )[r.kind.slice(6)],
      tokens: r.tokens,
    }));
    return {
      used: rows.length ? rows.reduce((n, r) => n + r.tokens, 0) : null,
      window,
      parts: [
        ...rows.filter((r) => !r.kind.startsWith("fixed:")),
        ...(fixed.length
          ? [
              {
                kind: "fixed",
                tokens: fixed.reduce((n, r) => n + r.tokens, 0),
                details,
              },
            ]
          : []),
      ],
    };
  }
  turn(args: Json) {
    const { threadId, turnId } = args;
    const t = this.one(
      "SELECT * FROM turns WHERE threadId=? AND turnId=?",
      threadId,
      turnId,
    );
    if (!t.turnId)
      return { turn: null, index: this.status(), reason: "turn-not-found" };
    const totals = this.metrics("threadId=? AND turnId=?", threadId, turnId);
    const requests = this.all(
      `SELECT id,sequence,at,CASE WHEN reliable AND family='response' THEN input END AS input,output,cost FROM requests WHERE threadId=? AND turnId=? ORDER BY sequence`,
      threadId,
      turnId,
    );
    const requestTools = this.all(
      `SELECT toolId,name,at,preview,outputBytes,(SELECT CASE WHEN count(*)=1 AND min(reliable)=1 AND min(family)='response' AND NOT EXISTS(SELECT 1 FROM compactions c WHERE c.threadId=tools.threadId AND c.turnId=tools.turnId AND c.at BETWEEN tools.at AND r.at) THEN min(r.sequence) END FROM requests r WHERE r.threadId=tools.threadId AND r.turnId=tools.turnId AND r.at BETWEEN tools.at AND tools.completedAt) AS requestSequence FROM tools WHERE threadId=? AND turnId=? ORDER BY at,toolId`,
      threadId,
      turnId,
    );
    const timeline: Json[] = requests.map((r) => ({
      kind: "request",
      ...r,
      tools: requestTools
        .filter((t) => t.requestSequence === r.sequence)
        .map(({ requestSequence, at, ...t }) => t),
    }));
    for (const { requestSequence, ...tool } of requestTools)
      if (requestSequence === null) timeline.push({ kind: "tool", ...tool });
    let reason: string | null = null;
    try {
      const content = readTurnContent(
        threadId,
        turnId,
        (thread, turn, _tool, visit) => {
          for (const r of this.all(
            `SELECT l.* FROM content_locations l JOIN cursors f ON f.path=l.path WHERE f.thread=? AND l.turn=? AND l.kind IN ('narrative','message','reasoning') ORDER BY l.path,l.offset`,
            thread,
            turn,
          ))
            visit(readRecord(r.path, r.offset, r.length));
        },
      );
      for (const [key, kind] of [
        ["messages", "reply"],
        ["reasoning", "reasoning"],
      ])
        for (const r of content[key])
          timeline.push({
            kind,
            id: r.id,
            at: r.at,
            summary: excerpt(
              kind === "reasoning"
                ? r.text
                    .replace(/\*\*/g, "")
                    .split(/\n+/)
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                    .join("；")
                : r.text,
              400,
            ),
            durationMs: r.durationMs ?? null,
          });
    } catch {
      reason = "content-read-failed";
    }
    timeline.sort(
      (a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)),
    );
    const timelineTotal = timeline.length,
      offset = Math.min(args.offset ?? 0, timelineTotal),
      limit = args.limit ?? 100;
    let prompt = t.prompt;
    try {
      if (t.promptSource)
        prompt = promptText(readPrompt(JSON.parse(t.promptSource)));
    } catch {
      reason = "content-read-failed";
    }
    const page: Json[] = [];
    let size = Buffer.byteLength(JSON.stringify(prompt));
    for (const row of timeline.slice(offset, offset + limit)) {
      const bytes = Buffer.byteLength(JSON.stringify(row));
      if (page.length && size + bytes > 30000) break;
      page.push(row);
      size += bytes;
    }
    return {
      turn: {
        turnId,
        prompt,
        metrics: {
          cost: totals.cost,
          tokens: totals.tokens,
          cachePercent:
            totals.input > 0 && totals.cached !== null
              ? (totals.cached * 100) / totals.input
              : null,
          output: totals.output,
          durationMs: t.durationMs,
          ttftMs: t.ttftMs,
          outputTps:
            t.durationMs > 0 && totals.output !== null
              ? (totals.output * 1000) / t.durationMs
              : null,
          context: {
            start: requests[0]?.input ?? null,
            end: requests.at(-1)?.input ?? null,
            limit: t.contextWindow,
          },
        },
        timeline: page,
        timelineTotal,
        requestTotal: totals.requests,
        nextOffset:
          offset + page.length < timelineTotal ? offset + page.length : null,
        offset,
        limit,
      },
      index: this.status(),
      reason,
    };
  }
  tool(args: Json) {
    const t = this.one(
      "SELECT * FROM tools WHERE threadId=? AND toolId=?",
      args.threadId,
      args.toolId,
    );
    if (!t.toolId)
      return { tool: null, index: this.status(), reason: "tool-not-found" };
    let exitCode: number | null = null,
      durationMs = t.durationMs;
    const body = (side: string) => {
      if (!t[side + "Path"])
        return { text: null, bytes: t[side + "Bytes"], truncated: false };
      const p = readRecord(
        t[side + "Path"],
        t[side + "Offset"],
        t[side + "Length"],
      ).payload;
      const value =
        side === "output"
          ? p.output
          : p.type === "function_call"
            ? p.arguments
            : p.input;
      const original =
        value == null
          ? null
          : typeof value === "string"
            ? value
            : JSON.stringify(value);
      let text: string | null;
      if (side === "input") text = toolInput(t.name ?? "", value);
      else {
        const output = toolOutput(value);
        text = output.text;
        exitCode = output.exitCode;
        durationMs = output.durationMs ?? durationMs;
      }
      return {
        text: text === null ? null : excerpt(text, 16000),
        bytes: original === null ? null : Buffer.byteLength(original),
        truncated: (text?.length ?? 0) > 16000,
      };
    };
    try {
      const input = body("input"),
        output = body("output");
      return {
        tool: {
          toolId: t.toolId,
          name: t.name,
          at: t.at,
          durationMs,
          exitCode,
          input,
          output,
        },
        index: this.status(),
        reason: null,
      };
    } catch {
      return {
        tool: null,
        index: this.status(),
        reason: "content-read-failed",
      };
    }
  }
  quota() {
    const value = this.index.get("quota")?.value;
    const observed = Date.parse(value?.observedAt ?? "");
    const pools = new Set(
      (value?.windows ?? [])
        .filter(
          (w: Json) =>
            w.poolId !== "base_model_inference" && w.scope !== "gpt-reserve",
        )
        .map((w: Json) => w.poolId),
    );
    const scan = this.index.get("scan");
    const historyAt = Date.parse(scan?.observedAt ?? "");
    const windows = (value?.windows ?? []).map((w: Json) => {
      const duration = /^(\d+) min$/.exec(w.label),
        minutes = duration ? Number(duration[1]) : null,
        reset = Date.parse(w.resetsAt ?? ""),
        start =
          minutes && Number.isFinite(reset) ? reset - minutes * 60000 : null;
      const elapsed =
        start !== null
          ? Math.max(
              0,
              Math.min(100, ((this.now - start) / (minutes! * 60000)) * 100),
            )
          : null;
      const fresh =
        value?.state === "ready" &&
        !value.error &&
        Number.isFinite(observed) &&
        this.now - observed <= 300000 &&
        observed <= this.now + 30000;
      const eligible =
        fresh &&
        start !== null &&
        start >= this.now - 32 * 86400000 &&
        reset > this.now &&
        w.usedPercent >= 1 &&
        w.usedPercent < 100 &&
        w.poolId !== "base_model_inference" &&
        w.scope !== "gpt-reserve" &&
        (pools.size <= 1 || w.poolId === "codex") &&
        Number.isFinite(historyAt) &&
        this.now - historyAt <= 300000 &&
        historyAt <= this.now + 30000 &&
        Math.abs(observed - historyAt) <= 300000;
      const usage = eligible
        ? this.metrics(
            "at BETWEEN ? AND ? AND reliable=1 AND input>=cached",
            start,
            Math.min(this.now, observed, historyAt),
          )
        : null;
      return {
        id: w.id,
        durationMinutes: minutes,
        usedPercent: w.usedPercent,
        resetsAt: Number.isFinite(reset) ? reset : null,
        elapsedPercent: elapsed,
        exhaustsAt:
          start !== null && this.now > start && w.usedPercent > 0
            ? start + ((this.now - start) * 100) / w.usedPercent
            : null,
        cycleUsd:
          usage && usage.cost > 0 ? (usage.cost * 100) / w.usedPercent : null,
        cycleIncomplete:
          !!usage &&
          (usage.costIncomplete ||
            !!this.one("SELECT max(incomplete) AS n FROM threads").n ||
            !!scan?.issues?.length),
      };
    });
    return {
      plan: value?.plan ?? null,
      credits: value?.credits ?? null,
      availableResets: value?.availableResets ?? null,
      windows,
      state: value?.state ?? "loading",
      reason: value?.error?.code ?? null,
      observedAt: Number.isFinite(observed) ? observed : null,
    };
  }
}
function readRecord(path: string, offset: number, length: number): Json {
  const fd = openSync(path, "r");
  try {
    const b = Buffer.alloc(length);
    if (readSync(fd, b, 0, length, offset) !== length)
      throw Error("source-changed");
    return JSON.parse(b.toString("utf8"));
  } finally {
    closeSync(fd);
  }
}

function excerpt(value: string, limit: number) {
  // Copy the bounded UTF-16 string so cached slices do not retain large bodies.
  return value.length <= limit
    ? value
    : Buffer.from(value.slice(0, limit), "utf16le").toString("utf16le");
}
