export const integer = (n: number | null) =>
  n === null ? "—" : Math.round(n).toLocaleString("zh-CN");
export function compact(n: number | null) {
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs < 1000) return integer(n);
  const [div, suffix] =
    abs >= 1e9 ? [1e9, "B"] : abs >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  const scaled = n / div;
  return `${scaled.toFixed(Math.abs(scaled) < 10 ? 2 : Math.abs(scaled) < 100 ? 1 : 0).replace(/\.0+$|(?<=\.[0-9])0$/, "")}${suffix}`;
}
export function money(n: number | null) {
  if (n === null) return "—";
  return n > 0 && n < 0.01
    ? "<$0.01"
    : n >= 1000
      ? `$${Math.round(n).toLocaleString("zh-CN")}`
      : `$${n.toFixed(2)}`;
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
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  return d.getFullYear() === now.getFullYear()
    ? date
    : `${d.getFullYear()}/${date}`;
}
export function fullTime(n: number | null) {
  if (!n) return "—";
  const d = new Date(n);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${time(n)}`;
}
export function duration(n: number | null) {
  if (n == null) return "—";
  if (n < 60000) return `${Number((Math.max(0, n) / 1000).toFixed(1))} 秒`;
  const seconds = Math.round(n / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分 ${seconds % 60} 秒`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}
export function ttft(n: number | null) {
  return n == null ? "—" : `${(n / 1000).toFixed(1)} 秒`;
}
export function clock(n: number | null) {
  if (!n) return "—";
  return new Date(n).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
export function bytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
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
