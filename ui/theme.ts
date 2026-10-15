import "./tokens.css";
const root = document.documentElement;
root.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
export function applyMcpHostTheme(context: unknown) {
  const host = context as
    | { theme?: string; styles?: { variables?: Record<string, string> } }
    | undefined;
  if (host?.theme === "light" || host?.theme === "dark")
    root.dataset.theme = host.theme;
  for (const [key, value] of Object.entries(host?.styles?.variables ?? {}))
    if (key.startsWith("--") && typeof value === "string")
      root.style.setProperty(key, value);
}
