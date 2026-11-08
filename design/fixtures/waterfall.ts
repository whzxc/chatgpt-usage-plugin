import { variant } from "../scenes/usage";
export function waterfallProps(name: string) {
  return {
    turn: variant(name),
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
