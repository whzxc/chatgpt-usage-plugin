import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import Root from "../../ui/app/root";
import { applyMcpHostTheme } from "../../ui/theme";
import {
  Panel,
  Section,
  Header,
  Button,
  Search,
  MetricGrid,
  Tooltip,
} from "../../ui/components/ui/controls";
import { SingleChoice } from "../../ui/components/ui/SingleChoice";
import { RefreshIcon, CloseIcon } from "../../ui/components/ui/Icons";
import { Status } from "../../ui/shared/status";
import {
  QuotaBlock,
  QuotaBar,
  Figures,
  ModelLegend,
  TaskTable,
  TaskColumns,
  TaskRow,
  UsageChart,
} from "../../ui/overview/overview";
import TaskPage, { CurrentContext } from "../../ui/task/task";
import { ContextChart } from "../../ui/task/context-chart";
import { TurnHeader, TurnRow } from "../../ui/task/turn";
import {
  Waterfall,
  Minimap,
  TraceRow,
  RequestDetailsPanel,
} from "../../ui/task/waterfall";
import { ToolDialog, ToolBody } from "../../ui/task/tool-dialog";
import { traceSpans } from "../../ui/task/waterfall-model";
import {
  baseTurn,
  copy,
  variant,
  trend,
  modelNames,
  costTrend,
} from "../../design/scenes/usage";
import { longOutput } from "../../design/scenes/tool";
import { selectionExamples } from "../../design/fixtures/single-choice";
import { buttonActions } from "../../design/fixtures/button";
import { compact, money } from "../../ui/shared/format";
import {
  reviewClock,
  scrollTurn,
  summaryData,
  tasksData,
  quotaData,
  turnSummary,
  turnData,
  threadData,
  body,
} from "./data";
import { fixture } from "./bridge";
import fixtures from "./fixtures.json";
import "../../ui/shared/layout.css";
import "../../ui/task/task.css";

