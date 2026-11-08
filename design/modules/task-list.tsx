import { Frame } from "sdg";
import { frame } from "../scenes/format";
import { tasks, copy, type TaskRowData } from "../scenes/usage";
import { Section } from "../components/layout";
import { SingleChoice } from "../components/single-choice";
import { Search } from "../components/search";
import { Button } from "../components/button";
import { Status } from "../components/status";
import {
  taskListExample,
  taskRowExamples,
  headings,
} from "../fixtures/task-list";
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

const columns =
  "px-2 grid grid-cols-[minmax(0,1fr)_60px_64px_60px_48px_48px] gap-2";
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
      class={[
        `${columns} items-center py-4 border-b border-border`,
        selected
          ? "bg-selected outline-2 outline-focus outline-offset-2 rounded-control"
          : "",
      ].join(" ")}
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
  <Frame
    {...frame("task-list", "list-search-empty")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <TaskList query={taskListExample.query} empty />
    </div>
  </Frame>,
  <Frame
    {...frame("task-list", "row-selection-long")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <div>
        <TaskColumns />
        {taskRowExamples.map((task, i) => (
          <TaskRow task={task} selected={i === 0} />
        ))}
      </div>
    </div>
  </Frame>,
  <Frame
    {...frame("task-list", "list-selected")}
    width={680}
    capture={{ selector: "[data-design-module]", viewport: "720x2400" }}
  >
    <div
      data-design-module
      class="w-full p-1 font-ui text-body leading-normal flex flex-col gap-6"
    >
      <TaskList selected />
    </div>
  </Frame>,
];
