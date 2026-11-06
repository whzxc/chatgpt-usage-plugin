import { useEffect, useRef, useState } from "react";
import { SingleChoice } from "../components/ui/SingleChoice";
import {
  Button,
  Header,
  Section,
  MetricGrid,
  Search,
  Tooltip,
} from "../components/ui/controls";
import { Chevron } from "../components/ui/Icons";
import { Status, Indexing, Failure } from "../shared/status";
import { usePoll } from "../shared/poll";
import { callData } from "../app/bridge";
import {
  compact,
  axisCompact,
  calendarTime,
  duration,
  integer,
  money,
  percent,
  productName,
  time,
} from "../shared/format";
import type {
  OverviewInitial,
  Quota,
  Range,
  Summary,
  Tasks,
} from "../shared/types";

const ranges: [Range, string][] = [
  ["today", "今天"],
  ["7d", "7 天"],
  ["30d", "30 天"],
];
export const modelColor = (slot: number) =>
  slot === 1
    ? "var(--model-primary)"
    : slot === 2
      ? "var(--model-secondary)"
      : "var(--model-other)";
export function QuotaBar({ window: w }: { window: Quota["windows"][number] }) {
  const remaining = Math.max(0, Math.min(100, 100 - w.usedPercent));
  const cycle =
    w.elapsedPercent === null
      ? null
      : 100 - Math.max(0, Math.min(100, w.elapsedPercent));
  const over =
    w.elapsedPercent !== null && w.usedPercent > w.elapsedPercent + 10;
  const name =
    w.durationMinutes === 10080
      ? "每周"
      : w.durationMinutes
        ? `${Math.round(w.durationMinutes / 60)} 小时`
        : w.id;
  const reset =
    w.resetsAt === null
      ? "—"
      : new Date(w.resetsAt).toDateString() === new Date().toDateString()
        ? time(w.resetsAt)
        : calendarTime(w.resetsAt);
  return (
    <div className="quota">
      <div className="quota-line">
        <span>{name}</span>
        <strong
          className={remaining === 0 ? "danger" : over ? "warning" : undefined}
        >
          {`剩余 ${percent(remaining)}`}
        </strong>
      </div>
      <div
        className="meter"
        role="meter"
        aria-label={`${name}剩余额度`}
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={`meter-fill ${remaining === 0 ? "critical" : over ? "over" : ""}`}
          style={{ width: `${remaining}%` }}
        />
        {cycle !== null && (
          <i className="meter-now" style={{ left: `${cycle}%` }} />
        )}
      </div>
      <div className="quota-line muted">
        <span>{`周期剩余 ${percent(cycle)}`}</span>
        <span>{`${reset} 重置`}</span>
      </div>
      {(remaining === 0 || over) && (
        <span className={remaining === 0 ? "danger" : "warning"}>
          {remaining === 0 ? "额度已用完" : "额度消耗快于周期进度"}
        </span>
      )}
    </div>
  );
}
export function QuotaBlock({
  quota,
  retry,
}: {
  quota: Quota;
  retry: () => void;
}) {
  return (
    <Section
      title="账户额度"
      actions={
        quota.state === "ready" &&
        quota.plan && <span className="meta">{productName(quota.plan)}</span>
      }
    >
      {quota.state === "loading" ? (
        <Status message="正在读取账户额度" />
      ) : quota.state !== "ready" ? (
        <Failure
          error={`无法读取账户额度：${quota.reason || "账户不可用"}`}
          retry={retry}
        />
      ) : (
        <>
          {(quota.credits !== null || quota.availableResets !== null) && (
            <p className="meta">
              {[
                quota.credits !== null
                  ? `积分 ${integer(quota.credits)}`
                  : null,
                quota.availableResets !== null
                  ? `可用重置 ${integer(quota.availableResets)} 次`
                  : null,
              ]
                .filter((value) => value !== null)
                .join(" · ")}
            </p>
          )}
          <div className="quota-grid">
            {[...quota.windows]
              .sort(
                (a, b) =>
                  (a.durationMinutes ?? Infinity) -
                  (b.durationMinutes ?? Infinity),
              )
              .map((w) => (
                <QuotaBar key={w.id} window={w} />
              ))}
          </div>
        </>
      )}
    </Section>
  );
}
export function summaryFigures(t: Summary["totals"]) {
  return [
    {
      label: "估算费用",
      value: money(t.cost),
      detail: t.costIncomplete ? "部分模型未定价" : "按 API 价格估算",
    },
    {
      label: "Tokens",
      value: compact(t.tokens),
      detail: `输入 ${compact(t.input)} · 输出 ${compact(t.output)}`,
    },
    {
      label: "缓存命中",
      value: percent(
        t.input && t.cached !== null ? (100 * t.cached) / t.input : null,
      ),
      detail: `${compact(t.cached)} 来自缓存`,
    },
    {
      label: "请求",
      value: integer(t.requests),
      detail: `${integer(t.tasks)} 个任务`,
    },
    {
      label: "TPS",
      value: t.outputTps === null ? "—" : t.outputTps.toFixed(1),
      detail: "tok/s · 按整轮用时",
    },
    {
      label: "TTFT",
      value: duration(t.ttftMedianMs),
      detail: `P90 ${duration(t.ttftP90Ms)} · P99 ${duration(t.ttftP99Ms)}`,
    },
  ];
}
export function Figures({ summary }: { summary: Summary }) {
  return <MetricGrid items={summaryFigures(summary.totals)} />;
}
export function ModelLegend({
  summary,
  metric = "tokens",
}: {
  summary: Summary;
  metric?: "tokens" | "cost";
}) {
  const total = summary.models.reduce((sum, m) => sum + (m[metric] ?? 0), 0);
  return (
    <div className="legend">
      {summary.models.map((m) => (
        <div className="legend-item" key={m.id}>
          <div className="legend-head">
            <i className="swatch" style={{ background: modelColor(m.slot) }} />
            <span className="name">{m.id}</span>
            <strong>
              {metric === "tokens" ? compact(m.tokens) : money(m.cost)}
            </strong>
          </div>
          <span className="meta">
            {`${percent(total && m[metric] !== null ? (100 * m[metric]!) / total : null)} · ${money(m.cost)} · ${integer(m.requests)} req · ${m.outputTps === null ? "—" : m.outputTps.toFixed(1)} tok/s`}
          </span>
        </div>
      ))}
    </div>
  );
}
export function UsageChart({
  summary,
  range,
}: {
  summary: Summary;
  range: Range;
}) {
  const [metric, setMetric] = useState<"tokens" | "cost">("tokens"),
    [active, setActive] = useState<number | null>(null);
  const models = [...summary.models].sort((a, b) => a.slot - b.slot),
    hourly = range === "today";
  const totals = summary.buckets.map((b) =>
    b.models.reduce((sum, m) => sum + (m[metric] ?? 0), 0),
  );
  const step = metric === "tokens" ? 100000 : 0.5,
    maximum = Math.max(step, Math.ceil(Math.max(...totals, 0) / step) * step);
  const label = (at: number) => {
    const d = new Date(at);
    return hourly
      ? String(d.getHours()).padStart(2, "0")
      : `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };
  const format = metric === "tokens" ? compact : money;
  return (
    <Section
      title={hourly ? "今天每小时用量" : "每日用量"}
      actions={
        <SingleChoice
          label="图表指标"
          value={metric}
          options={[
            ["tokens", "Tokens"],
            ["cost", "费用"],
          ]}
          onChange={setMetric}
        />
      }
    >
      <div className="usage-plot">
        <div className="usage-scale">
          {[maximum, maximum / 2, 0].map((v) => (
            <span key={v}>
              {metric === "tokens" ? axisCompact(v) : money(v)}
            </span>
          ))}
        </div>
        <div
          className={`usage-buckets${hourly ? " hourly" : ""}`}
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, summary.buckets.length)},minmax(0,1fr))`,
          }}
        >
          {summary.buckets.map((b, i) => (
            <button
              className="usage-bucket"
              key={b.at}
              aria-label={`${label(b.at)}，${format(totals[i])}`}
              aria-pressed={active === i}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setActive(null);
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const next = Math.max(
                    0,
                    Math.min(
                      summary.buckets.length - 1,
                      i + (e.key === "ArrowRight" ? 1 : -1),
                    ),
                  );
                  (
                    e.currentTarget.parentElement?.children[next] as HTMLElement
                  )?.focus();
                }
              }}
            >
              <span className="usage-bar">
                {models.map((m) => (
                  <i
                    key={m.id}
                    style={{
                      height: `${((b.models.find((x) => x.id === m.id)?.[metric] ?? 0) / maximum) * 100}%`,
                      background: modelColor(m.slot),
                    }}
                  />
                ))}
              </span>
              <span>{!hourly || i % 4 === 0 ? label(b.at) : " "}</span>
            </button>
          ))}
        </div>
      </div>
      {active !== null && summary.buckets[active] && (
        <div className="inspection">
          <div
            style={{
              position: "absolute",
              width: 240,
              maxWidth: "100%",
              left: `clamp(0px, calc(60px + (100% - 60px) * ${(active + 0.5) / summary.buckets.length} - 120px), max(0px, 100% - 240px))`,
            }}
          >
            <Tooltip
              title={label(summary.buckets[active].at)}
              rows={models.map((m) => ({
                label: m.id,
                value: format(
                  summary.buckets[active].models.find((x) => x.id === m.id)?.[
                    metric
                  ] ?? null,
                ),
              }))}
            />
          </div>
        </div>
      )}
      {models.length > 1 && <ModelLegend summary={summary} metric={metric} />}
    </Section>
  );
}
export function TaskColumns() {
  return (
    <div className="task-columns">
      {["任务", "Tokens", "估算费用", "缓存命中", "TPS", "TTFT"].map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
export function TaskRow({
  task: t,
  open,
}: {
  task: Tasks["tasks"][number];
  open: (id: string) => void;
}) {
  return (
    <div className="task-row" onClick={() => open(t.threadId)}>
      <div className="task-title">
        <button
          className="task-name"
          onClick={(e) => {
            e.stopPropagation();
            open(t.threadId);
          }}
        >
          {t.title || t.threadId}
        </button>
        <span className="task-sub">
          {`${integer(t.turns)} 轮 · ${integer(t.requests)} 次请求 · ${calendarTime(t.lastActivity)}${t.running ? " · 进行中" : ""}`}
        </span>
      </div>
      {[
        compact(t.tokens),
        money(t.cost),
        percent(
          t.input && t.cached !== null ? (100 * t.cached) / t.input : null,
        ),
        t.outputTps === null ? "—" : t.outputTps.toFixed(1),
        duration(t.ttftMedianMs),
      ].map((v, i) => (
        <span key={i}>{v}</span>
      ))}
    </div>
  );
}
export function TaskTable({
  data,
  sort,
  query,
  setSort,
  setQuery,
  setPage,
  open,
}: {
  data: Tasks;
  sort: "recent" | "cost" | "tokens";
  query: string;
  setSort: (v: "recent" | "cost" | "tokens") => void;
  setQuery: (v: string) => void;
  setPage: (v: number) => void;
  open: (id: string) => void;
}) {
  const start = data.total ? (data.page - 1) * data.pageSize + 1 : 0,
    end = Math.min(data.total, data.page * data.pageSize);
  return (
    <Section title={`任务 ${integer(data.total)}`}>
      <div className="task-filters">
        <SingleChoice
          label="任务排序"
          value={sort}
          options={[
            ["recent", "最近活动"],
            ["cost", "费用"],
            ["tokens", "Tokens"],
          ]}
          onChange={setSort}
        />
        <Search value={query} onChange={setQuery} />
      </div>
      {data.tasks.length ? (
        <div className="task-grid">
          <TaskColumns />
          {data.tasks.map((t) => (
            <TaskRow task={t} key={t.threadId} open={open} />
          ))}
        </div>
      ) : (
        <Status kind="empty" message="没有匹配的任务" />
      )}
      <div className="pager">
        <span>{`第 ${start}–${end} 个，共 ${integer(data.total)} 个`}</span>
        <div className="btns">
          <Button
            label="上一页"
            disabled={data.page <= 1}
            onClick={() => setPage(data.page - 1)}
          >
            <Chevron />
          </Button>
          <Button
            label="下一页"
            disabled={end >= data.total}
            onClick={() => setPage(data.page + 1)}
          >
            <Chevron next />
          </Button>
        </div>
      </div>
    </Section>
  );
}
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
    <main className="overview">
      <Header
        title="用量"
        busy={busy}
        updated={quota.observedAt}
        refresh={() => void load(true)}
      />
      <QuotaBlock quota={quota} retry={() => void load(true)} />
      {error && <Status kind="stale" retry={() => void load()} />}
      <Section
        title="本机用量"
        actions={
          index.state === "ready" && (
            <SingleChoice
              value={range}
              label="用量范围"
              options={ranges}
              onChange={chooseRange}
              disabled={busy}
            />
          )
        }
      >
        {index.state === "indexing" ? (
          <Indexing index={index} />
        ) : index.state === "unavailable" ? (
          <Failure
            error={index.reason || "无法读取本机用量"}
            retry={() => void load()}
          />
        ) : (
          <Figures summary={summary} />
        )}
      </Section>
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
    </main>
  );
}
