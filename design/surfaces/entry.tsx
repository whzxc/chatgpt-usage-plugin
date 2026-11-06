import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { entryForms } from "../scenes/forms";
import { Panel } from "../components/layout";
import { Status } from "../components/status";
export default () =>
  entryForms.map((name) => (
    <Frame {...frame("entry", name)}>
      <Panel>
        <Status kind={name === "loading" ? "loading" : "error"} />
      </Panel>
    </Frame>
  ));
