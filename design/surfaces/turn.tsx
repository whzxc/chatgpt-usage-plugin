import { waterfallProps } from "../fixtures/waterfall";
import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { copy, variant } from "../scenes/usage";
import { turnForms } from "../scenes/forms";
import { Panel } from "../components/layout";
import { Header } from "../components/header";
import { Waterfall } from "../modules/waterfall";
export default () =>
  turnForms.map((name) => (
    <Frame
      {...frame("turn", name)}
      {...(name === "running"
        ? { capture: { selector: ".panel", viewport: "720x2400" } }
        : {})}
    >
      <Panel>
        <Header title={copy.task} back />
        <Waterfall {...waterfallProps(name)} />
      </Panel>
    </Frame>
  ));
