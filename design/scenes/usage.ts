import { compact, money, percent, duration, number } from "./format";
export type Model = "gpt-6" | "gpt-6-mini" | "unpriced-model";
export type Call = {
  id: string;
  kind: "model" | "tool";
  label: string;
  start: number | null;
  end: number | null;
  at: number;
  parent?: string;
  input: number | null;
  cached: number | null;
  output: number | null;
  reasoning: number | null;
  model: Model;
  status: "done" | "running" | "failed";
  command?: string;
  result?: string;
  inferred?: boolean;
};
export type Turn = {
  id: string;
  sequence: number;
  prompt: string;
  start: number;
  end: number | null;
  now: number;
  ttft: number | null;
  state: "done" | "running" | "failed" | "interrupted";
  calls: Call[];
  limit: number | null;
  scheduled?: boolean;
  compacted?: boolean;
};
export const copy = {
  task: "整理海岸观测数据",
  prompt: "汇总观测记录，并生成每周趋势图。",
  updated: "14:32 更新",
  longTitle:
    "整理近海观测站跨季节温度、潮位与风速记录，并核对缺失采样和异常测量的来源",
  longPrompt:
    "请汇总所有观测站的每周数据，保留缺失值的标记，检查不同采样频率带来的统计偏差，并将每一项修正与原始记录对应起来。",
  reply:
    "已汇总每周观测记录。缺失采样保留为空值；趋势图采用各站点的有效观测均值。",
  reasoning: "核对采样间隔；将缺失值与异常值分开，再按本地日历周汇总。",
  ranges: ["今天", "7 天", "30 天"],
  metrics: ["Tokens", "费用"],
  sorts: ["最近活动", "费用", "Tokens"],
  requestWarning:
    "模型起点由轮次或前次调用完成时间推算，可能包含等待；无每请求 TTFT。",
  unknownWarning: "调用起点缺失，保留记录顺序。",
  loading: "正在读取本机用量",
  indexing: "正在建立本机用量索引",
  failure: "无法读取本机用量",
  stale: "更新失败，显示上次读取的数据。",
  noUsage: "这个时间范围内没有用量记录",
  noTask: "这个任务还没有用量记录",
  noResults: "没有匹配的任务",
  noPrompt: "未提供文字请求",
};
// Fictional USD prices per million tokens, never fetched from a service.
export const prices: Record<
  Model,
  { input: number; cached: number; output: number } | null
> = {
  "gpt-6": { input: 5, cached: 0.5, output: 30 },
  "gpt-6-mini": { input: 1, cached: 0.1, output: 6 },
  "unpriced-model": null,
};
const modelCall = (
  id: string,
  label: string,
  start: number,
  end: number,
  input: number,
  output: number,
): Call => ({
  id,
  kind: "model",
  label,
  start,
  end,
  at: end,
  input,
  cached: Math.round(input * 0.75),
  output,
  reasoning: Math.round(output * 0.4),
  model: "gpt-6",
  status: "done",
  inferred: true,
});
const toolCall = (
  id: string,
  parent: string,
  command: string,
  start: number,
  end: number,
  result: string,
): Call => ({
  id,
  parent,
  kind: "tool",
  label: command,
  start,
  end,
  at: start,
  input: null,
  cached: null,
  output: null,
  reasoning: null,
  model: "gpt-6",
  status: "done",
  command,
  result,
});
export const baseTurn: Turn = {
  id: "turn-4",
  sequence: 4,
  prompt: copy.prompt,
  start: 0,
  end: 45000,
  now: 45000,
  ttft: 1200,
  state: "done",
  limit: 128000,
  calls: [
    modelCall("r1", "读取观测记录", 0, 5000, 8000, 300),
    toolCall(
      "t1",
      "r1",
      "read_file observations.csv",
      5000,
      7000,
      "station,temperature\nNorth,18.2\nSouth,19.1\n",
    ),
    modelCall("r2", "计算每周趋势", 7000, 12000, 8500, 400),
    toolCall(
      "t2",
      "r2",
      "python summarize.py",
      12000,
      24000,
      "weekly_mean: 18.65\nmissing_samples: 0\n",
    ),
    toolCall(
      "t3",
      "r2",
      "python validate.py",
      13000,
      16000,
      "All observed samples are valid.\n",
    ),
    modelCall("r3", "生成图表", 24000, 30000, 8700, 500),
    toolCall(
      "t4",
      "r3",
      "write_file weekly-chart.svg",
      30000,
      32000,
      "Created weekly-chart.svg\n",
    ),
    modelCall("r4", "汇总观测结果", 35000, 45000, 12000, 600),
  ],
};
export function variant(kind: string): Turn {
  const turn: Turn = {
    ...baseTurn,
    calls: baseTurn.calls.map((c) => ({ ...c })),
  };
  if (kind === "failed") {
    turn.state = "failed";
    turn.calls = turn.calls.slice(0, 5);
    turn.end = 24000;
    turn.now = 24000;
    turn.calls.find((c) => c.id === "t2")!.status = "failed";
    turn.calls.find((c) => c.id === "t2")!.result =
      "ValueError: missing temperature column\n";
  }
  if (kind === "running") {
    turn.state = "running";
    turn.end = null;
    turn.now = 20000;
    turn.calls = turn.calls.slice(0, 5);
    const t = turn.calls.find((c) => c.id === "t2")!;
    t.end = null;
    t.status = "running";
    t.result = undefined;
  }
  if (kind === "unknown") {
    turn.ttft = null;
    turn.limit = null;
    turn.calls = turn.calls.map((c) => ({
      ...c,
      start: null,
      inferred: false,
      input: c.kind === "model" ? null : c.input,
      cached: null,
      output: null,
      reasoning: null,
      model: "unpriced-model",
    }));
  }
  if (kind === "long") turn.prompt = copy.longPrompt;
  if (kind === "scheduled") {
    turn.prompt = "";
    turn.scheduled = true;
  }
  if (kind === "interrupted") turn.state = "interrupted";
  return turn;
}
export const models = (calls: Call[]) =>
  calls.filter((c) => c.kind === "model");
