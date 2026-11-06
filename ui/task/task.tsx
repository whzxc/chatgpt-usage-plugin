import { useEffect, useRef, useState } from "react";
import { callData } from "../app/bridge";
import {
  Header,
  Section,
  MetricGrid,
  BackButton,
} from "../components/ui/controls";
import { summaryFigures } from "../overview/overview";
import { compact, integer, percent } from "../shared/format";
import { usePoll } from "../shared/poll";
import { Status, Failure, Indexing } from "../shared/status";
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
        if (next.index.state === "unavailable" && data?.thread) {
          setError(next.index.reason || "更新失败");
        } else if (next.index.state !== "indexing" || !data?.thread) {
          setData(next);
          setUpdated(Date.now());
          setError("");
        }
      }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
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
      {data && !thread && data.index.state === "ready" ? (
        <>
          {onBack && (
            <nav>
              <BackButton onClick={onBack} />
            </nav>
          )}
          <Status kind="empty" message="这个任务还没有用量记录" />
        </>
      ) : (
        <>
          <Header
            title={data?.thread?.title || "任务用量"}
            updated={updated}
            busy={busy}
            refresh={() => void load()}
            back={onBack}
          />
          {!data ? (
            error ? (
              <Failure error={error} retry={() => void load()} />
            ) : (
              <Status />
            )
          ) : data.index.state === "indexing" ? (
            <Indexing index={data.index} />
          ) : data.index.state === "unavailable" ? (
            <Failure
              error={data.index.reason || "无法读取本机用量"}
              retry={() => void load()}
            />
          ) : (
            thread && (
              <>
                {error && <Status kind="stale" retry={() => void load()} />}
                <TaskSummary thread={thread} />
                {thread.requestInputs.length > 1 && (
                  <ContextChart
                    thread={thread}
                    expanded={expanded}
                    onOpen={openTurn}
                  />
                )}
                <CurrentContext context={thread.context} />
                <Section title="轮次 · 最新在前">
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
                </Section>
              </>
            )
          )}
        </>
      )}
    </main>
  );
}
export function TaskSummary({ thread }: { thread: Thread }) {
  return (
    <MetricGrid
      columns={2}
      items={summaryFigures({ ...thread.totals, tasks: 1 }).filter((_, i) =>
        [0, 1, 4, 5].includes(i),
      )}
    />
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
  toolCalls: "var(--tool)",
  compaction: "var(--m4)",
  messages: "var(--context-messages)",
  fixed: "var(--context-fixed)",
};
export function CurrentContext({ context }: { context: Thread["context"] }) {
  if (context.used === null) return null;
  const limit = context.window,
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
            color: "var(--border)",
            tokens: remaining,
            details: undefined,
          },
        ]),
  ];
  return (
    <Section
      title="当前占用"
      actions={
        <span className="meta">
          {`${compact(context.used)} / ${compact(limit)} tokens`}
        </span>
      }
    >
      <div
        className="use-bar"
        role="img"
        aria-label={"当前占用 " + integer(context.used) + " tokens"}
      >
        {parts.map((p) => (
          <span key={p.kind} style={{ flex: p.tokens, background: p.color }} />
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
                  .join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="meta">分类为估算，合计等于最近一次请求的输入。</p>
    </Section>
  );
}
