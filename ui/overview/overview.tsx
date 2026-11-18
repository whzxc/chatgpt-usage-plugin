import { useEffect, useRef, useState } from "react";
import { Header, Panel } from "../components/ui/controls";
import { Status } from "../shared/status";
import { usePoll } from "../shared/poll";
import { callData } from "../app/bridge";
import type {
  OverviewInitial,
  Quota,
  Range,
  Summary,
  Tasks,
} from "../shared/types";
import { QuotaBlock } from "./quota";
import { UsageSummary } from "./usage-summary";
import { UsageChart } from "./usage-trend";
import { TaskTable } from "./task-list";
import "./overview.css";

export default function Overview({
  initial,
  onOpen,
  active = true,
}: {
  initial: OverviewInitial;
  onOpen: (id: string) => void;
  active?: boolean;
}) {
  const [range, setRange] = useState<Range>(initial.range),
    [summary, setSummary] = useState(initial.summary),
    [tasks, setTasks] = useState(initial.tasks),
    [quota, setQuota] = useState(initial.quota),
    [sort, setSort] = useState<"recent" | "cost" | "tokens">("recent"),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const first = useRef(true),
    request = useRef<AbortController | null>(null);
  const load = async (refreshQuota = false) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    const results = await Promise.allSettled([
      callData<Summary>("usage_summary", { range }, controller.signal),
      callData<Tasks>(
        "usage_tasks",
        {
          range,
          sort,
          ...(search ? { query: search } : {}),
          page,
          pageSize: 10,
        },
        controller.signal,
      ),
      callData<Quota>(
        "usage_quota",
        refreshQuota ? { refresh: true } : {},
        controller.signal,
      ),
    ]);
    if (controller.signal.aborted) return;
    const [s, t, q] = results;
    const failed =
      results.some((r) => r.status === "rejected") ||
      (s.status === "fulfilled" && s.value.index.state === "unavailable") ||
      (t.status === "fulfilled" && t.value.index.state === "unavailable") ||
      (q.status === "fulfilled" &&
        quota.state === "ready" &&
        q.value.state !== "ready");
    if (!failed) {
      if (s.status === "fulfilled") setSummary(s.value);
      if (t.status === "fulfilled") setTasks(t.value);
      if (q.status === "fulfilled") setQuota(q.value);
    }
    setError(failed ? "更新失败" : "");
    setBusy(false);
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem("usage-range");
      if (saved === "today" || saved === "7d" || saved === "30d")
        setRange(saved);
    } catch {}
    return () => request.current?.abort();
  }, []);
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(id);
  }, [query]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void load(false);
  }, [range, sort, search, page]);
  usePoll(
    () => load(false),
    summary.index.state === "indexing" ? 1000 : 30000,
    active,
  );
  useEffect(() => {
    if (!active || quota.state === "ready") return;
    let stopped = false,
      timer = 0,
      delay = 500;
    const schedule = () => {
      if (!stopped && document.visibilityState === "visible") {
        timer = window.setTimeout(poll, delay);
        delay = Math.min(30000, delay * 2);
      }
    };
    const poll = async () => {
      try {
        const next = await callData<Quota>("usage_quota", {});
        if (stopped) return;
        setQuota(next);
        if (next.state !== "ready") schedule();
      } catch {
        schedule();
      }
    };
    const visible = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", visible);
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [active, quota.state === "ready"]);
  const chooseRange = (v: Range) => {
    try {
      localStorage.setItem("usage-range", v);
    } catch {}
    setRange(v);
    setPage(1);
  };
  const index = summary.index;
  return (
    <Panel>
      <Header
        title="用量"
        busy={busy}
        updated={quota.observedAt}
        refresh={() => void load(true)}
      />
      <QuotaBlock quota={quota} retry={() => void load(true)} />
      {error && <Status kind="stale" retry={() => void load()} />}
      <UsageSummary
        summary={summary}
        range={range}
        onRange={chooseRange}
        busy={busy}
        retry={() => void load()}
      />
      {index.state === "ready" &&
        (summary.totals.requests === 0 ? (
          <Status kind="empty" />
        ) : (
          <>
            {summary.totals.tokens === null ? (
              <Status kind="warning" message="部分模型未定价，用量字段缺失。" />
            ) : (
              <UsageChart summary={summary} range={range} />
            )}
            <TaskTable
              data={tasks}
              sort={sort}
              query={query}
              setSort={(v) => {
                setSort(v);
                setPage(1);
              }}
              setQuery={setQuery}
              setPage={setPage}
              open={onOpen}
            />
          </>
        ))}
    </Panel>
  );
}
