import { createStore } from './state/store';
import './tokens.css';
const system = matchMedia('(prefers-color-scheme: dark)');
export const dark = createStore(system.matches);
document.documentElement.dataset.theme = system.matches ? 'dark' : 'light';
document.documentElement.style.colorScheme = system.matches ? 'dark' : 'light';
export function applyMcpHostTheme(context: unknown) {
  if (!context || typeof context !== 'object') return;
  const host = context as {theme?: string; styles?: {variables?: Record<string, string>}};
  if (host.theme === 'light' || host.theme === 'dark') {
    document.documentElement.dataset.theme = host.theme;
    document.documentElement.style.colorScheme = host.theme;
  }
  dark.set(document.documentElement.dataset.theme === 'dark');
  document.documentElement.dataset.surface = 'mcp';
  for (const [key, value] of Object.entries(host.styles?.variables ?? {})) {
    if (key.startsWith('--') && typeof value === 'string') document.documentElement.style.setProperty(key, value);
  }
}
