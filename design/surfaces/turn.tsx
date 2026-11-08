import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { turnFrames, turnScenes, turnTitle } from "../fixtures/turn";
import { Panel } from "../components/layout";
import { Header } from "../components/header";
import { Waterfall } from "../modules/waterfall";
export default () =>
  turnFrames.map((name) => (
    <Frame {...frame("turn", name)}>
      <Panel>
        <Header title={turnTitle} back />
        <Waterfall {...turnScenes[name]} />
      </Panel>
    </Frame>
  ));
