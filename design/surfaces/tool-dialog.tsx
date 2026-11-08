import { toolDialogProps } from "../fixtures/tool-dialog";
import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { toolForms } from "../scenes/forms";
import { ToolDialog } from "../modules/tool-dialog";
export default () =>
  toolForms.map((name) => (
    <Frame {...frame("tool-dialog-surface", name)}>
      <ToolDialog {...toolDialogProps(name)} />
    </Frame>
  ));