export const tools = (calls: Call[]) => calls.filter((c) => c.kind === "tool");
export const elapsed = (call: Call, now = baseTurn.now) =>
  call.start === null ? null : (call.end ?? now) - call.start;
export function cost(call: Call): number | null {
  if (call.kind === "tool") return 0;
  const p = prices[call.model];
  return !p ||
    call.input === null ||
    call.cached === null ||
    call.output === null
    ? null
    : ((call.input - call.cached) * p.input +
        call.cached * p.cached +
        call.output * p.output) /
        1e6;
}
export const sumKnown = (items: (number | null)[]) =>
  items.some((x) => x === null)
    ? null
    : items.reduce<number>((s, x) => s + x!, 0);
export function totals(calls: Call[]) {
  const rs = models(calls),
    input = sumKnown(rs.map((c) => c.input)),
    output = sumKnown(rs.map((c) => c.output)),
    cached = sumKnown(rs.map((c) => c.cached));
  return {
    requests: rs.length,
    tools: tools(calls).length,
    failed: calls.filter((c) => c.status === "failed").length,
    input,
    output,
    cached,
    tokens: input === null || output === null ? null : input + output,
    cost: sumKnown(rs.map(cost)),
    hit: input && cached !== null ? (cached / input) * 100 : null,
  };
}
export function turnMetrics(turn: Turn) {
  const t = totals(turn.calls),
    ms = turn.end === null ? null : turn.end - turn.start;
  return [
    { label: "用时", value: duration(ms) },
    { label: "估算费用", value: money(t.cost) },
    { label: "Tokens", value: compact(t.tokens) },
    { label: "模型调用", value: number(t.requests) },
    { label: "工具调用", value: number(t.tools) },
    { label: "失败", value: number(t.failed) },
  ];
}
export function turnMeta(turn: Turn) {
  const t = totals(turn.calls),
    rs = models(turn.calls),
    ms = turn.end === null ? null : turn.end - turn.start;
  return [
    rs[0]?.model ?? "—",
    `TTFT ${duration(turn.ttft)}`,
    `${(turn.state === "done" || turn.state === "interrupted") && ms && t.output !== null ? (t.output / (ms / 1000)).toFixed(1) : "—"} tok/s`,
    `缓存 ${percent(t.hit)}`,
    `输出 ${compact(t.output)}`,
    `上下文 ${compact(rs[0]?.input ?? null)} → ${compact(rs.at(-1)?.input ?? null)} / ${compact(turn.limit)}`,
  ];
}
export const taskTitles = [copy.task, "修复天气卡片排版", "校对每周观测简报"];
export const days = [
  "10/31",
  "11/01",
  "11/02",
  "11/03",
  "11/04",
  "11/05",
  "11/06",
];
const primaryDays = [0, 2, 4, 6];
const primaryScales = [1, 4, 8, 1];
export const history = days.flatMap((day, d) =>
  taskTitles.flatMap((title, t) => {
    if (t === 0 && !primaryDays.includes(d)) return [];
    const primaryIndex = primaryDays.indexOf(d),
      scale =
        t === 0 ? primaryScales[primaryIndex] : (d + 1) * (t === 2 ? 0.5 : 1);
    const turn: Turn = {
      ...baseTurn,
      id: `day-${d}-task-${t}`,
      sequence: t === 0 ? primaryIndex + 1 : d + 1,
      ttft: t === 0 && d === 6 ? baseTurn.ttft : 800 + (d + t) * 200,
      scheduled: t === 0 && primaryIndex === 1,
      prompt: t === 0 && primaryIndex === 1 ? "" : copy.prompt,
      compacted: t === 0 && primaryIndex === 3,
      state: t === 0 && primaryIndex === 2 ? "interrupted" : "done",
      end: t === 2 ? 24000 : baseTurn.end,
      now: t === 2 ? 24000 : baseTurn.now,
      calls: (t === 2 ? baseTurn.calls.slice(0, 5) : baseTurn.calls).map(
        (c) => ({
          ...c,
          model: t === 2 ? "gpt-6-mini" : "gpt-6",
          input: c.input === null ? null : c.input * scale,
          cached:
            c.input === null
              ? null
              : Math.round(c.input * scale * (t === 2 ? 0.45 : 0.75)),
          output: c.output === null ? null : c.output * scale,
          reasoning: c.reasoning === null ? null : c.reasoning * scale,
        }),
      ),
    };
    return [{ day, hour: 14 - t, title, task: t, turn }];
  }),
);
export const primaryHistory = history.filter((h) => h.task === 0);
export const primaryTurns = primaryHistory.map((h) => h.turn);
export const historyCalls = history.flatMap((h) => h.turn.calls);
const quantile = (ns: number[], p: number) =>
  [...ns].sort((a, b) => a - b)[Math.max(0, Math.ceil(p * ns.length) - 1)] ??
  null;
