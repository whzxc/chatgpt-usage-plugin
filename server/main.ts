import { readFileSync } from "node:fs";
import { McpServer, type ServerContext } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { hash, version, text, type Json } from "./common.js";
import { UsageService } from "./service.js";
import { Quota } from "./quota.js";
declare const __PANEL_HTML__: string, __ICON_SVG__: string, __DEV__: boolean;
if (process.argv.includes("--version")) {
  console.log(version);
  process.exit(0);
}
if (process.argv[2] !== "mcp") throw new Error("Expected mcp or --version");
const html = __PANEL_HTML__,
  uri = `ui://chatgpt-usage/panel-${version}-${hash(html).slice(0, 12)}.html`;
const icons = [
  {
    src: `data:image/svg+xml;base64,${Buffer.from(__ICON_SVG__).toString("base64")}`,
    mimeType: "image/svg+xml",
    sizes: ["any"],
  },
];
const service = new UsageService(),
  quota = new Quota(() => service.history());
const server = new McpServer({ name: "chatgpt-usage", version, icons });
const inputSchema = z
  .object({
    taskPage: z.number().int().min(1).optional(),
    taskPageSize: z
      .union([
        z.literal(5),
        z.literal(10),
        z.literal(20),
        z.literal(50),
        z.literal(100),
      ])
      .optional(),
    taskSearch: z.string().max(200).optional(),
    refreshQuota: z.boolean().optional(),
    scope: z.enum(["global", "thread"]).optional(),
    threadId: z.string().max(128).optional(),
    days: z.union([z.literal(1), z.literal(7), z.literal(30)]).optional(),
    turnId: z.string().max(128).optional(),
    toolId: z.string().max(256).optional(),
    responseOffset: z.number().int().nonnegative().optional(),
    toolOffset: z.number().int().nonnegative().optional(),
  })
  .strict();
for (const [name, title, entry] of [
  ["usage_overview", "Usage overview", "global"],
  ["usage_task", "Task usage", "thread"],
  ["usage_refresh", "Refresh usage", null],
] as const) {
  registerAppTool(
    server,
    name,
    {
      title,
      ...{ icons },
      description:
        "Read Codex usage from readable native logs. No model turn or account changes.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: uri, visibility: ["app"] },
        ...(entry ? { "openai/ui": { entrypoints: [{ type: entry }] } } : {}),
      },
    },
    async (args: z.infer<typeof inputSchema>, extra: ServerContext) => {
      const scope =
        name === "usage_overview" ||
        (name === "usage_refresh" && args.scope === "global")
          ? "global"
          : "thread";
      const meta = {
        threadId: text(extra.mcpReq._meta, "threadId"),
        thread_id: text(extra.mcpReq._meta, "thread_id"),
      };
      const snapshot = await service.query(args, meta, scope);
      // Task panels never render account quota or its device-wide history.
      // Do not start that index or transport it on every task refresh.
      const data: Json = {
        ...snapshot,
        quota:
          scope === "global"
            ? quota.snapshot(args.refreshQuota === true)
            : null,
      };
      return {
        content: [
          {
            type: "text" as const,
            text: "Codex usage panel; detailed statistics are displayed only in the panel.",
          },
        ],
        structuredContent: { scope, state: data.state },
        _meta: { ui: { resourceUri: uri }, usage: data },
      };
    },
  );
}
registerAppResource(server, "Usage Insights", uri, {}, async () => {
  let current = html;
  const meta: Json = {
    ui: {
      prefersBorder: false,
      csp: { connectDomains: [], resourceDomains: [] },
    },
  };
  if (__DEV__ && process.env.CHATGPT_USAGE_DEV_HTML) {
    try {
      current = readFileSync(process.env.CHATGPT_USAGE_DEV_HTML, "utf8");
    } catch {}
    const revision = hash(current);
    meta["usage/devRevision"] = revision;
    meta.ui.csp.frameDomains = ["blob:"];
    current = current.replace(
      "<head>",
      `<head><script>window.__USAGE_DEV__=${JSON.stringify({ uri, revision }).replaceAll("<", "\\u003c")};</script>`,
    );
  }
  return {
    contents: [
      { uri, mimeType: RESOURCE_MIME_TYPE, text: current, _meta: meta },
    ],
  };
});
const transport = new StdioServerTransport(undefined, undefined, {
  maxBufferSize: 1024 * 1024,
});
let stopped = false;
const stop = () => {
  if (stopped) return;
  stopped = true;
  quota.stop();
  service.stop();
  void server.close().finally(() => process.exit(0));
};
process.stdin.on("end", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await server.connect(transport);
