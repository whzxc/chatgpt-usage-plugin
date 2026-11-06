import { Frame } from "sdg";
import { frame } from "../scenes/format";
import {
  copy,
  summaryMetrics,
  history,
  primaryTurns,
  variant,
} from "../scenes/usage";
import { taskForms } from "../scenes/forms";
import { Panel, Section, Stack } from "../components/layout";
import { Header } from "../components/header";
import { MetricGrid } from "../components/metric-figure";
import { ContextChart } from "../components/context-chart";
import { ContextAllocation } from "../components/context-allocation";
import { TurnHeader } from "../components/turn-header";
import { Status } from "../components/status";
export default () =>
  taskForms.map((name) => (
    <Frame {...frame("task", name)}>
      <Panel>
        {name === "empty" ? (
          <Status kind="empty" message={copy.noTask} />
        ) : (
          <>
            <Header
              title={name === "long-title" ? copy.longTitle : copy.task}
              back
            />
            {name === "indexing" ? (
              <Status
                kind="indexing"
                total={history.length}
                processed={history.length / 3}
              />
            ) : name === "unavailable" ? (
              <Status kind="error" />
            ) : (
              <>
                {name === "stale" && <Status kind="stale" />}
                <MetricGrid
                  columns={2}
                  items={summaryMetrics(
                    history.filter((h) => h.task === 0),
                  ).filter((_, i) => [0, 1, 4, 5].includes(i))}
                />
                <ContextChart />
                <ContextAllocation />
                <Section title="轮次 · 最新在前">
                  <Stack>
                    {[...primaryTurns].reverse().map((turn) => (
                      <TurnHeader turn={turn} />
                    ))}
                  </Stack>
                </Section>
              </>
            )}
          </>
        )}
      </Panel>
    </Frame>
  ));
