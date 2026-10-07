import type { ProviderSnapshot } from "./quota";
export type Tokens = {
  input: number | null;
  cached: number | null;
  output: number | null;
  reasoning: number | null;
};
export type Counts = Tokens & {
  total: number | null;
  knownTotal?: number | null;
  uncertainRecords?: number;
  records: number;
};
export type TaskSelection = { page: number; pageSize: number; search: string };
export type OutputPerformance = {
  wholeTurnOutputTps: number | null;
  turns: number;
};
export type Task = {
  performance: OutputPerformance;
  id: string;
  label: string | null;
  lastEventAt: number | null;
  period: Metrics & { turns: number | null };
  family: string;
  issues: string[];
  parentId: string | null;
  forkedFromId: string | null;
};
export type ContextObservation = {
  id: string;
  at: number;
  input: number | null;
  model: string | null;
  contextWindow: number | null;
};
export type Compaction = {
  durationMs?: number | null;
  responseId: string;
  turnId: string | null;
  at: number;
  before: ContextObservation | null;
  after: ContextObservation | null;
};
export type Turn = {
  contextWindow: number | null;
  contextStart: ContextObservation | null;
  contextEnd: ContextObservation | null;
  id: string;
  prompt: string | null;
  promptImages: number;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  ttftMs: number | null;
  status: string;
  model: string | null;
  effort: string | null;
  usage: Metrics;
  wholeTurnOutputTps: number | null;
  serviceTier: string | null;
  toolCount: number;
};
export type Response = {
  context: ContextObservation;
  previousContext: ContextObservation | null;
  id: string;
  estimatedUsd: number | null;
  turnId: string | null;
  at: number;
  model: string | null;
  effort: string | null;
  serviceTier: string | null;
  tokens: Tokens;
  family: string;
  reliable: boolean;
};
export type Tool = {
  id: string;
  turnId: string | null;
  name: string | null;
  at: number;
  outputBytes: number | null;
  startedAt: number | null;
  completedAt: number | null;
  status: string | null;
};
export type AssistantMessage = {
  id: string;
  turnId: string;
  at: number;
  text: string;
};
export type Reasoning = {
  id: string;
  turnId: string;
  at: number;
  text: string;
  durationMs?: number;
};
export type Detail = {
  performance: OutputPerformance;
  reasoning: Reasoning[];
  messages: AssistantMessage[];
  toolPreviews: Record<string, string>;
  contentError: string | null;
  id: string;
  label: string | null;
  usage: Metrics;
  issues: string[];
  family: string;
  cliVersion: string | null;
  lastEventAt: number | null;
  turns: Turn[];
  turnCount: number;
  responses: Response[];
  responseCount: number;
  tools: Tool[];
  toolCount: number;
  compactions: Compaction[];
  children: string[];
  parentId: string | null;
  forkedFromId: string | null;
};
type SnapshotBase = {
  schemaVersion: number;
  scope: "global" | "thread";
  pluginVersion: string | null;
  message?: string;
};
export type Snapshot =
  | ReadySnapshot
  | (SnapshotBase & {
      state: "collecting" | "incompatible" | "unavailable";
    });
export type Metrics = Counts & {
  estimatedUsd: number | null;
  unpricedRecords: number;
  requests: number;
};
export type ToolDetail = { id: string; input: unknown; output: unknown };
export type ReadySnapshot = SnapshotBase & {
  performance: OutputPerformance;
  refreshing?: boolean;
  toolDetail?: ToolDetail;
  state: "ready";
  observedAt: string;
  binding: string;
  thread: Detail | null;
  tasks: Task[];
  taskCount: number;
  taskMatchCount: number;
  taskPage: number;
  taskPageSize: number;
  usage: Metrics;
  models: { name: string; usage: Metrics }[];
  daily: { day: string; usage: Metrics }[];
  series: { at: string; models: { name: string; usage: Metrics }[] }[];
  issues: string[];
  range: {
    start: number;
    end: number;
    days: number;
    startDay: string;
    endDay: string;
    timezone: string;
  };
  quota: ProviderSnapshot | null;
};
