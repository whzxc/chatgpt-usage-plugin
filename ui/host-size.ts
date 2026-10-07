// MCP Apps sizing: consume host constraints and report the rendered panel size.
type Dimensions = { width?: number; height?: number; maxWidth?: number; maxHeight?: number };
let dimensions: Dimensions = {};
let schedule: (() => void) | undefined;
const pixels = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

export function applyHostSize(context: unknown) {
  if (!context || typeof context !== "object" || !("containerDimensions" in context)) return;
  dimensions = (context as { containerDimensions?: Dimensions }).containerDimensions ?? {};
  const height = pixels(dimensions.height) ?? pixels(dimensions.maxHeight);
  const width = pixels(dimensions.width) ?? pixels(dimensions.maxWidth);
  const style = document.documentElement.style;
  if (height) style.setProperty("--mcp-panel-height", `${height}px`);
  else style.removeProperty("--mcp-panel-height");
  if (width) style.setProperty("max-width", `${width}px`);
  else style.removeProperty("max-width");
  schedule?.();
}

export function observeHostSize() {
  let frame = 0;
  let previous = "";
  const report = () => {
    frame = 0;
    const rect = document.body.getBoundingClientRect();
    // A host constraint can grow beyond the iframe's previous viewport.
    const width = pixels(dimensions.width) ?? pixels(dimensions.maxWidth) ?? rect.width;
    const height = pixels(dimensions.height) ?? Math.min(rect.height, pixels(dimensions.maxHeight) ?? Infinity);
    const params = { width: Math.ceil(width), height: Math.ceil(height) };
    const key = JSON.stringify(params);
    if (key === previous || !params.width || !params.height) return;
    previous = key;
    window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/size-changed", params }, "*");
  };
  const enqueue = () => { if (!frame) frame = requestAnimationFrame(report); };
  schedule = enqueue;
  const observer = new ResizeObserver(enqueue);
  observer.observe(document.documentElement);
  observer.observe(document.body);
  window.addEventListener("resize", enqueue);
  enqueue();
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", enqueue);
    cancelAnimationFrame(frame);
    schedule = undefined;
  };
}