const noop = () => {};
applyMcpHostTheme({
  theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
});
function Stack({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="stack" style={compact ? { gap: 12 } : undefined}>
      {children}
    </div>
  );
}
function TaskListFixture({ form }: { form: string }) {
  const [query, setQuery] = useState(
      form === "search-empty" ? "未找到的观测站" : "",
    ),
    [sort, setSort] = useState<"recent" | "cost" | "tokens">("recent");
  const data = tasksData(query ? "search-empty" : "ready");
  return (
    <TaskTable
      data={data}
      query={query}
      sort={sort}
      setSort={setSort}
      setQuery={setQuery}
      setPage={noop}
      open={noop}
    />
  );
}
function SearchFixture() {
  const [values, setValues] = useState(["", "海岸", "跨季节观测记录"]);
  return (
    <Stack>
      {values.map((v, i) => (
        <Search
          key={i}
          value={v}
          disabled={i === 2}
          onChange={(value) =>
            setValues((old) => old.map((v, j) => (i === j ? value : v)))
          }
        />
      ))}
    </Stack>
  );
}
function SelectionFixture() {
  const [values, setValues] = useState(
    selectionExamples.map((item) => item.value),
  );
  return (
    <Stack>
      {selectionExamples.map((item, index) => (
        <SingleChoice
          key={item.label}
          label={item.label}
          value={values[index]}
          options={item.items.map((value) => [value, value])}
          disabled={item.disabled}
          onChange={(value) =>
            setValues((old) => old.map((v, i) => (i === index ? value : v)))
          }
        />
      ))}
    </Stack>
  );
}
function ContextFixture({
  form,
  allocation = true,
}: {
  form: string;
  allocation?: boolean;
}) {
  const thread = threadData(form).thread!,
    [expanded, setExpanded] = useState(new Set<string>());
  return (
    <>
      <ContextChart
        thread={thread}
        expanded={expanded}
        onOpen={(id) => setExpanded((s) => new Set(s).add(id))}
      />
      {allocation && <CurrentContext context={thread.context} />}
    </>
  );
}
function WaterfallFixture({
  form,
  header = false,
}: {
  form: string;
  header?: boolean;
}) {
  const scene = form === "scroll" ? scrollTurn : variant(form),
    turn = turnData(scene),
    summary = turnSummary(scene),
    [partial, setPartial] = useState(form === "partial"),
    [tool, setTool] = useState<string>();
  const timeline = partial
    ? turn.timeline.filter((r) =>
        r.kind === "request"
          ? r.sequence <= 2
          : r.kind === "reasoning" || r.kind === "reply"
            ? r.id.endsWith("r1") || r.id.endsWith("r2")
            : true,
      )
    : turn.timeline;
  return (
    <>
      {header && (
        <Header
          title={copy.task}
          updated={reviewClock}
          refresh={noop}
          back={noop}
        />
      )}
      <div
        className="stack"
        style={
          form === "scroll" ? { height: 480, overflowY: "auto" } : undefined
        }
      >
        <TurnHeader summary={summary} open toggle={noop} />
        <Waterfall
          timeline={timeline}
          turn={turn}
          summary={summary}
          threadId="fictional-task-0"
          openTool={setTool}
          busy={false}
          complete={!partial}
          reveal={async () => {
            setPartial(false);
            return true;
          }}
        />
        {partial && (
          <Button label="显示其余 2 次请求" onClick={() => setPartial(false)} />
        )}
      </div>
      {tool && (
        <ToolDialog
          toolId={tool}
          threadId="fictional-task-0"
          close={() => setTool(undefined)}
        />
      )}
    </>
  );
}
function RowFixture({ unknown = false }: { unknown?: boolean }) {
  const scene = variant(unknown ? "unknown" : "completed"),
    turn = turnData(scene),
    spans = traceSpans(turn.timeline, false),
    [active, setActive] = useState("tool:t2");
  const rows = unknown
    ? [{ span: spans[0], position: 1, size: 1 }]
    : [
        { span: spans[0], position: 1, size: 2 },
        { span: spans[1], position: 2, size: 2 },
        ...spans[1].children.map((span, i) => ({
          span,
          parent: spans[1],
          position: i + 1,
          size: 2,
        })),
      ];
  return (
    <div
      className="waterfall"
      style={{ "--wf-unit": 100 / 45000 } as CSSProperties}
    >
      <Stack compact>
        {!unknown && (
          <div className="wf-heading">
            <span>调用 · 模型耗时为推算</span>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {[0, 15, 30, 45].map((n) => (
                <span key={n}>{n}s</span>
              ))}
            </div>
          </div>
        )}
        {rows.map((row) => (
          <TraceRow
            key={row.span.id}
            row={row}
            active={active === row.span.id}
            expanded={active === row.span.id}
            closed={row.span.id !== "request:r2"}
            slowest="tool:t2"
            origin={summaryOrigin(scene.now)}
            detailsId=""
            register={noop}
            activate={(s) => setActive(s.id)}
            toggle={noop}
          />
        ))}
      </Stack>
    </div>
  );
}
const summaryOrigin = (now: number) => reviewClock - now;
function Content() {
  if (!fixtures.includes(fixture))
    throw Error(`Unknown design fixture: ${fixture}`);
  if (fixture.startsWith("cup-overview-") || fixture.startsWith("cup-entry-"))
    return <Root />;
  if (fixture.startsWith("cup-tool-dialog-")) {
    return <ToolDialog threadId="fictional-task-0" toolId="t2" close={noop} />;
  }
  let content: ReactNode;
  if (
    fixture.startsWith("cup-task-") &&
    !fixture.startsWith("cup-task-list-") &&
    !fixture.startsWith("cup-task-row-")
  )
    return (
      <TaskPage
        initial={threadData(fixture.slice(9))}
        onBack={fixture === "cup-task-empty" ? undefined : noop}
      />
    );
  if (fixture.startsWith("cup-context-allocation-"))
    content = (
      <CurrentContext
        context={
          threadData(
            fixture.endsWith("unknown-capacity") ? "unknown-capacity" : "ready",
          ).thread!.context
        }
      />
    );
  else if (fixture.startsWith("cup-context-chart-"))
    content = <ContextFixture form="selected-compaction" allocation={false} />;
  else if (fixture.startsWith("cup-context-"))
    content = <ContextFixture form={fixture.slice(12)} />;
  else if (
    fixture.startsWith("cup-usage-chart-") ||
    fixture.startsWith("cup-usage-trend-")
  ) {
    const hourly = fixture.endsWith("hourly-cost"),
      single = fixture.endsWith("single-model");
    content = (
      <UsageChart
        summary={summaryData("ready", hourly, single)}
        range={hourly ? "today" : "7d"}
      />
    );
  } else if (fixture.startsWith("cup-task-list-"))
    content = (
      <TaskListFixture
        form={fixture.endsWith("search-empty") ? "search-empty" : "ready"}
      />
    );
  else if (fixture === "cup-task-row-selection-long")
    content = (
      <div>
        <TaskColumns />
        {tasksData("selection-long").tasks.map((task) => (
          <TaskRow key={task.threadId} task={task} open={noop} />
        ))}
      </div>
    );
  else if (fixture === "cup-button-actions")
    content = (
      <div
        data-design-button-actions
        style={{
          display: "flex",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 16,
          padding: 4,
        }}
      >
        {buttonActions.map(({ label, busy, disabled, icon }) => (
          <Button key={label} label={label} busy={busy} disabled={disabled}>
            {icon === "refresh-cw" ? (
              <RefreshIcon />
            ) : icon === "x" ? (
              <CloseIcon />
            ) : undefined}
          </Button>
        ))}
      </div>
    );
  else if (fixture === "cup-layout-shell")
    content = <Section title="本机用量" />;
  else if (fixture.startsWith("cup-header-"))
    content = (
      <Header
        title={fixture.endsWith("long-title") ? copy.longTitle : "用量"}
        updated={reviewClock}
        busy={fixture.endsWith("refreshing")}
        back={fixture.endsWith("long-title") ? noop : undefined}
        refresh={noop}
      />
    );
  else if (fixture === "cup-legend-models")
    content = <ModelLegend summary={summaryData()} />;
  else if (fixture === "cup-metric-figure-overview")
    content = <Figures summary={summaryData()} />;
  else if (fixture === "cup-metric-figure-unknown") {
    const t = turnData(variant("unknown"));
    content = (
      <MetricGrid
        small
        items={[
          { label: "用时", value: "45s" },
          { label: "估算费用", value: money(t.metrics.cost) },
          { label: "Tokens", value: compact(t.metrics.tokens) },
          { label: "模型调用", value: String(t.requestTotal) },
          { label: "工具调用", value: String(t.calls.tools) },
          { label: "失败", value: String(t.calls.failed) },
        ]}
      />
    );
  } else if (fixture.startsWith("cup-minimap-")) {
    const selected = fixture.endsWith("selected-range");
    content = (
      <div
        className="waterfall"
        style={
          {
            "--wf-map-start": selected ? `${(7000 / 45000) * 100}%` : "0%",
            "--wf-map-width": selected ? `${(17000 / 45000) * 100}%` : "100%",
          } as CSSProperties
        }
      >
        <Minimap
          overview={turnData().overview!}
          busy={!selected}
          navigate={noop}
          slowestDuration={12000}
          range={selected ? [7000, 24000] : undefined}
        />
      </div>
    );
  } else if (fixture === "cup-quota-bar-windows")
    content = (
      <Stack>
        {quotaData("windows").windows.map((window) => (
          <QuotaBar window={window} key={window.id} />
        ))}
      </Stack>
    );
  else if (fixture === "cup-quota-credits-and-exhaustion")
    content = (
      <QuotaBlock quota={quotaData("credits-and-exhaustion")} retry={noop} />
    );
  else if (fixture === "cup-request-details-narrative")
    content = (
      <RequestDetailsPanel
        span={traceSpans(turnData().timeline, false)[1]}
        threadId="fictional-task-0"
        turnId={baseTurn.id}
        close={noop}
      />
    );
  else if (fixture === "cup-search-field") content = <SearchFixture />;
  else if (fixture === "cup-single-choice-selection")
    content = <SelectionFixture />;
  else if (fixture === "cup-status-feedback")
    content = (
      <Stack>
        {(["loading", "indexing", "error", "stale", "empty"] as const).map(
          (kind) => (
            <Status
              key={kind}
              kind={kind}
              processed={summaryData().index.total / 3}
              total={summaryData().index.total}
              retry={kind === "error" || kind === "stale" ? noop : undefined}
            />
          ),
        )}
      </Stack>
    );
  else if (fixture === "cup-tool-body-truncated")
    content = (
      <ToolBody title="输出" body={body(longOutput)} onCopyError={noop} />
    );
  else if (fixture === "cup-tooltip-bucket")
    content = (
      <Tooltip
        title={trend[4].label}
        rows={modelNames.map((label, j) => ({
          label,
          value: `${compact(trend[4].values[j])} · ${money(costTrend[4].values[j])}`,
        }))}
      />
    );
  else if (fixture === "cup-turn-header-states")
    content = (
      <Stack>
        {["long", "scheduled", "failed", "running", "interrupted"].map(
          (kind, i) => (
            <TurnHeader
              key={kind}
              summary={turnSummary({ ...variant(kind), sequence: i + 1 })}
              toggle={noop}
            />
          ),
        )}
      </Stack>
    );
  else if (fixture.startsWith("cup-waterfall-row-"))
    content = <RowFixture unknown={fixture.endsWith("unknown")} />;
  else if (fixture === "cup-waterfall-completed")
    content = <WaterfallFixture form="completed" />;
  else if (fixture === "cup-waterfall-scroll")
    content = <WaterfallFixture form="scroll" />;
  else if (fixture.startsWith("cup-turn-loading-"))
    content = (
      <TurnRow
        threadId="fictional-task-0"
        summary={turnSummary()}
        open
        toggle={noop}
      />
    );
  else if (fixture.startsWith("cup-turn-"))
    content = <WaterfallFixture form={fixture.slice(9)} header />;
  else throw Error(`No renderer for fixture: ${fixture}`);
  if (fixture === "cup-single-choice-selection")
    return (
      <div
        data-design-specimen
        className="panel"
        style={{ padding: 4, width: "max-content" }}
      >
        {content}
      </div>
    );
  return <Panel>{content}</Panel>;
}
function Review() {
  useEffect(() => {
    document.documentElement.dataset.fixtureReady = fixture;
  }, []);
  return <Content />;
}
window.addEventListener("error", (event) => {
  document.documentElement.dataset.fixtureError = event.message;
});
createRoot(document.getElementById("root")!).render(<Review />);
