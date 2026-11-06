import {
  history,
  days,
  primaryHistory,
  modelNames,
  modelTones,
  totals,
} from "./usage";
import { compact, money, percent } from "./format";
export function chartScene(
  mode: "daily" | "hourly" | "single" = "daily",
  metric = "Tokens",
) {
  const records =
    mode === "single"
      ? primaryHistory
      : mode === "hourly"
        ? history.filter((h) => h.day === days.at(-1))
        : history;
  const names = mode === "single" ? modelNames.slice(0, 1) : [...modelNames];
  const labels =
    mode === "hourly"
      ? Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
      : days;
  const buckets = labels.map((label) => ({
    label,
    values: names.map((model) => {
      const t = totals(
        records
          .filter((h) =>
            mode === "hourly" ? h.hour === Number(label) : h.day === label,
          )
          .flatMap((h) => h.turn.calls)
          .filter((c) => c.model === model),
      );
      return (metric === "Tokens" ? t.tokens : t.cost) ?? 0;
    }),
  }));
  const all = totals(records.flatMap((h) => h.turn.calls)),
    denominator = metric === "Tokens" ? all.tokens : all.cost;
  const legend = names.map((label, i) => {
    const group = records.filter((h) => h.turn.calls[0].model === label),
      t = totals(group.flatMap((h) => h.turn.calls)),
      measure = metric === "Tokens" ? t.tokens : t.cost,
      seconds = group.reduce(
        (s, h) => s + ((h.turn.end ?? h.turn.start) - h.turn.start) / 1000,
        0,
      );
    return {
      label,
      value: metric === "Tokens" ? compact(measure) : money(measure),
      detail: `${percent(denominator ? ((measure ?? 0) / denominator) * 100 : null)} · ${money(t.cost)} · ${t.requests} req · ${((t.output ?? 0) / seconds).toFixed(1)} tok/s`,
      tone: modelTones[i],
    };
  });
  return { buckets, legend, names };
}
