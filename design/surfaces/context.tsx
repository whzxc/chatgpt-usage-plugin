import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { contextForms } from "../scenes/forms";
import { Panel } from "../components/layout";
import { ContextChart } from "../components/context-chart";
import { ContextAllocation } from "../components/context-allocation";
export default () =>
  contextForms.map((name) => (
    <Frame {...frame("context", name)}>
      <Panel>
        <ContextChart
          unknownLimit={name === "unknown-capacity"}
          selected={name === "selected-compaction"}
          gaps={name === "missing-measurements"}
        />
        <ContextAllocation unknownLimit={name === "unknown-capacity"} />
      </Panel>
    </Frame>
  ));
