import { Frame } from "adg";
import { frame } from "../support/frame";
import { turnFrames, turnScenes, turnTitle } from "../fixtures/turn";
import { Panel, Stack } from "../components/layout";
import { Header } from "../components/header";
import { TurnHeader } from "../modules/turn-summary";
import { Waterfall } from "../modules/waterfall";
export default () =>
  turnFrames.map((name) => (
    <Frame {...frame("turn", name)}>
      <Panel>
        <Header title={turnTitle} back />
        <Stack>
          <TurnHeader turn={turnScenes[name].turn} open />
          <Waterfall {...turnScenes[name]} />
        </Stack>
      </Panel>
    </Frame>
  ));
