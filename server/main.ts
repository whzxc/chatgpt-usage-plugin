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
import { dataTools, overviewInitial, taskInitial } from "./data-tools.js";
import { UsageService } from "./service.js";
declare const __PANEL_HTML__: string,
  __ICON_SVG__: string,
  __ENTRY_ICON_SVG__: string,
  __DEV__: boolean;
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
const service = new UsageService();
const server = new McpServer({ name: "chatgpt-usage", version, icons });
for (const [name, title, entry] of [
  ["usage_overview", "Usage overview", "global"],
  ["usage_task", "Task usage", "thread"],
] as const) {
  const appInput = z
    .object({ threadId: z.string().max(128).optional() })
    .strict();
  registerAppTool(
    server,
    name,
    {
      title,
      ...{
        icons: [
          {
            src: `data:image/svg+xml;base64,${Buffer.from(__ENTRY_ICON_SVG__).toString("base64")}`,
            mimeType: "image/svg+xml",
            sizes: ["20x20"],
          },
        ],
      },
      description:
        "Read Codex usage from readable native logs. No model turn or account changes.",
      inputSchema: appInput,
      outputSchema: z.object({
        scope: z.literal(name === "usage_overview" ? "global" : "thread"),
        state: z.enum(["ready", "indexing", "unavailable"]),
      }),
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
    async (args: z.infer<typeof appInput>, extra: ServerContext) => {
      const scope = name === "usage_overview" ? "global" : "thread";
      const meta = {
        threadId: text(extra.mcpReq._meta, "threadId"),
        thread_id: text(extra.mcpReq._meta, "thread_id"),
      };
      if (name === "usage_overview") {
        const range = "7d" as const;
        const initial = overviewInitial.parse({
          range,
          summary: service.data("usage_summary", { range }, meta),
          tasks: service.data(
            "usage_tasks",
            { range, sort: "recent", page: 1, pageSize: 10 },
            meta,
          ),
          quota: service.data("usage_quota", {}, meta),
        });
        return {
          content: [{ type: "text" as const, text: "本机用量总览。" }],
          structuredContent: {
            scope: "global" as const,
            state: initial.summary.index.state,
          },
          _meta: { ui: { resourceUri: uri }, usageOverview: initial },
        };
      }
      const data = taskInitial.parse(
        service.data("usage_thread", { threadId: args.threadId }, meta),
      );
      return {
        content: [{ type: "text" as const, text: "本机任务用量。" }],
        structuredContent: { scope, state: data.index.state },
        _meta: { ui: { resourceUri: uri }, usageTask: data },
      };
    },
  );
}
for (const [name, schemas] of Object.entries(dataTools)) {
  server.registerTool(
    name,
    {
      description: "Read indexed local usage data.",
      inputSchema: schemas.input,
      outputSchema: schemas.output,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args: Json, extra: ServerContext) => ({
      content: [{ type: "text" as const, text: "Local usage data." }],
      structuredContent: service.data(name, args, extra.mcpReq._meta ?? {}),
    }),
  );
}
registerAppResource(server, "Usage Insights", uri, {}, async () => {
  let current = html;
  const meta: Json = {
    "openai/ui": {
      availableDisplayModes: ["fullscreen"],
      preferredDisplayMode: "fullscreen",
    },
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
  void service
    .stop()
    .finally(() => server.close().finally(() => process.exit(0)));
};
process.stdin.on("end", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await server.connect(transport);
