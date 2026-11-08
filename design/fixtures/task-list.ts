import { tasks, copy } from "../scenes/usage";
export const taskListExample = { query: "未找到的观测站" };
export const headings = [
  "任务",
  "Tokens",
  "估算费用",
  "缓存命中",
  "TPS",
  "TTFT",
];
export const taskRowExamples = tasks.map((task, i) =>
  i === 0 ? { ...task, title: copy.longTitle } : task,
);
