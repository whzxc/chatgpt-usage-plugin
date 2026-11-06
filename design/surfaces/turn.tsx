import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { copy, variant } from "../scenes/usage";
import { turnForms } from "../scenes/forms";
import { Panel } from "../components/layout";
import { Header } from "../components/header";
import { Waterfall } from "../components/waterfall";
export default () =>
  turnForms.map((name) => (
    <Frame {...frame("turn", name)}>
      <Panel>
        <Header title={copy.task} back />
        <Waterfall
          turn={variant(name)}
          partial={name === "partial"}
          details={name === "request-detail" || name.startsWith("narrative-")}
          narrative={
            name === "request-detail"
              ? "full"
              : name === "narrative-loading"
                ? "loading"
                : name === "narrative-error"
                  ? "error"
                  : "collapsed"
          }
        />
      </Panel>
    </Frame>
  ));
