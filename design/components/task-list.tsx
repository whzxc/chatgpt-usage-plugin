import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { tasks, copy } from "../scenes/usage";
import { Panel, Section } from "./layout";
import { SingleChoice } from "./single-choice";
import { Search } from "./search";
import { Button } from "./button";
import { Status } from "./status";
import { TaskRow, TaskColumns } from "./task-row";
export function TaskList({
  query = "",
  empty = false,
  selected = false,
  data = tasks,
}: {
  data?: typeof tasks;
  query?: string;
  empty?: boolean;
  selected?: boolean;
}) {
  const rows = empty ? [] : data;
  return (
    <Section title={`任务 ${rows.length}`}>
      <div class="flex items-center justify-between gap-4">
        <SingleChoice label="任务排序" items={copy.sorts} value="最近活动" />
        <Search value={query} />
      </div>
      {empty ? (
        <Status kind="empty" message={copy.noResults} />
      ) : (
        <div>
          <TaskColumns />
          {rows.map((task, i) => (
            <TaskRow task={task} selected={selected && i === 0} />
          ))}
        </div>
      )}
      <div class="flex justify-between items-center text-meta text-muted">
        <span>
          第 {rows.length ? 1 : 0}–{rows.length} 个，共 {rows.length} 个
        </span>
        <div class="flex gap-2">
          <Button label="上一页" icon="chevron-left" disabled />
          <Button label="下一页" icon="chevron-right" disabled />
        </div>
      </div>
    </Section>
  );
}
export default () => [
  <Frame {...frame("task-list", "search-empty")}>
    <Panel>
      <TaskList query="未找到的观测站" empty />
    </Panel>
  </Frame>,
];
