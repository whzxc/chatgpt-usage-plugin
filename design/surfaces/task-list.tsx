import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { Panel } from "../components/layout";
import { TaskList } from "../components/task-list";
export default () => [
  <Frame {...frame("task-list-surface", "selected")}>
    <Panel>
      <TaskList selected />
    </Panel>
  </Frame>,
  <Frame {...frame("task-list-surface", "search-empty")}>
    <Panel>
      <TaskList query="未找到的观测站" empty />
    </Panel>
  </Frame>,
];
