import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { toolForms } from "../scenes/forms";
import { ToolDialog } from "../components/tool-dialog";
export default () =>
  toolForms.map((name) => (
    <Frame {...frame("tool-dialog-surface", name)}>
      <ToolDialog form={name} />
    </Frame>
  ));
