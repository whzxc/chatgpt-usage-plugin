import { copy, history } from "../scenes/usage";
export const statusProgress = {
  processed: history.length / 3,
  total: history.length,
};
export const statusMessages = {
  loading: copy.loading,
  error: copy.failure,
  stale: copy.stale,
  empty: copy.noUsage,
  indexing: copy.indexing,
  warning: copy.unknownWarning,
};
export const statusExamples = [
  "loading",
  "indexing",
  "error",
  "stale",
  "empty",
] as const;