export function summaryMetrics(records = history) {
  const t = totals(records.flatMap((h) => h.turn.calls)),
    times = records
      .map((h) => h.turn.ttft)
      .filter((x): x is number => x !== null),
    seconds = records.reduce(
      (s, h) => s + ((h.turn.end ?? h.turn.start) - h.turn.start) / 1000,
      0,
    ),
    sorted = [...times].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2),
    median = sorted.length
      ? sorted.length % 2
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2
      : null;
  return [
    {
      label: "估算费用",
      value: money(t.cost),
      detail: t.cost === null ? "部分模型未定价" : "按 API 价格估算",
    },
    {
      label: "Tokens",
      value: compact(t.tokens),
      detail: `输入 ${compact(t.input)} · 输出 ${compact(t.output)}`,
    },
    {
      label: "缓存命中",
      value: percent(t.hit),
      detail: `${compact(t.cached)} 来自缓存`,
    },
    {
      label: "请求",
      value: number(t.requests),
      detail: `${new Set(records.map((h) => h.task)).size} 个任务`,
    },
    {
      label: "TPS",
      value:
        seconds && t.output !== null ? (t.output / seconds).toFixed(1) : "—",
      detail: "tok/s · 按整轮用时",
    },
    {
      label: "TTFT",
      value: duration(median),
      detail: `P90 ${duration(quantile(times, 0.9))} · P99 ${duration(quantile(times, 0.99))}`,
    },
  ];
}
export const modelNames = ["gpt-6", "gpt-6-mini"] as const;
export const modelTones = ["bg-model-primary", "bg-model-secondary"];
export const modelLegend = modelNames.map((name, i) => {
  const records = history.filter(
      (h) => models(h.turn.calls)[0]?.model === name,
    ),
    t = totals(records.flatMap((h) => h.turn.calls)),
    all = totals(historyCalls),
    seconds = records.reduce(
      (s, h) => s + ((h.turn.end ?? 0) - h.turn.start) / 1000,
      0,
    );
  return {
    label: name,
    value: compact(t.tokens),
    detail: `${percent(((t.tokens ?? 0) / (all.tokens ?? 1)) * 100)} · ${money(t.cost)} · ${t.requests} req · ${((t.output ?? 0) / seconds).toFixed(1)} tok/s`,
    tone: modelTones[i],
  };
});
export const trend = days.map((day) => ({
  label: day,
  values: modelNames.map(
    (model) =>
      totals(
        history
          .filter((h) => h.day === day)
          .flatMap((h) => h.turn.calls)
          .filter((c) => c.model === model),
      ).tokens ?? 0,
  ),
}));
export const costTrend = days.map((day) => ({
  label: day,
  values: modelNames.map(
    (model) =>
      totals(
        history
          .filter((h) => h.day === day)
          .flatMap((h) => h.turn.calls)
          .filter((c) => c.model === model),
      ).cost ?? 0,
  ),
}));
export const taskData = (entries = history) =>
  taskTitles.flatMap((title, i) => {
    const records = entries.filter((h) => h.task === i);
    if (!records.length) return [];
    const t = totals(records.flatMap((h) => h.turn.calls)),
      m = summaryMetrics(records);
    return [
      {
        title,
        meta: `${records.length} 轮 · ${t.requests} 次请求 · ${records.at(-1)!.day} ${records.at(-1)!.hour}:00`,
        tokens: compact(t.tokens),
        cost: money(t.cost),
        hit: percent(t.hit),
        tps: m[4].value,
        ttft: m[5].value,
      },
    ];
  });
export const tasks = taskData();
export type TaskRowData = (typeof tasks)[number];
export const density = (turn: Turn, bins = 12) =>
  Array.from({ length: bins }, (_, i) => {
    const end = turn.end ?? turn.now;
    const included = turn.calls.filter(
      (c) =>
        Math.min(
          bins - 1,
          Math.floor(
            (((c.start ?? c.at) - turn.start) / (end - turn.start)) * bins,
          ),
        ) === i,
    );
    return {
      models: models(included).length,
      tools: tools(included).length,
      start: (i * (end - turn.start)) / bins,
    };
  });
export const slowest = (turn: Turn) =>
  turn.calls
    .filter((c) => c.start !== null && c.end !== null)
    .reduce<Call | undefined>(
      (best, c) => (!best || elapsed(c)! > elapsed(best)! ? c : best),
      undefined,
    );
