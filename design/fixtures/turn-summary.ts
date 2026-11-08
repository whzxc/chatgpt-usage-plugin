import { variant } from "./usage";
export const turnHeaderExamples = [
  "long",
  "scheduled",
  "failed",
  "running",
  "interrupted",
].map((kind, i) => ({ ...variant(kind), sequence: i + 1 }));
