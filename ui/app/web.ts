// Development host uses the official bridge with the unchanged production panel.
import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps";
const panel = document.getElementById("panel") as HTMLIFrameElement;
function route() {
  const params = new URLSearchParams(location.search),
    threadId = params.get("threadId") || "";
  return {
    scope: threadId || params.get("scope") === "thread" ? "thread" : "global",
    threadId,
  };
}
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
function hostContext(): McpUiHostContext {
  const params = new URLSearchParams(location.search),
    requested = params.get("theme");
  return {
    theme:
      requested === "light" || requested === "dark"
        ? requested
        : systemTheme.matches
          ? "dark"
          : "light",
    containerDimensions: {
      width: panel.clientWidth,
      height: panel.clientHeight,
    },
    locale: params.get("locale") || navigator.language,
  };
}
async function callTool(name: string, args: Record<string, unknown> = {}) {
  const response = await fetch("/__plugin/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Usage-Request": "1" },
    body: JSON.stringify({ name, arguments: args, threadId: route().threadId }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
const bridge = new AppBridge(
  null,
  { name: "usage-preview", version: "1" },
  { serverTools: {} },
  { hostContext: hostContext() },
);
bridge.oncalltool = (params) => callTool(params.name, params.arguments);
bridge.onopenlink = async ({ url }) => {
  if (!/^https?:\/\//.test(url)) return { isError: true };
  window.open(url, "_blank", "noopener,noreferrer");
  return {};
};
bridge.oninitialized = async () => {
  const { scope, threadId } = route();
  try {
    await bridge.sendToolInput({ arguments: threadId ? { threadId } : {} });
    await bridge.sendToolResult(
      await callTool(
        scope === "global" ? "usage_overview" : "usage_task",
        threadId ? { threadId } : {},
      ),
    );
  } catch (error) {
    await bridge.sendToolResult({
      content: [],
      _meta: {
        usageError: (error as Error).message,
      },
    });
  }
};
await bridge.connect(
  new PostMessageTransport(panel.contentWindow!, panel.contentWindow!),
);
systemTheme.addEventListener("change", () =>
  bridge.setHostContext(hostContext()),
);
new ResizeObserver(() => bridge.setHostContext(hostContext())).observe(panel);
panel.src = "/plugin-panel.html";
