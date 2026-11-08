import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { baseTurn } from "../scenes/usage";
import { Panel } from "../components/layout";
import { TurnSummary } from "../modules/turn-summary";
import { Status } from "../components/status";
export default () => [
  <Frame {...frame("turn-loading", "pending")}>
    <Panel>
      <TurnSummary turn={baseTurn} loading />
    </Panel>
  </Frame>,
  <Frame {...frame("turn-loading", "failure")}>
    <Panel>
      <TurnSummary turn={baseTurn} error="无法读取轮次" />
    </Panel>
  </Frame>,
];
