import { variant } from "../scenes/usage";
export function waterfallProps(name: string) {
  const turn = variant(name),
    partial = name === "partial";
  const loadedEnd = partial
    ? Math.max(
        ...turn.calls
          .filter((c) => (c.start ?? c.at) < 24000)
          .map((c) => c.end ?? turn.now),
      )
    : 0;
  const viewRange: [number, number] | undefined = partial
    ? [
        0,
        Math.min(
          turn.end ?? turn.now,
          loadedEnd + Math.max(100, loadedEnd * 0.04),
        ),
      ]
    : undefined;
  return {
    turn,
    viewRange,
    partial: name === "partial",
    details: name === "request-detail" || name.startsWith("narrative-"),
    narrative:
      name === "request-detail"
        ? ("full" as const)
        : name === "narrative-loading"
          ? ("loading" as const)
          : name === "narrative-error"
            ? ("error" as const)
            : ("collapsed" as const),
  };
}
