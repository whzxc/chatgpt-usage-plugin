export const overviewForms = [
  "ready",
  "indexing",
  "unavailable",
  "empty",
  "stale",
  "refreshing",
  "unpriced",
  "quota-unavailable",
] as const;
export const taskForms = [
  "ready",
  "empty",
  "indexing",
  "unavailable",
  "stale",
  "long-title",
] as const;
export const turnForms = [
  "completed",
  "running",
  "failed",
  "unknown",
  "partial",
  "request-detail",
  "narrative-loading",
  "narrative-error",
] as const;
export const toolForms = [
  "ready",
  "loading",
  "error",
  "long",
  "failed",
  "copy-error",
  "unknown",
] as const;
export const entryForms = ["loading", "failure"] as const;
