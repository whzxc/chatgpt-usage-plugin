import { useEffect, useRef, useState } from "react";
import { SingleChoice as Segmented } from "../components/ui/SingleChoice";
import { usePoll } from "../shared/poll";
import { callData } from "../app/bridge";
import { Chevron, RefreshIcon, SearchIcon, WarningIcon } from "../shared/icons";
import {
  bucketTitle,
  chartScale,
  compact,
  fullTime,
  integer,
  money,
  percent,
  productName,
  quotaPercent,
  time,
  ttft,
  when,
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
const colors = (slot: number) =>
  slot === 1
    ? "var(--m1)"
    : slot === 2
      ? "var(--m2)"
      : slot === 3
        ? "var(--m3)"
        : "var(--ink-3)";
function QuotaBlock({ quota, retry }: { quota: Quota; retry: () => void }) {
  if (quota.state === "loading")
    return (
      <section className="account quota-error">
        <span>正在读取账户额度</span>
      </section>
    );
  if (quota.state !== "ready")
    return (
      <section className="account quota-error">
        <span>无法读取账户额度：{quota.reason || "账户不可用"}</span>
        <button className="text-btn" onClick={retry}>
          重试
        </button>
      </section>
    );
  const windows = [...quota.windows].sort(
    (a, b) => (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity),
  );
  const tense = windows.reduce<(typeof windows)[number] | undefined>(
    (best, w) =>
      !best ||
      w.usedPercent - (w.elapsedPercent ?? w.usedPercent) >
        best.usedPercent - (best.elapsedPercent ?? best.usedPercent)
        ? w
        : best,
    undefined,
  );
  return (
    <section className="account" aria-labelledby="account-title">
      <div className="account-head">
        <h2 id="account-title">账户额度</h2>
        {quota.plan && <span className="plan">{productName(quota.plan)}</span>}
        <div className="account-meta">
          {quota.credits != null && <span>积分 {integer(quota.credits)}</span>}
          {quota.availableResets != null && (
            <span>可用重置 {integer(quota.availableResets)} 次</span>
          )}
        </div>
      </div>
      {windows.map((w) => {
        const over =
          w.usedPercent >= 100 ||
          (w.exhaustsAt != null &&
            w.resetsAt != null &&
            w.exhaustsAt < w.resetsAt) ||
          (w.elapsedPercent != null && w.usedPercent > w.elapsedPercent + 10);
        const now = 100 - Math.max(0, Math.min(100, w.elapsedPercent ?? 0));
        const remaining = Math.max(0, Math.min(100, 100 - w.usedPercent));
        const name =
          w.durationMinutes === 10080
            ? "每周"
            : w.durationMinutes
              ? `${Math.round(w.durationMinutes / 60)} 小时`
              : w.id;
        return (
          <div className="quota" key={w.id}>
            <div
              className="meter"
              role="meter"
              aria-label={`${name}额度剩余 ${quotaPercent(remaining)}，周期剩余 ${quotaPercent(now)}`}
              aria-valuenow={remaining}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className={`meter-fill ${w.usedPercent >= 100 ? "critical" : over ? "over" : ""}`}
                style={{ width: `${remaining}%` }}
              />
              <span className="meter-now" style={{ left: `${now}%` }} />
              <span
                className={`meter-label ${now < 5 ? "at-start" : now > 95 ? "at-end" : ""}`}
                style={{ left: `${now}%` }}
              >
                现在
              </span>
            </div>
            <span className="quota-used num">
              剩余 {quotaPercent(remaining)}
            </span>
            {w === tense && (
              <div className="quota-notes">
                {over ? (
                  <span className="pace">
                    <WarningIcon />
                    <span>
                      {w.usedPercent >= 100
                        ? `额度已用完，${fullTime(w.resetsAt)} 重置`
                        : w.exhaustsAt
                          ? `按当前速度约 ${Math.max(1, Math.round((w.exhaustsAt - Date.now()) / 36e5))} 小时后用完`
                          : "额度消耗快于周期进度"}
                    </span>
                  </span>
                ) : (
                  <span />
                )}
                <span className="quota-facts">
                  {w.cycleUsd != null && (
                    <span>整周约合 {money(w.cycleUsd)}</span>
                  )}
                  {w.resetsAt && <span>{fullTime(w.resetsAt)} 重置</span>}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function Figures({ summary }: { summary: Summary }) {
  const t = summary.totals,
    cache = t.input ? (100 * (t.cached ?? 0)) / t.input : 0;
  const rows = [
    [
      "估算费用",
      money(t.cost),
      "",
      t.costIncomplete ? "部分模型未定价，费用偏低" : "按 API 价格估算",
    ],
    [
      "Tokens",
      compact(t.tokens ?? (summary.models.length === 0 ? 0 : null)),
      "",
      `输入 ${compact(t.input ?? (summary.models.length === 0 ? 0 : null))}，输出 ${compact(t.output ?? (summary.models.length === 0 ? 0 : null))}`,
    ],
    ["缓存命中", percent(cache), "", `${compact(t.cached)} 来自缓存`],
    ["请求", integer(t.requests), "", `${integer(t.tasks)} 个任务`],
    [
      "TPS",
      t.outputTps == null ? "—" : t.outputTps.toFixed(1),
      t.outputTps == null ? "" : "tok/s",
      "整轮输出 tokens ÷ 用时",
    ],
    [
      "TTFT",
      t.ttftMedianMs == null ? "—" : (t.ttftMedianMs / 1000).toFixed(1),
      t.ttftMedianMs == null ? "" : "s",
      `P90 ${ttft(t.ttftP90Ms)}, P99 ${ttft(t.ttftP99Ms)}`,
    ],
  ];
  return (
    <div className="figures">
      {rows.map(([l, v, u, d]) => (
        <div className="figure" key={l}>
          <span className="label">{l}</span>
          <strong className="value num">
            {v}
            {u && <span className="unit">{u}</span>}
          </strong>
          <span className="detail">{d}</span>
        </div>
      ))}
    </div>
  );
}

function UsageChart({ summary, range }: { summary: Summary; range: Range }) {
  const ref = useRef<HTMLDivElement>(null),
    [width, setWidth] = useState(0),
    [metric, setMetric] = useState<"tokens" | "cost">("tokens"),
    [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const chartWidth = Math.max(280, width),
    height = 220,
    left = 48,
    right = 8,
    top = 12,
    bottom = 28,
    inner = chartWidth - left - right;
  const totals = summary.buckets.map((b) =>
      b.models.reduce((n, m) => n + (m[metric] ?? 0), 0),
    ),
    scale = chartScale(Math.max(...totals, 0)),
    max = scale.maximum;
  const step = inner / Math.max(1, summary.buckets.length),
    bar = Math.min(24, step * 0.6);
  const models = [...summary.models].sort(
    (a, b) => (a.slot || 9) - (b.slot || 9),
  );
  const ticks = scale.ticks;
  return (
    <div className="trend">
      <div>
        <div className="trend-head">
          <h3>每日用量</h3>
          <Segmented
            value={metric}
            label="图表指标"
            options={[
              ["tokens", "Tokens"],
              ["cost", "费用"],
            ]}
            onChange={setMetric}
          />
        </div>
        <div className="chart" ref={ref}>
          {width > 0 && (
            <svg
              width={chartWidth}
              height={height}
              role="img"
              aria-label={`${range === "today" ? "今天每小时" : "每日"}${metric === "tokens" ? " Tokens" : "费用"}用量`}
            >
              {ticks.map((v, i) => {
                const y = top + (height - top - bottom) * (1 - v / max);
                return (
                  <g key={i}>
                    <line
                      className="grid"
                      x1={left}
                      x2={chartWidth - right}
                      y1={y}
                      y2={y}
                    />
                    <text x={left - 8} y={y + 4} textAnchor="end">
                      {metric === "tokens" ? compact(v) : money(v)}
                    </text>
                  </g>
                );
              })}
              {summary.buckets.map((bucket, i) => {
                const x = left + i * step + step / 2,
                  isActive = active === i;
                let y = height - bottom;
                const label =
                  i === summary.buckets.length - 1
                    ? range === "today"
                      ? "现在"
                      : "今天"
                    : new Date(bucket.at).toLocaleDateString(
                        "zh-CN",
                        range === "today"
                          ? { hour: "2-digit" }
                          : { month: "numeric", day: "numeric" },
                      );
                return (
                  <g
                    key={bucket.at}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${label}，${metric === "tokens" ? compact(totals[i]) : money(totals[i]!)}`}
                  >
                    <rect
                      className="hover-band"
                      opacity={isActive ? 1 : 0}
                      x={left + i * step + 2}
                      y={top}
                      width={Math.max(1, step - 4)}
                      height={height - top - bottom}
                    />
                    {models.map((model) => {
                      const val =
                        bucket.models.find((m) => m.id === model.id)?.[
                          metric
                        ] ?? 0;
                      if (!val) return null;
                      const h = Math.max(
                          1.5,
                          (val / max) * (height - top - bottom),
                        ),
                        current = y - h;
                      y = current;
                      return (
                        <rect
                          key={model.id}
                          x={x - bar / 2}
                          y={current}
                          width={bar}
                          height={h}
                          fill={colors(model.slot)}
                          rx={2}
                        />
                      );
                    })}
                    <text
                      className={
                        i === summary.buckets.length - 1 ? "today" : ""
                      }
                      x={x}
                      y={height - 8}
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          {active != null && (
            <ChartTip
              summary={summary}
              index={active}
              metric={metric}
              range={range}
              left={left + active * step + step / 2}
              width={chartWidth}
            />
          )}
        </div>
      </div>
      {models.length > 1 && (
        <ul className="legend">
          {models.map((m) => {
            const total = summary.models.reduce(
              (n, x) => n + (x[metric] ?? 0),
              0,
            );
            return (
              <li key={m.id}>
                <span
                  className="swatch"
                  style={{ background: colors(m.slot) }}
                />
                <span className="name">{m.id}</span>
                <strong className="val">
                  {metric === "tokens" ? compact(m.tokens) : money(m.cost)}
                </strong>
                <span className="sub">
                  {percent(total ? (100 * (m[metric] ?? 0)) / total : 0)} ·{" "}
                  {money(m.cost)} · {integer(m.requests)} req · TPS{" "}
                  {m.outputTps == null ? "—" : m.outputTps.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
function ChartTip({
  summary,
  index,
  metric,
  range,
  left,
  width,
}: {
  summary: Summary;
  index: number;
  metric: "tokens" | "cost";
  range: Range;
  left: number;
  width: number;
}) {
  const bucket = summary.buckets[index]!;
  const models = [...summary.models].sort(
    (a, b) => (a.slot || 9) - (b.slot || 9),
  );
  const total = bucket.models.reduce((n, m) => n + (m[metric] ?? 0), 0);
  const position =
    left > 220
      ? { right: Math.max(0, width - left + 18) }
      : { left: left + 18 };
  return (
    <div className="tip" style={position}>
      <strong>{bucketTitle(bucket.at, range)}</strong>
      {models.map((m) => (
        <div className="tip-row" key={m.id}>
          <span className="dot" style={{ background: colors(m.slot) }} />
          <span>{m.id}</span>
          <span className="v">
            {metric === "tokens"
              ? compact(bucket.models.find((x) => x.id === m.id)?.tokens ?? 0)
              : money(bucket.models.find((x) => x.id === m.id)?.cost ?? 0)}
          </span>
        </div>
      ))}
      <div className="tip-sum">
        <span>合计</span>
        <span>{metric === "tokens" ? compact(total) : money(total)}</span>
      </div>
      <div className="tip-sum">
        <span>估算费用</span>
        <span>
          {money(bucket.models.reduce((n, m) => n + (m.cost ?? 0), 0))}
        </span>
      </div>
    </div>
  );
}

function TaskTable({
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
    <section className="tasks" aria-labelledby="tasks-title">
      <div className="section-head">
        <h2 id="tasks-title">任务</h2>
        <span className="count">{integer(data.total)}</span>
        <div className="tools">
          <Segmented
            value={sort}
            label="任务排序"
            options={[
              ["recent", "最近活动"],
              ["cost", "费用"],
              ["tokens", "Tokens"],
            ]}
            onChange={setSort}
          />
          <label className="search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索任务"
              aria-label="搜索任务"
            />
          </label>
        </div>
      </div>
      <div className="task-table-scroll">
        <table className="table">
          <colgroup>
            <col />
            <col style={{ width: 96 }} />
            <col className="col-hit" style={{ width: 96 }} />
            <col style={{ width: 104 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
            <col className="col-last" style={{ width: 112 }} />
          </colgroup>
          <thead>
            <tr>
              <th>任务</th>
              <th>Tokens</th>
              <th className="col-hit">缓存命中</th>
              <th>估算费用</th>
              <th>TPS</th>
              <th>TTFT</th>
              <th className="col-last">最近活动</th>
            </tr>
          </thead>
          <tbody>
            {data.tasks.map((t) => {
              const hit = t.input ? (100 * (t.cached ?? 0)) / t.input : 0;
              return (
                <tr key={t.threadId} onClick={() => open(t.threadId)}>
                  <td>
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
                      {integer(t.turns)} 轮，{integer(t.requests)} 次请求
                      {t.running ? "，进行中" : ""}
                      <span className="task-when">
                        ，{when(t.lastActivity)}
                      </span>
                    </span>
                  </td>
                  <td>{compact(t.tokens)}</td>
                  <td className="cell-muted col-hit">{percent(hit)}</td>
                  <td>{money(t.cost)}</td>
                  <td>{t.outputTps == null ? "—" : t.outputTps.toFixed(1)}</td>
                  <td>{ttft(t.ttftMedianMs)}</td>
                  <td className="cell-muted col-last">
                    {when(t.lastActivity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>
          第 {start}–{end} 个，共 {integer(data.total)} 个
        </span>
        <div className="btns">
          <button
            className="icon-btn"
            aria-label="上一页"
            disabled={data.page <= 1}
            onClick={() => setPage(data.page - 1)}
          >
            <Chevron />
          </button>
          <button
            className="icon-btn"
            aria-label="下一页"
            disabled={end >= data.total}
            onClick={() => setPage(data.page + 1)}
          >
            <Chevron next />
          </button>
        </div>
      </div>
    </section>
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
    if (s.status === "fulfilled") setSummary(s.value);
    if (t.status === "fulfilled") setTasks(t.value);
    if (q.status === "fulfilled") setQuota(q.value);
    setError(
      results
        .flatMap((r) => (r.status === "rejected" ? [String(r.reason)] : []))
        .join("；"),
    );
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
      <header className="topbar">
        <h1>用量</h1>
        <div className="updated">
          {(busy || quota.observedAt) && (
            <span>{busy ? "正在更新" : `${time(quota.observedAt)} 更新`}</span>
          )}
          <button
            className={`icon-btn ${busy ? "is-busy" : ""}`}
            aria-label="刷新"
            disabled={busy}
            onClick={() => void load(true)}
          >
            <RefreshIcon />
          </button>
        </div>
      </header>
      <QuotaBlock quota={quota} retry={() => void load(true)} />
      <section className="local" aria-labelledby="local-title">
        <div className="section-head">
          <h2 id="local-title">本机用量</h2>
          {index.state === "ready" && (
            <div className="tools">
              <Segmented
                value={range}
                label="用量范围"
                options={ranges}
                onChange={chooseRange}
              />
            </div>
          )}
        </div>
        {index.state === "indexing" ? (
          <div className="indexing" role="status">
            <p className="indexing-title">正在建立本机用量索引</p>
            <p>
              已读取 {integer(index.total)} 个会话文件中的{" "}
              {integer(index.processed)} 个。
            </p>
            <div className="progress">
              <span
                style={{
                  width: `${index.total ? (100 * index.processed) / index.total : 0}%`,
                }}
              />
            </div>
          </div>
        ) : index.state === "unavailable" ? (
          <div className="inline-error">
            读取失败：{index.reason}
            <button className="text-btn" onClick={() => void load()}>
              重试
            </button>
          </div>
        ) : (
          <>
            <Figures summary={summary} />
            {summary.totals.requests === 0 ? (
              <div className="empty-chart">这个时间范围内没有用量记录</div>
            ) : (
              <UsageChart summary={summary} range={range} />
            )}
          </>
        )}
      </section>
      {index.state === "ready" && (
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
      )}{" "}
      {error && (
        <div className="inline-error">
          读取失败：{error}
          <button className="text-btn" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}
    </main>
  );
}
