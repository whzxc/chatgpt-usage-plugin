import "./tokens.css";
const root = document.documentElement;
root.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
let hostVariables = new Set<string>();
export function applyMcpHostTheme(context: unknown) {
  const host = context as
    | { theme?: string; styles?: { variables?: Record<string, string> } }
    | undefined;
  if (host?.theme === "light" || host?.theme === "dark")
    root.dataset.theme = host.theme;
  if (host?.styles?.variables) {
    const next = new Set(Object.keys(host.styles.variables));
    for (const key of hostVariables)
      if (!next.has(key)) root.style.removeProperty(key);
    hostVariables = next;
  }
  for (const [key, value] of Object.entries(host?.styles?.variables ?? {}))
    if (key.startsWith("--") && typeof value === "string")
      root.style.setProperty(key, value);
}
