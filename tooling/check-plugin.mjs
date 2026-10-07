import { readFile, stat, mkdtemp, rm, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const directory = path.resolve(
  process.argv[2] || "dist/package/darwin-aarch64/plugins/usage",
);
const manifest = JSON.parse(
  await readFile(path.join(directory, ".codex-plugin/plugin.json"), "utf8"),
);
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
if (
  manifest.name !== "usage" ||
  manifest.version !== pkg.version ||
  manifest.mcpServers !== "./.mcp.json" ||
  manifest.apps
)
  throw new Error("Plugin identity/version/standalone entry mismatch");
for (const file of ["LICENSE", "assets/icon.svg"])
  await access(path.join(directory, file));
const config = JSON.parse(
  await readFile(path.join(directory, ".mcp.json"), "utf8"),
);
const server = config.mcpServers.usage;
const commands =
  process.platform === "win32"
    ? ["./bin/chatgpt-usage.cmd", "./bin/chatgpt-usage"]
    : ["./bin/chatgpt-usage"];
if (
  Object.keys(config.mcpServers).length !== 1 ||
  server.cwd !== "." ||
  !commands.includes(server.command) ||
  server.args.join() !== "mcp"
)
  throw new Error("Plugin must use its own relative runtime launcher");
const binary = path.resolve(
  directory,
  server.command +
    (process.platform === "win32" && !server.command.endsWith(".cmd")
      ? ".cmd"
      : ""),
);
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
  for (const name of ["usage_overview", "usage_task", "usage_refresh"]) {
    if (!tools.tools.some((tool) => tool.name === name))
      throw new Error(`Missing plugin tool: ${name}`);
  }
  if (tools.tools.length !== 3)
    throw new Error("Usage plugin must expose only its three panel tools");
  const resources = await client.listResources();
  if (resources.resources.length !== 1)
    throw new Error("UI resources do not match build features");
  const resource = await client.readResource({
    uri: resources.resources[0].uri,
  });
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
    if (overview._meta?.usage?.state === "ready") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (overview._meta?.usage?.state !== "ready")
    throw new Error("Standalone backend did not serve its usage panel");
  console.log(
    `Standalone plugin verified: v${pkg.version}, ${tools.tools.length} tools, embedded UI, TypeScript backend (${process.env.CHATGPT_USAGE_NODE ? "explicit build runtime" : "host runtime"}).`,
  );
} finally {
  await client.close();
  await rm(state, { recursive: true, force: true });
}
