import { Frame } from "sdg";
import { frame } from "../support/frame";
import { overviewFrames, overviewScene } from "../fixtures/overview";
import { Panel } from "../components/layout";
import { Header } from "../components/header";
import { QuotaSection } from "../modules/quota";
import { Status } from "../components/status";
import { UsageSummary } from "../modules/usage-summary";
import { UsageChart } from "../modules/usage-trend";
import { TaskList } from "../modules/task-list";
export default () =>
  overviewFrames.map((name) => {
    const scene = overviewScene(name);
    return (
      <Frame {...frame("overview", name)}>
        <Panel>
          <Header title="用量" />
          <QuotaSection loading={scene.indexing} />
          {scene.stale && <Status kind="stale" />}
          <UsageSummary
            items={scene.metrics}
            loading={scene.indexing}
            error={scene.unavailable}
            processed={scene.processed}
            total={scene.total}
          />
          {!scene.indexing && !scene.unavailable && (
            <>
              {scene.empty ? (
                <Status kind="empty" />
              ) : scene.unknown ? (
                <Status
                  kind="warning"
                  message="部分模型未定价，用量字段缺失。"
                />
              ) : (
                <UsageChart />
              )}
              {!scene.empty && <TaskList data={scene.tasks} />}
            </>
          )}
        </Panel>
      </Frame>
    );
  });
