import { readFile, stat, mkdtemp, rm, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkManifests } from "./plugin-manifests.mjs";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const directory = path.resolve(
  process.argv[2] ||
    `dist/package/${process.platform === "win32" ? "windows-x86_64" : "darwin-aarch64"}/plugins/usage`,
);
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const server = await checkManifests(directory, pkg.version);
for (const file of ["LICENSE", "assets/icon.svg", "assets/entrypoint.svg"])
  await access(path.join(directory, file));
const binary =
  path.resolve(directory, server.command) +
  (process.platform === "win32" ? ".cmd" : "");
const mode = (await stat(binary)).mode;
if (process.platform !== "win32" && !(mode & 0o111))
  throw new Error("Plugin launcher is not executable");
const versionCommand = process.platform === "win32" ? "powershell.exe" : binary;
const versionArgs =
  process.platform === "win32"
    ? [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(directory, "bin/launch.ps1"),
        "--version",
      ]
    : ["--version"];
if (
  execFileSync(versionCommand, versionArgs, { encoding: "utf8" }).trim() !==
  pkg.version
)
  throw new Error("Plugin server version mismatch");
const state = await mkdtemp(path.join(tmpdir(), "usage-plugin-check-"));
const client = new Client({
  name: "usage-artifact-check",
  version: pkg.version,
});
try {
  await client.connect(
    new StdioClientTransport({
      command: binary,
      args: ["mcp"],
      cwd: directory,
      env: {
        ...process.env,
        CHATGPT_USAGE_STATE_DIR: state,
        CODEX_HOME: path.join(state, "codex"),
        CHATGPT_USAGE_DEV_HTML: "",
      },
      stderr: "inherit",
    }),
  );
  const tools = await client.listTools();
  for (const name of [
    "usage_overview",
    "usage_task",
    "usage_summary",
    "usage_tasks",
    "usage_quota",
    "usage_thread",
    "usage_turn",
    "usage_tool",
  ]) {
    if (!tools.tools.some((tool) => tool.name === name))
      throw new Error(`Missing plugin tool: ${name}`);
  }
  if (tools.tools.length !== 8)
    throw new Error(
      "Usage plugin must expose two panel tools and six data tools",
    );
  for (const tool of tools.tools.filter(
    (t) => !["usage_overview", "usage_task"].includes(t.name),
  )) {
    if (
      !tool.inputSchema ||
      !tool.outputSchema ||
      tool._meta?.ui?.visibility?.join() !== "app" ||
      tool._meta?.ui?.resourceUri ||
      tool._meta?.["openai/ui"]
    )
      throw new Error(`Invalid data tool contract: ${tool.name}`);
  }
  for (const [name, entry] of [
    ["usage_overview", "global"],
    ["usage_task", "thread"],
  ]) {
    const tool = tools.tools.find((tool) => tool.name === name);
    const icon = tool.icons?.[0];
    const expected = await readFile(
      path.join(directory, "assets/entrypoint.svg"),
      "utf8",
    );
    if (
      tool._meta?.["openai/ui"]?.entrypoints?.[0]?.type !== entry ||
      !tool._meta?.ui?.resourceUri ||
      icon?.sizes?.join() !== "20x20" ||
      icon?.src !==
        `data:image/svg+xml;base64,${Buffer.from(expected).toString("base64")}` ||
      !expected.includes('viewBox="0 0 20 20"') ||
      !expected.includes('stroke="currentColor"') ||
      !expected.includes('stroke-width="1.5"')
    )
      throw new Error(`Invalid entrypoint: ${name}`);
  }
  const resources = await client.listResources();
  if (resources.resources.length !== 1)
    throw new Error("UI resources do not match build features");
  const resource = await client.readResource({
    uri: resources.resources[0].uri,
  });
  const display = resource.contents[0]._meta?.["openai/ui"];
  if (
    display?.preferredDisplayMode !== "fullscreen" ||
    display?.availableDisplayModes?.join() !== "fullscreen"
  )
    throw new Error("Invalid resource display modes");
  const html = resource.contents[0].text;
  if (
    typeof html !== "string" ||
    !html.includes('<div id="root">') ||
    /<script[^>]+src=/.test(html)
  )
    throw new Error("Release UI must be embedded and self-contained");
  if (
    html !==
    (await readFile(
      new URL("../dist/plugin/app.html", import.meta.url),
      "utf8",
    ))
  )
    throw new Error(
      "Bundled UI differs from this source build; rebuild the server bundle.",
    );
  let overview;
  for (let attempt = 0; attempt < 20; attempt++) {
    overview = await client.callTool({ name: "usage_overview", arguments: {} });
    if (overview._meta?.usageOverview?.summary?.index?.state === "ready") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (
    overview._meta?.usageOverview?.summary?.index?.state !== "ready" ||
    overview._meta?.usageOverview?.range !== "7d" ||
    overview.content?.length !== 1
  )
    throw new Error("Standalone backend did not serve its usage panel");
  console.log(
    `Standalone plugin verified: v${pkg.version}, ${tools.tools.length} tools, embedded UI, TypeScript backend (${process.env.CHATGPT_USAGE_NODE ? "explicit build runtime" : "host runtime"}).`,
  );
} finally {
  await client.close();
  await rm(state, { recursive: true, force: true });
}
