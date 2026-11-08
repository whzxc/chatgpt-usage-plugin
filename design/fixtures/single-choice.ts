import { copy } from "./usage";
export const selectionExamples = [
  { label: "用量范围", items: copy.ranges, value: "7 天", focus: true },
  { label: "图表指标", items: copy.metrics, value: "Tokens" },
  { label: "任务排序", items: copy.sorts, value: "最近活动", disabled: true },
];
