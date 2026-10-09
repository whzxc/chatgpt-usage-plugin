import { build } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
// Keep light-dark() native so host color-scheme updates remain reactive.
const result = await build({
  configFile: false,
  plugins: [react()],
  define: {
    __PLUGIN_VERSION__: JSON.stringify(pkg.version),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    cssTarget: "chrome123",
    write: false,
    minify: true,
    // The MCP transport logs entire messages at debug level. Chromium retains
    // console arguments, including every polled snapshot, even with DevTools shut.
    // Keep warning/error diagnostics without retaining historical payloads.
    rolldownOptions: {
      treeshake: { manualPureFunctions: ["console.debug"] },
    },
    lib: {
      entry: fileURLToPath(new URL("ui/usage-insights/main.tsx", root)),
      name: "UsageInsights",
      formats: ["iife"],
    },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(
  (r) => r.output,
);
const js = outputs
  .filter((o) => o.type === "chunk")
  .map((o) => o.code)
  .join("\n")
  .replace(/<\/script/gi, "<\\/script");
const css = outputs
  .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
  .map((o) => o.source)
  .join("\n");
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Usage Insights</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await mkdir(new URL("dist/plugin/", root), { recursive: true });
await writeFile(new URL("dist/plugin/app.html.tmp", root), html);
await rename(
  new URL("dist/plugin/app.html.tmp", root),
  new URL("dist/plugin/app.html", root),
);
console.log(
  `Built self-contained MCP resource (${Buffer.byteLength(html)} bytes).`,
);

await writeFile(
  new URL("dist/plugin/modules.json", root),
  JSON.stringify(
    outputs
      .filter((o) => o.type === "chunk")
      .flatMap((o) => Object.keys(o.modules)),
  ),
);
