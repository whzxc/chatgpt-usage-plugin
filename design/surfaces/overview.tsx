import { Frame } from "sdg";
import { frame } from "../scenes/format";
import {
  copy,
  summaryMetrics,
  history,
  variant,
  taskData,
} from "../scenes/usage";
import { overviewForms } from "../scenes/forms";
import { Panel, Section } from "../components/layout";
import { Header } from "../components/header";
import { QuotaSection } from "../modules/quota";
import { Status } from "../components/status";
import { SingleChoice } from "../components/single-choice";
import { MetricGrid } from "../components/metric-figure";
import { UsageChart } from "../modules/usage-trend";
import { TaskList } from "../components/task-list";
export default () =>
  overviewForms.map((name) => {
    const unavailable = name === "unavailable",
      indexing = name === "indexing",
      unknown = name === "unpriced",
      empty = name === "empty",
      records = empty
        ? []
        : unknown
          ? history.map((h) => ({ ...h, turn: variant("unknown") }))
          : history;
    return (
      <Frame {...frame("overview", name)}>
        <Panel>
          <Header title="用量" busy={name === "refreshing"} />
          {name === "quota-unavailable" ? (
            <Section title="账户额度">
              <Status kind="error" message="无法读取账户额度：账户不可用" />
            </Section>
          ) : indexing ? (
            <Section title="账户额度">
              <Status message="正在读取账户额度" />
            </Section>
          ) : (
            <QuotaSection />
          )}
          {name === "stale" && <Status kind="stale" />}
          <Section
            title="本机用量"
            actions={
              !unavailable &&
              !indexing && (
                <SingleChoice
                  label="用量范围"
                  items={copy.ranges}
                  value="7 天"
                  disabled={name === "refreshing"}
                />
              )
            }
          >
            {indexing ? (
              <Status
                kind="indexing"
                processed={history.length / 3}
                total={history.length}
              />
            ) : unavailable ? (
              <Status kind="error" />
            ) : (
              <MetricGrid items={summaryMetrics(records)} />
            )}
          </Section>
          {!indexing && !unavailable && (
            <>
              {empty ? (
                <Status kind="empty" />
              ) : unknown ? (
                <Status
                  kind="warning"
                  message="部分模型未定价，用量字段缺失。"
                />
              ) : (
                <UsageChart />
              )}
              {!empty && <TaskList data={taskData(records)} />}
            </>
          )}
        </Panel>
      </Frame>
    );
  });
