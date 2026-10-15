import { App } from "@modelcontextprotocol/ext-apps";
import { applyHostSize, observeHostSize } from "../host-size";
import { applyMcpHostTheme } from "../theme";
import { devReload } from "../plugin-dev";
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
  initialListeners.clear();
}
function applyHostContext(context: unknown) {
  applyMcpHostTheme(context);
  applyHostSize(context);
}
const initialListeners = new Set<(result: unknown) => void>();
export function onInitialResult(listener: (result: unknown) => void) {
  initialListeners.add(listener);
  if (initialResult !== undefined) listener(initialResult);
  return () => {
    initialListeners.delete(listener);
  };
}
let initialResult: unknown;
app.ontoolresult = (result) => {
  if (disposed) return;
  initialResult = result;
  initialListeners.forEach((listener) => listener(result));
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
          initialListeners.forEach((listener) => listener(result));
        },
      );
    })
    .catch((error) => {
      initialization = undefined;
      throw error;
    }));
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
  if (result.isError || !data) throw new Error("无法读取本机用量。");
  return data;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    dispose();
    void app.close();
  });
