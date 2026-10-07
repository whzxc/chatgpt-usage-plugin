// Assemble the same dual-platform payload formerly hosted in a separate marketplace repository.
import { execFileSync } from "node:child_process";
import {
  chmod,
  cp,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const platforms = ["darwin-aarch64", "windows-x86_64"];
async function files(root, prefix = "") {
  const out = [];
  for (const entry of await readdir(path.join(root, prefix), {
    withFileTypes: true,
  })) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...(await files(root, name)));
    else if (entry.isFile()) out.push(name);
    else throw new Error("Unexpected package entry: " + name);
  }
  return out.sort();
}
const [mode, source, output] = process.argv.slice(2);
if (mode === "assemble") {
  if (!source || !output)
    throw new Error("assemble <artifacts> <empty-output>");
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).length) throw new Error("Output must be empty");
  const temp = await mkdtemp(path.join(tmpdir(), "usage-marketplace-"));
  try {
    const roots = [];
    const binaries = {};
    for (const platform of platforms) {
      const name = `ChatGPT.Usage_${version}_${platform}.zip`;
      const archive = path.join(source, name);
      const expected = (await readFile(archive + ".sha256", "utf8"))
        .trim()
        .split(/\s+/)[0];
      if (hash(await readFile(archive)) !== expected)
        throw new Error("ZIP checksum mismatch");
      const root = path.join(temp, platform);
      await mkdir(root);
      execFileSync("unzip", ["-q", path.resolve(archive), "-d", root], {
        stdio: "inherit",
      });
      binaries[platform] = {};
      for (const file of await files(path.join(root, "plugins/usage/bin")))
        binaries[platform][file] = hash(
          await readFile(path.join(root, "plugins/usage/bin", file)),
        );
      const config = JSON.parse(
        await readFile(path.join(root, "plugins/usage/.mcp.json"), "utf8"),
      );
      if (
        config.mcpServers.usage.command !== "./bin/chatgpt-usage" ||
        config.mcpServers.usage.env
      )
        throw new Error("Unexpected MCP configuration");
      const manifest = JSON.parse(
        await readFile(
          path.join(root, "plugins/usage/.codex-plugin/plugin.json"),
          "utf8",
        ),
      );
      if (manifest.name !== "usage" || manifest.version !== version)
        throw new Error("Plugin version mismatch");
      roots.push(root);
    }
    const common = await files(roots[0]);
    if (JSON.stringify(common) !== JSON.stringify(await files(roots[1])))
      throw new Error("Platform layouts differ");
    for (const file of common)
      if (
        !(await readFile(path.join(roots[0], file))).equals(
          await readFile(path.join(roots[1], file)),
        )
      )
        throw new Error("Platform metadata differs: " + file);
    await cp(roots[0], output, { recursive: true });
    await chmod(path.join(output, "plugins/usage/bin/chatgpt-usage"), 0o755);
    await writeFile(
      path.join(output, "release.json"),
      JSON.stringify(
        {
          version,
          sourceCommit: git(".", "rev-parse", "HEAD"),
          files: binaries[platforms[0]],
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(path.join(output, ".gitattributes"), "* -text\n");
    await copyFile("docs/marketplace.md", path.join(output, "README.md"));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
} else if (mode === "publish") {
  if (!source) throw new Error("publish <assembled-marketplace>");
  const info = JSON.parse(
    await readFile(path.join(source, "release.json"), "utf8"),
  );
  if (
    info.version !== version ||
    info.sourceCommit !== git(".", "rev-parse", "HEAD")
  )
    throw new Error("Source identity mismatch");
  if (process.env.GITHUB_REF !== `refs/tags/v${version}`)
    throw new Error("Publishing requires the matching source version tag");
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository !== "whzxc/chatgpt-usage-plugin")
    throw new Error("Unexpected destination repository");
  const temp = await mkdtemp(path.join(tmpdir(), "usage-publish-"));
  try {
    await cp(source, temp, { recursive: true });
    for (const [file, expected] of Object.entries(info.files)) {
      if (
        file.includes("..") ||
        path.isAbsolute(file) ||
        hash(await readFile(path.join(temp, "plugins/usage/bin", file))) !==
          expected
      )
        throw new Error("Bundle checksum mismatch");
    }
    git(temp, "init", "-b", "stable");
    git(
      temp,
      "remote",
      "add",
      "origin",
      `https://github.com/${repository}.git`,
    );
    const exists = git(temp, "ls-remote", "origin", "refs/heads/stable");
    if (exists) {
      git(temp, "fetch", "origin", "stable");
      git(temp, "reset", "--soft", "FETCH_HEAD");
    }
    git(temp, "config", "user.name", "github-actions[bot]");
    git(
      temp,
      "config",
      "user.email",
      "41898282+github-actions[bot]@users.noreply.github.com",
    );
    git(temp, "add", "-A");
    git(temp, "update-index", "--chmod=+x", "plugins/usage/bin/chatgpt-usage");
    git(temp, "commit", "-m", `chore(marketplace): 发布用量插件 ${version}`);
    git(temp, "push", "origin", "HEAD:refs/heads/stable");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
} else throw new Error("Expected assemble or publish");
