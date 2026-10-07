import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile, access, cp, readFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildServer } from "./build.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const state = path.join(root, "dist/dev-state");
const marketplace = path.join(root, "dist/dev-marketplace");
const html = path.join(root, "dist/plugin/app.html");
await buildServer();
const plugin = path.join(marketplace, "plugins/usage");
await mkdir(path.join(plugin, "bin"), { recursive: true });
await cp(path.join(root, "plugins/usage"), plugin, { recursive: true });
await cp(path.join(root, "runtime"), path.join(plugin, "bin"), {
  recursive: true,
});
await cp(path.join(root, "dist/server"), path.join(plugin, "bin"), {
  recursive: true,
});
const config = JSON.parse(
  await readFile(path.join(plugin, ".mcp.json"), "utf8"),
);
config.mcpServers.usage.command = "./bin/chatgpt-usage";
config.mcpServers.usage.env = {
  CHATGPT_USAGE_STATE_DIR: state,
  CHATGPT_USAGE_DEV_HTML: html,
};
await writeFile(
  path.join(plugin, ".mcp.json"),
  JSON.stringify(config, null, 2) + "\n",
);
await mkdir(path.join(marketplace, ".agents/plugins"), { recursive: true });
await writeFile(
  path.join(marketplace, ".agents/plugins/marketplace.json"),
  JSON.stringify(
    {
      name: "chatgpt-usage-dev",
      interface: { displayName: "Usage Dev" },
      plugins: [
        {
          name: "usage",
          source: { source: "local", path: "./plugins/usage" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Productivity",
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
let builder;
let watcher;
let debounce;
let dirty = false;
let stopping = false;
let finish;
const stopped = new Promise((resolve) => {
  finish = resolve;
});
async function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(debounce);
  watcher?.close();
  builder?.kill();
  finish();
}
function rebuild() {
  if (stopping) return;
  if (builder) {
    dirty = true;
    return;
  }
  dirty = false;
  builder = spawn(
    process.execPath,
    [path.join(root, "tooling/build-plugin.mjs")],
    { cwd: root, stdio: "inherit" },
  );
  builder.on("error", (error) => console.error(error.message));
  builder.on("close", (code) => {
    builder = undefined;
    if (code)
      console.error(
        "Panel build failed; the last working panel remains available. Save a correction to retry.",
      );
    else
      console.log(
        "Panel rebuilt. Open development panels reload automatically.",
      );
    if (dirty) rebuild();
  });
}
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
try {
  let codex = "codex";
  if (process.platform === "darwin") {
    const bundled =
      "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex";
    try {
      await access(bundled);
      codex = bundled;
    } catch {}
  }
  execFileSync(codex, ["plugin", "marketplace", "add", marketplace], {
    stdio: "inherit",
  });
  execFileSync(codex, ["plugin", "add", "usage@chatgpt-usage-dev"], {
    stdio: "inherit",
  });
  watcher = watch(
    path.join(root, "ui"),
    { recursive: true },
    (_event, filename) => {
      if (!filename || !/\.(tsx?|css|js|json|html)$/.test(filename)) return;
      clearTimeout(debounce);
      debounce = setTimeout(rebuild, 200);
    },
  );
  console.log(
    `Plugin dev ready. Open Usage from the chatgpt-usage-dev marketplace in ChatGPT Desktop.\nState: ${state}\nSaving UI source rebuilds the embedded resource and reloads open panels through MCP. Panel state resets. No HTTP server or certificate is needed. Server, manifest and skill changes require restarting this command and reloading the host plugin.`,
  );
  await stopped;
} finally {
  await stop();
}
