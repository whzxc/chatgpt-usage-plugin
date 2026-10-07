import { execFileSync } from "node:child_process";
import { cp, mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { buildServer } from "./build.mjs";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const platform =
  process.platform === "darwin" && process.arch === "arm64"
    ? "darwin-aarch64"
    : process.platform === "win32" && process.arch === "x64"
      ? "windows-x86_64"
      : null;
if (!platform)
  throw new Error("Build packages on Apple Silicon macOS or Windows x64.");
await buildServer({ release: !process.argv.includes("--debug") });
const root = path.resolve("dist/package", platform);
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await cp("plugins/usage", path.join(root, "plugins/usage"), {
  recursive: true,
  filter: (source) => !source.split(path.sep).includes("bin"),
});
await cp(".agents", path.join(root, ".agents"), { recursive: true });
await copyFile("LICENSE", path.join(root, "LICENSE"));
await copyFile("LICENSE", path.join(root, "plugins/usage/LICENSE"));
await mkdir(path.join(root, "plugins/usage/bin"), { recursive: true });
await cp("runtime", path.join(root, "plugins/usage/bin"), { recursive: true });
await cp("dist/server", path.join(root, "plugins/usage/bin"), {
  recursive: true,
});
const configPath = path.join(root, "plugins/usage/.mcp.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
config.mcpServers.usage.command = "./bin/chatgpt-usage";
await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
execFileSync(
  process.execPath,
  ["tooling/check-plugin.mjs", path.join(root, "plugins/usage")],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ...(process.env.CI ? { CHATGPT_USAGE_NODE: process.execPath } : {}),
    },
  },
);
const archive = path.resolve(
  "dist",
  `ChatGPT.Usage_${version}_${platform}.zip`,
);
await rm(archive, { force: true });
if (process.platform === "darwin")
  execFileSync("/usr/bin/zip", ["-q", "-r", archive, "."], {
    cwd: root,
    stdio: "inherit",
  });
else
  execFileSync(
    path.join(process.env.SystemRoot, "System32/tar.exe"),
    ["-c", "--format", "zip", "-f", archive, "-C", root, "."],
    { stdio: "inherit" },
  );
await writeFile(
  archive + ".sha256",
  createHash("sha256")
    .update(await readFile(archive))
    .digest("hex") +
    "  " +
    path.basename(archive) +
    "\n",
);
console.log(archive);
