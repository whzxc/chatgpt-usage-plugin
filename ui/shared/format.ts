export const integer = (n: number | null) =>
  n === null ? "—" : Math.round(n).toLocaleString("zh-CN");
export function compact(n: number | null) {
  if (n === null) return "—";
  return n >= 1e6
    ? `${(n / 1e6).toFixed(2)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}K`
      : integer(n);
}
export function money(n: number | null) {
  if (n === null) return "—";
  return n > 0 && n < 0.01
    ? "<$0.01"
    : n >= 1000
      ? `$${Math.round(n).toLocaleString("zh-CN")}`
      : `$${n.toFixed(2)}`;
}
export const percent = (n: number | null) =>
  n === null ? "—" : `${n.toFixed(1)}%`;
export const axisCompact = (n: number) =>
  compact(n).replace(/\.0+(?=[KM]$)/, "");
export function time(n: number | null) {
  if (!n) return "—";
  const d = new Date(n);
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
export function duration(n: number | null) {
  if (n == null) return "—";
  if (n < 60000) return `${Number((Math.max(0, n) / 1000).toFixed(1))}s`;
  const seconds = Math.round(n / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export function ttft(n: number | null) {
  return n == null ? "—" : `${(n / 1000).toFixed(1)}s`;
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

export function calendarTime(n: number | null) {
  if (n === null) return "—";
  const d = new Date(n);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${time(n)}`;
}
