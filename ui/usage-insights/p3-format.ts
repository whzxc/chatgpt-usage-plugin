export const integer = (n: number | null) =>
  Math.round(n ?? 0).toLocaleString("zh-CN");
export function compact(n: number | null) {
  const value = n ?? 0,
    abs = Math.abs(value);
  if (abs < 1000) return integer(value);
  const [div, suffix] =
    abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  const scaled = value / div;
  return `${scaled.toFixed(Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0).replace(/\.0+$|(?<=\.[0-9])0$/, "")}${suffix}`;
}
export function money(n: number | null) {
  const v = n ?? 0;
  return v > 0 && v < 0.01
    ? "<$0.01"
    : v >= 1000
      ? `$${Math.round(v).toLocaleString("zh-CN")}`
      : `$${v.toFixed(2)}`;
}
export const percent = (n: number) => `${n.toFixed(1)}%`;
export const quotaPercent = (n: number) => `${Math.round(n)}%`;
export function time(n: number | null) {
  if (!n) return "—";
  const d = new Date(n);
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export function when(n: number | null) {
  if (!n) return "—";
  const d = new Date(n),
    now = new Date(),
    same = d.toDateString() === now.toDateString();
  const yesterday =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    ).toDateString() === d.toDateString();
  if (same) return time(n);
  if (yesterday) return `昨天 ${time(n)}`;
  return d.getFullYear() === now.getFullYear()
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
export function fullTime(n: number | null) {
  if (!n) return "—";
  const d = new Date(n);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${time(n)}`;
}

export function productName(value: string) {
  return value ? value[0]!.toLocaleUpperCase() + value.slice(1) : value;
}

export function bucketTitle(at: number, range: "today" | "7d" | "30d") {
  const start = new Date(at);
  if (range !== "today")
    return `${start.getMonth() + 1} 月 ${start.getDate()} 日`;
  const end = new Date(at + 60 * 60 * 1000);
  const hour = (date: Date) =>
    date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `${hour(start)}–${hour(end)}`;
}

export function chartScale(maximum: number) {
  if (!(maximum > 0)) return { maximum: 1, ticks: [0, 1] };
  const rough = maximum / 4,
    power = 10 ** Math.floor(Math.log10(rough)),
    fraction = rough / power,
    factor = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10,
    step = factor * power;
  let top = Math.ceil(maximum / step) * step;
  if (top <= maximum) top += step;
  while (top / step < 3) top += step;
  return {
    maximum: top,
    ticks: Array.from(
      { length: Math.round(top / step) + 1 },
      (_, i) => i * step,
    ),
  };
}
