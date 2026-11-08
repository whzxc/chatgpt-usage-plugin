import { variant } from "../scenes/usage";
export const turnHeaderExamples = [
  "long",
  "scheduled",
  "failed",
  "running",
  "interrupted",
].map((kind, i) => ({ ...variant(kind), sequence: i + 1 }));
