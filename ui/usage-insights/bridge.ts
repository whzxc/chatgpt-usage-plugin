import { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
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
export function onResult(listener: (data: Snapshot) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export type UsageRoute = { scope: "global" | "thread"; threadId: string };
const routeListeners = new Set<(route: UsageRoute) => void>();
export function onRoute(listener: (route: UsageRoute) => void) {
  routeListeners.add(listener);
  return () => {
    routeListeners.delete(listener);
  };
}
let browserNavigation = false;
export function navigate(threadId: string) {
  if (browserNavigation)
    void app.notification({
      method: "usage/notifications/navigate",
      params: { scope: threadId ? "thread" : "global", threadId },
    });
}
app.setNotificationHandler(
  "usage/notifications/route-changed",
  {
    params: z.object({
      scope: z.enum(["global", "thread"]),
      threadId: z.string(),
    }),
  },
  (message) => {
    if (browserNavigation)
      routeListeners.forEach((listener) => listener(message));
  },
);
function dataOf(result: unknown): Snapshot | undefined {
  const r = result as
    { _meta?: { usage?: Snapshot }; structuredContent?: Snapshot } | undefined;
  return r?._meta?.usage ?? r?.structuredContent;
}
let initialResult: unknown;
app.ontoolresult = (result) => {
  initialResult = result;
  const data = dataOf(result);
  if (data?.schemaVersion === 1)
    listeners.forEach((listener) => listener(data));
};
app.onhostcontextchanged = applyHostContext;
app.onteardown = () => {
  stopSizing?.();
  stopReload?.();
  return {};
};
let initialization: Promise<void> | undefined;
export function initialize() {
  return (initialization ??= app
    .connect(undefined, { timeout: 20000 })
    .then(() => {
      browserNavigation =
        !!app.getHostCapabilities()?.experimental?.usageNavigation;
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
export async function refresh(args: Record<string, unknown>) {
  const result = await app.callServerTool(
    { name: "usage_refresh", arguments: args },
    { timeout: 20000 },
  );
  const data = dataOf(result);
  if (data?.schemaVersion !== 1) throw new Error(text("schemaError"));
  return data;
}
export async function openLink(url: string) {
  await app.openLink({ url }, { timeout: 20000 });
}

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    stopSizing?.();
    stopReload?.();
    void app.close();
  });
