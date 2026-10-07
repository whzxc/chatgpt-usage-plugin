import type { App } from "@modelcontextprotocol/ext-apps";
declare global {
  interface Window {
    __USAGE_DEV__?: { uri: string; revision: string };
    __USAGE_DEV_INITIAL_RESULT__?: unknown;
  }
}
// Development reload uses the same official App connection as the production panel.
export function devReload(
  app: App,
  current: () => unknown,
  accept: (result: unknown) => void,
) {
  const config = window.__USAGE_DEV__;
  if (!config) return () => {};
  if (location.protocol === "blob:") URL.revokeObjectURL(location.href);
  if (window.__USAGE_DEV_INITIAL_RESULT__)
    accept(window.__USAGE_DEV_INITIAL_RESULT__);
  let stopped = false,
    timer: ReturnType<typeof setTimeout>;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener("pagehide", stop);
  };
  async function poll() {
    if (stopped) return;
    if (!document.hidden)
      try {
        const result = await app.readServerResource(
          { uri: config!.uri },
          { timeout: 20000 },
        );
        const content = result.contents.find((c) => c.uri === config!.uri);
        if (
          content?._meta?.["usage/devRevision"] &&
          content._meta["usage/devRevision"] !== config!.revision &&
          "text" in content &&
          typeof content.text === "string"
        ) {
          const initial = JSON.stringify(current() ?? null).replaceAll(
            "<",
            "\\u003c",
          );
          const html = content.text.replace(
            "<head>",
            `<head><script>window.__USAGE_DEV_INITIAL_RESULT__=${initial};</script>`,
          );
          stop();
          location.replace(
            URL.createObjectURL(new Blob([html], { type: "text/html" })),
          );
          return;
        }
      } catch {
        /* Retry after a rebuild or a transient host failure. */
      }
    if (!stopped) timer = setTimeout(poll, 1500);
  }
  window.addEventListener("pagehide", stop);
  timer = setTimeout(poll, 1500);
  return stop;
}
