import { App } from "@modelcontextprotocol/ext-apps";
import { applyHostSize, observeHostSize } from "../host-size";
import { applyMcpHostTheme } from "../theme";
import { locale, resolveLocale } from "../i18n";
import { text } from "./format";
import type { Snapshot } from "../../shared/usage";
import { devReload } from "../plugin-dev";
export type * from "../../shared/usage";
declare const __PLUGIN_VERSION__: string;
const app = new App(
  { name: "chatgpt-usage", version: __PLUGIN_VERSION__ },
  {},
  { autoResize: false },
);
let stopSizing: (() => void) | undefined, stopReload: (() => void) | undefined;
let teardown: (() => void) | undefined;
let disposed = false;
export function onTeardown(listener: () => void) {
  teardown = listener;
}
function dispose() {
  disposed = true;
  stopSizing?.();
  stopReload?.();
  teardown?.();
  teardown = undefined;
  initialResult = undefined;
  listeners.clear();
  initialListeners.clear();
}
function applyHostContext(context: unknown) {
  applyMcpHostTheme(context);
  applyHostSize(context);
  const host = context as { locale?: string } | undefined;
  if (host?.locale) {
    const next = resolveLocale([host.locale]);
    locale.set(next);
    document.documentElement.lang = next;
  }
}
const listeners = new Set<(data: Snapshot) => void>();
const initialListeners = new Set<(result: unknown) => void>();
export function onInitialResult(listener: (result: unknown) => void) {
  initialListeners.add(listener);
  if (initialResult !== undefined) listener(initialResult);
  return () => {
    initialListeners.delete(listener);
  };
}
export function onResult(listener: (data: Snapshot) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function dataOf(result: unknown): Snapshot | undefined {
  const r = result as
    { _meta?: { usage?: Snapshot }; structuredContent?: Snapshot } | undefined;
  return r?._meta?.usage ?? r?.structuredContent;
}
let initialResult: unknown;
app.ontoolresult = (result) => {
  if (disposed) return;
  initialResult = result;
  initialListeners.forEach((listener) => listener(result));
  const data = dataOf(result);
  if (data?.schemaVersion === 1)
    listeners.forEach((listener) => listener(data));
};
app.onhostcontextchanged = applyHostContext;
app.onteardown = () => {
  dispose();
  return {};
};
window.addEventListener(
  "pagehide",
  () => {
    dispose();
    void app.close();
  },
  { once: true },
);
let initialization: Promise<void> | undefined;
export function initialize() {
  return (initialization ??= app
    .connect(undefined, { timeout: 20000 })
    .then(() => {
      if (disposed) return;
      applyHostContext(app.getHostContext());
      stopSizing?.();
      stopSizing = observeHostSize((params) => {
        void app.sendSizeChanged(params);
      });
      stopReload = devReload(
        app,
        () => initialResult,
        (result) => {
          initialResult = result;
          const data = dataOf(result);
          if (data?.schemaVersion === 1)
            listeners.forEach((listener) => listener(data));
        },
      );
    })
    .catch((error) => {
      initialization = undefined;
      throw error;
    }));
}
export async function refresh(
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  if (disposed) throw new Error("Usage panel closed");
  const result = await app.callServerTool(
    { name: "usage_refresh", arguments: args },
    { timeout: 20000, signal },
  );
  const data = dataOf(result);
  if (data?.schemaVersion !== 1) throw new Error(text("schemaError"));
  return data;
}
export async function callData<T>(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const result = await app.callServerTool(
    { name, arguments: args },
    { timeout: 20000, signal },
  );
  const data = (result as { structuredContent?: T }).structuredContent;
  if (!data) throw new Error("无法读取本机用量。");
  return data;
}
export async function openLink(url: string) {
  await app.openLink({ url }, { timeout: 20000 });
}

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    dispose();
    void app.close();
  });
