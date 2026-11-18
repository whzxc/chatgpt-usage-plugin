import { SingleChoice } from "../components/ui/SingleChoice";
import { Button, Section } from "../components/ui/controls";
import { Chevron, Icon } from "../components/ui/Icons";
import { Status } from "../shared/status";
import {
  calendarTime,
  compact,
  duration,
  integer,
  money,
  percent,
} from "../shared/format";
import type { Tasks } from "../shared/types";

const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
);

export function Search({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="search">
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索任务"
        aria-label="搜索任务"
        disabled={disabled}
      />
    </label>
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
