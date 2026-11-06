import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { Panel } from "../components/layout";
import { UsageChart } from "../components/usage-chart";
export default () => [
  <Frame {...frame("usage-trend", "hourly-cost")}>
    <Panel>
      <UsageChart mode="hourly" metric="费用" selected={14} />
    </Panel>
  </Frame>,
  <Frame {...frame("usage-trend", "single-model")}>
    <Panel>
      <UsageChart mode="single" />
    </Panel>
  </Frame>,
];
