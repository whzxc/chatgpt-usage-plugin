export const longOutput = Array.from(
  { length: 900 },
  (_, i) =>
    `sample_${String(i + 1).padStart(4, "0")}: temperature = 18.65; status = valid`,
).join("\n");

import { baseTurn, variant, elapsed } from "./usage";
export function toolDialogProps(name = "ready") {
  const call = (name === "failed" ? variant("failed") : baseTurn).calls.find(
    (c) => c.id === "t2",
  )!;
  return {
    input: name === "unknown" ? null : (call.command ?? null),
    output:
      name === "unknown"
        ? null
        : name === "long"
          ? longOutput
          : (call.result ?? null),
    durationMs: name === "unknown" ? null : elapsed(call),
    exitCode: name === "unknown" ? null : name === "failed" ? 1 : 0,
    loading: name === "loading",
    error: name === "error",
    copyError: name === "copy-error",
  };
}
export const toolDialogDefaults = toolDialogProps();
