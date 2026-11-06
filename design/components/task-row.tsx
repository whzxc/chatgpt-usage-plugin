import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { tasks, copy, type TaskRowData } from "../scenes/usage";
import { Panel } from "./layout";
const columns =
  "px-2 grid grid-cols-[minmax(0,1fr)_60px_64px_60px_48px_48px] gap-2";
const headings = ["任务", "Tokens", "估算费用", "缓存命中", "TPS", "TTFT"];
export function TaskColumns() {
  return (
    <div class={`${columns} text-meta text-muted border-b border-border pb-2`}>
      {headings.map((t) => (
        <span>{t}</span>
      ))}
    </div>
  );
}
export function TaskRow({
  task,
  selected = false,
}: {
  task: TaskRowData;
  selected?: boolean;
}) {
  return (
    <div
      class={`${columns} items-center py-4 border-b border-border ${selected ? "bg-selected outline-2 outline-focus outline-offset-2 rounded-control" : ""}`}
    >
      <div class="min-w-0">
        <button
          class="text-body font-medium block w-full whitespace-normal break-words text-left"
          title={task.title}
        >
          <span>{task.title}</span>
        </button>
        <p class="text-meta text-muted mt-1">{task.meta}</p>
      </div>
      {[task.tokens, task.cost, task.hit, task.tps, task.ttft].map((v) => (
        <span class="text-meta">{v}</span>
      ))}
    </div>
  );
}
export default () => [
  <Frame {...frame("task-row", "selection-long")}>
    <Panel>
      <div>
        <TaskColumns />
        {tasks.map((task, i) => (
          <TaskRow
            task={i === 0 ? { ...task, title: copy.longTitle } : task}
            selected={i === 0}
          />
        ))}
      </div>
    </Panel>
  </Frame>,
];
