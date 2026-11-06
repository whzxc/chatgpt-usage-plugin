import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { baseTurn } from "../scenes/usage";
import { Panel } from "../components/layout";
import { TurnHeader } from "../components/turn-header";
import { Status } from "../components/status";
export default () => [
  <Frame {...frame("turn-loading", "pending")}>
    <Panel>
      <TurnHeader turn={baseTurn} open />
      <Status message="正在读取轮次" />
    </Panel>
  </Frame>,
  <Frame {...frame("turn-loading", "failure")}>
    <Panel>
      <TurnHeader turn={baseTurn} open />
      <Status kind="error" message="无法读取轮次" />
    </Panel>
  </Frame>,
];
