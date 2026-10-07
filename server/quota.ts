import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { version, type Json } from "./common.js";
import { installation } from "./installation.js";
const base = {
  providerId: "codex",
  agentId: "codex",
  name: "Codex",
  eligible: true,
  selected: true,
  windows: [],
  blockedPoolIds: [],
};
export class Quota {
  value: Json = { ...base, state: "loading" };
  checked = 0;
  refreshing = false;
  children = new Set<ChildProcessWithoutNullStreams>();
  constructor(readonly history: () => Promise<Json>) {}
  snapshot(force: boolean): Json {
    if (!this.refreshing && (force || Date.now() - this.checked >= 60000)) {
      this.refreshing = true;
      void this.read()
        .then(normalize, (error) => ({
          ...base,
          state: "unavailable",
          error: { code: "request-failed", message: (error as Error).message },
        }))
        .then((value: Json) => {
          value.rawUsage ??= {};
          // Publish quota immediately; full history indexing has its own worker.
          void this.history()
            .then((history) => {
              if (this.value === value) value.rawUsage.history = history;
            })
            .catch(() => {});
          if (value.state === "unavailable" && this.value.observedAt) {
            this.value.error = value.error;
            this.value.state = "stale";
          } else this.value = value;
        })
        .finally(() => {
          this.checked = Date.now();
          this.refreshing = false;
        });
    }
    return { ...this.value, refreshing: this.refreshing };
  }
  async read(): Promise<Json> {
    const child = spawn(installation(), ["app-server"], {
      stdio: "pipe",
      windowsHide: true,
    });
    this.children.add(child);
    child.once("close", () => this.children.delete(child));
    child.stderr.resume();
    try {
      return await new Promise<Json>((resolve, reject) => {
        let bytes = Buffer.alloc(0),
          settled = false;
        const timeout = setTimeout(
          () => reject(new Error("Quota request timed out")),
          25000,
        );
        const done = (error: Error | null, value?: Json) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve(value!);
        };
        child.on("error", (e) => done(e));
        child.on("exit", () =>
          done(new Error("Native quota reader disconnected")),
        );
        child.stdin.on("error", (e) => done(e));
        child.stdout.on("data", (chunk: Buffer) => {
          if (settled) return;
          bytes = Buffer.concat([bytes, chunk]);
          for (;;) {
            const end = bytes.indexOf(10);
            if (end < 0) {
              if (bytes.length > 4 * 1024 * 1024)
                done(new Error("FRAME_TOO_LARGE"));
              break;
            }
            if (end > 4 * 1024 * 1024) {
              done(new Error("FRAME_TOO_LARGE"));
              return;
            }
            let value: Json;
            try {
              value = JSON.parse(bytes.subarray(0, end).toString("utf8"));
            } catch {
              done(new Error("Invalid quota response"));
              return;
            }
            bytes = bytes.subarray(end + 1);
            if (value.method || ![1, 2].includes(value.id)) continue;
            if (value.error) {
              done(new Error(JSON.stringify(value.error)));
              return;
            }
            if (value.id === 1)
              child.stdin.write(
                '{"method":"initialized"}\n{"id":2,"method":"account/rateLimits/read","params":{}}\n',
              );
            else {
              done(null, value.result);
              return;
            }
          }
        });
        child.stdin.write(
          JSON.stringify({
            id: 1,
            method: "initialize",
            params: {
              clientInfo: { name: "chatgpt-usage", version },
              capabilities: { experimentalApi: true },
            },
          }) + "\n",
        );
      });
    } finally {
      child.stdin.end();
      const kill = setTimeout(() => child.kill(), 2000);
      kill.unref();
      child.once("exit", () => clearTimeout(kill));
    }
  }
  stop() {
    for (const child of this.children) child.kill();
  }
}
function normalize(raw: Json): Json {
  const groups: Json =
      raw.rateLimitsByLimitId ??
      (raw.rateLimits
        ? { [raw.rateLimits.limitId ?? "codex"]: raw.rateLimits }
        : {}),
    windows: Json[] = [],
    blocked: string[] = [];
  for (const pool of Object.keys(groups).sort()) {
    const group = groups[pool];
    if (
      typeof group.rateLimitReachedType === "string" ||
      group.spendControlReached === true
    )
      blocked.push(pool);
    for (const slot of ["primary", "secondary"]) {
      const q = group[slot],
        used = q?.usedPercent;
      if (typeof used !== "number" || !Number.isFinite(used)) continue;
      const at =
        typeof q.resetsAt === "number" ? new Date(q.resetsAt * 1000) : null;
      windows.push({
        id: `${pool}/${slot}`,
        poolId: pool,
        label:
          Number.isSafeInteger(q.windowDurationMins) &&
          q.windowDurationMins >= 0
            ? `${q.windowDurationMins} min`
            : slot,
        usedPercent: Math.min(100, Math.max(0, used)),
        resetsAt: at && Number.isFinite(at.getTime()) ? at.toISOString() : null,
        scope: group.limitName ?? null,
        exhausted: used >= 100,
      });
    }
  }
  return {
    ...base,
    state: windows.length ? "ready" : "unavailable",
    windows,
    blockedPoolIds: blocked,
    observedAt: new Date().toISOString(),
    accountBlocked:
      typeof raw.ordinaryUsageAllowed === "boolean"
        ? !raw.ordinaryUsageAllowed
        : null,
    rawUsage: raw,
  };
}
