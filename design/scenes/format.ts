export const number = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
export const compact = (n: number | null): string =>
  n === null
    ? "—"
    : n >= 1e6
      ? `${(n / 1e6).toFixed(2)}M`
      : n >= 1000
        ? `${(n / 1000).toFixed(1)}K`
        : number(n);
export const axisCompact = (n: number) =>
  compact(n).replace(/\.0+(?=[KM]$)/, "");
export const money = (n: number | null) =>
  n === null ? "—" : n > 0 && n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;
export const percent = (n: number | null) =>
  n === null ? "—" : `${n.toFixed(1)}%`;
export const duration = (ms: number | null): string =>
  ms === null
    ? "—"
    : ms < 60000
      ? `${Number((ms / 1000).toFixed(1))}s`
      : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
export const bytes = (n: number) =>
  n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
export const utf8 = (s: string) => new TextEncoder().encode(s).length;
export function frame(source: string, name: string) {
  return {
    name,
    width: 720,
    fixture: `cup-${source}-${name}`,
    capture: { page: true as const, viewport: "720x2400" },
    note: "Visual baseline approved at 2f983b9. Governance review status: docs/design-assets.md.",
  };
}
