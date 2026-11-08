import { Frame } from "sdg";
import { frame } from "../support/frame";
import { taskFrames, taskScene } from "../fixtures/task";
import { Panel, Section, Stack } from "../components/layout";
import { Header } from "../components/header";
import { MetricGrid } from "../components/metric-figure";
import { Status } from "../components/status";
import { ContextSection } from "../modules/context";
import { TurnHeader } from "../modules/turn-summary";
export default () =>
  taskFrames.map((name) => {
    const scene = taskScene(name);
    return (
      <Frame {...frame("task", name)}>
        <Panel>
          {scene.empty ? (
            <Status kind="empty" message={scene.emptyMessage} />
          ) : (
            <>
              <Header title={scene.title} back />
              {scene.indexing ? (
                <Status
                  kind="indexing"
                  total={scene.total}
                  processed={scene.processed}
                />
              ) : scene.unavailable ? (
                <Status kind="error" />
              ) : (
                <>
                  {scene.stale && <Status kind="stale" />}
                  <MetricGrid columns={2} items={scene.metrics} />
                  <ContextSection />
                  <Section title="轮次 · 最新在前">
                    <Stack>
                      {scene.turns.map((turn) => (
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
    );
  });
