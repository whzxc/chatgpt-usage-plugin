import { useEffect, useRef, useState } from "react";
import { callData } from "../app/bridge";
import { InboxIcon, RefreshIcon } from "../shared/icons";
import {
  compact,
  integer,
  money,
  percent,
  time,
  ttft,
  when,
} from "../shared/format";
import { usePoll } from "../shared/poll";
import { Failure, Indexing } from "../shared/status";
import type { ThreadData, Thread } from "../shared/types";
import { ContextChart } from "./context-chart";
import { TurnRow } from "./turn";
import "./task.css";

export default function TaskPage({
  initial,
  threadId,
  onBack,
}: {
  initial?: ThreadData;
  threadId?: string;
  onBack?: () => void;
}) {
  const [data, setData] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(Date.now()),
    [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pending = useRef(false),
    alive = useRef(true);
  const load = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const next = await callData<ThreadData>(
        "usage_thread",
        threadId ? { threadId } : {},
      );
      if (alive.current) {
        setData((prev) =>
          next.index.state === "indexing" && prev?.thread ? prev : next,
        );
        setUpdated(Date.now());
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(String(e));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    if (!initial) void load();
    return () => {
      alive.current = false;
    };
  }, [threadId]);
  useEffect(() => {
    if (initial) setData(initial);
  }, [initial]);
  usePoll(
    load,
    data?.index.state === "indexing"
      ? 1000
      : data?.thread?.running
        ? 3000
        : 30000,
  );
  const thread =
    data?.thread &&
    (data.thread.totals.requests > 0 || data.thread.totals.tokens !== null)
      ? data.thread
      : null;
  const openTurn = (id: string) => {
    setExpanded((s) => new Set(s).add(id));
    requestAnimationFrame(() =>
      document.getElementById("turn-" + id)?.scrollIntoView({ block: "start" }),
    );
  };
  return (
    <main className="task-page">
      {onBack && (
        <nav className="task-nav">
          <button className="text-btn back" onClick={onBack}>
            ← 全部任务
          </button>
        </nav>
      )}
      {error && <Failure error={error} retry={() => void load()} />}
      {!data ? (
        <p className="app-state">正在读取本机用量。</p>
      ) : !thread && data.index.state === "indexing" ? (
        <Indexing index={data.index} />
      ) : !thread && data.index.state === "unavailable" ? (
        <Failure
          error={data.index.reason || "无法读取本机用量。"}
          retry={() => void load()}
        />
      ) : !thread ? (
        <section className="empty">
          <div className="empty-icon">
            <InboxIcon />
          </div>
          <h1>这个任务还没有用量记录</h1>
          <p>
            任务发出第一次请求后，这里会显示它的费用、tokens
            和每一轮的明细。用量来自这台电脑上的 Codex 日志。
          </p>
        </section>
      ) : (
        <>
          <section className="task-heading">
            <div className="task-title-row">
              <h1>{thread.title || thread.threadId}</h1>
              <div className="task-refresh">
                <span>{busy ? "正在更新" : time(updated) + " 更新"}</span>
                <button
                  className={"icon-btn" + (busy ? " is-busy" : "")}
                  disabled={busy}
                  aria-label="刷新"
                  onClick={() => void load()}
                >
                  <RefreshIcon />
                </button>
              </div>
            </div>
            <div className="task-meta">
              <span>{integer(thread.totals.turns)} 轮</span>
              <span>
                {thread.model}
                {thread.models.length > 1
                  ? " 等 " + thread.models.length + " 个模型"
                  : ""}
              </span>
              {thread.serviceTier && (
                <span>
                  {thread.serviceTier === "fast" ||
                  thread.serviceTier === "priority"
                    ? "Fast"
                    : thread.serviceTier}
                </span>
              )}
              <span>最近活动 {when(thread.lastActivity)}</span>
            </div>
          </section>
          <Figures thread={thread} />
          {thread.requestInputs.length > 1 && (
            <ContextChart
              thread={thread}
              expanded={expanded}
              onOpen={openTurn}
            />
          )}
          <CurrentContext context={thread.context} />
          <section className="turns">
            <div className="turns-head">
              <h2>轮次</h2>
              <span className="count">{thread.turns.length}</span>
              <span className="hint">最新在前</span>
            </div>
            <div className="turn-list">
              {[...thread.turns].reverse().map((turn) => (
                <TurnRow
                  key={turn.turnId}
                  threadId={thread.threadId}
                  summary={turn}
                  open={expanded.has(turn.turnId)}
                  toggle={() =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      n.has(turn.turnId)
                        ? n.delete(turn.turnId)
                        : n.add(turn.turnId);
                      return n;
                    })
                  }
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
function Figures({ thread }: { thread: Thread }) {
  const t = thread.totals,
    cache = t.input && t.cached !== null ? (t.cached * 100) / t.input : null;
  const rows = [
    [
      "估算费用",
      money(t.cost),
      "",
      integer(t.requests) + " 次请求，" + integer(t.tools) + " 次工具调用",
    ],
    [
      "Tokens",
      compact(t.tokens),
      "",
      "缓存命中 " +
        (cache === null ? "—" : percent(cache)) +
        "，输出 " +
        compact(t.output),
    ],
    [
      "TPS",
      t.outputTps === null ? "—" : t.outputTps.toFixed(1),
      t.outputTps === null ? "" : "tok/s",
      "整轮输出 tokens ÷ 用时",
    ],
    [
      "TTFT",
      t.ttftMedianMs === null ? "—" : (t.ttftMedianMs / 1000).toFixed(1),
      t.ttftMedianMs === null ? "" : "s",
      `P90 ${ttft(t.ttftP90Ms)}, P99 ${ttft(t.ttftP99Ms)}`,
    ],
  ];
  return (
    <div className="pair">
      {rows.map(([label, value, unit, detail]) => (
        <div className="figure" key={label}>
          <span className="label">{label}</span>
          <strong className="value num">
            {value}
            {unit && <span className="unit">{unit}</span>}
          </strong>
          <span className="detail">{detail}</span>
        </div>
      ))}
    </div>
  );
}
const labels = {
  toolResults: "工具结果",
  reasoning: "推理",
  toolCalls: "工具调用",
  compaction: "压缩摘要",
  messages: "对话消息",
  fixed: "固定开销",
};
const colors = {
  toolResults: "var(--m1)",
  reasoning: "var(--m2)",
  toolCalls: "var(--m3)",
  compaction: "var(--m4)",
  messages: "var(--ink-3)",
  fixed: "var(--ink-2)",
};
function CurrentContext({ context }: { context: Thread["context"] }) {
  if (context.used === null) return null;
  const limit = context.window,
    denominator = limit || context.used || 1,
    remaining = limit === null ? null : Math.max(0, limit - context.used);
  const parts = [
    ...context.parts.map((p) => ({
      ...p,
      label: labels[p.kind],
      color: colors[p.kind],
    })),
    ...(remaining === null
      ? []
      : [
          {
            kind: "remaining",
            label: "剩余空间",
            color: "var(--track)",
            tokens: remaining,
            details: undefined,
          },
        ]),
  ];
  return (
    <section className="use">
      <div className="use-head">
        <h2>当前占用</h2>
        <span>
          <b>{compact(context.used)}</b> / {compact(limit)}
          {limit ? "，" + Math.round((context.used * 100) / limit) + "%" : ""}
        </span>
      </div>
      <div
        className="use-bar"
        role="img"
        aria-label={"当前占用 " + integer(context.used) + " tokens"}
      >
        {parts
          .filter((p) => p.tokens / denominator >= 0.005)
          .map((p) => (
            <span
              key={p.kind}
              style={{ flex: p.tokens, background: p.color }}
            />
          ))}
      </div>
      <ul className="use-list">
        {parts.map((p) => (
          <li
            key={p.kind}
            className={p.kind === "remaining" ? "free" : undefined}
          >
            <i className="sw" style={{ background: p.color }} />
            <span>{p.label}</span>
            <span>{compact(p.tokens)}</span>
            <span className="pc">
              {limit ? percent((p.tokens * 100) / limit) : "—"}
            </span>
            {p.details && (
              <span className="sub">
                {p.details
                  .map((d) => d.name + " " + compact(d.tokens))
                  .join("，")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
