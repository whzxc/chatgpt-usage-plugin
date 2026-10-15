export type Range = "today" | "7d" | "30d";
export type IndexState = {
  state: "ready" | "indexing" | "unavailable";
  processed: number;
  total: number;
  reason: string | null;
};
export type Summary = {
  totals: {
    tokens: number | null;
    input: number | null;
    cached: number | null;
    output: number | null;
    cost: number | null;
    costIncomplete: boolean;
    requests: number;
    tasks: number;
    outputTps: number | null;
    ttftMedianMs: number | null;
    ttftP90Ms: number | null;
    ttftTurns: number;
  };
  models: {
    id: string;
    slot: number;
    tokens: number | null;
    cost: number | null;
    requests: number;
  }[];
  buckets: {
    at: number;
    models: { id: string; tokens: number | null; cost: number | null }[];
  }[];
  index: IndexState;
};
export type Tasks = {
  total: number;
  page: number;
  pageSize: number;
  tasks: {
    threadId: string;
    title: string | null;
    turns: number | null;
    requests: number;
    tokens: number | null;
    input: number | null;
    cached: number | null;
    cost: number | null;
    lastActivity: number | null;
    running: boolean;
  }[];
  index: IndexState;
};
export type Quota = {
  plan: string | null;
  credits: number | null;
  availableResets: number | null;
  windows: {
    id: string;
    durationMinutes: number | null;
    usedPercent: number;
    resetsAt: number | null;
    elapsedPercent: number | null;
    exhaustsAt: number | null;
    cycleUsd: number | null;
    cycleIncomplete: boolean;
  }[];
  state: string;
  reason: string | null;
  observedAt: number | null;
};
export type OverviewInitial = {
  range: Range;
  summary: Summary;
  tasks: Tasks;
  quota: Quota;
};
