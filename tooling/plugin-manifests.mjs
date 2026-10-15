import { readFile } from "node:fs/promises";
import { deepStrictEqual } from "node:assert/strict";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

// Vendored official schemas: validation never fetches network resources.
const ajv = new Ajv2020({ allErrors: true });
const validators = {};
for (const name of ["plugin", "mcp"]) {
  validators[name] = ajv.compile(
    JSON.parse(
      await readFile(
        new URL(`./schemas/${name}.schema.json`, import.meta.url),
        "utf8",
      ),
    ),
  );
}
export async function checkManifests(directory, version) {
  const read = async (file) =>
    JSON.parse(await readFile(path.join(directory, file), "utf8"));
  const manifest = await read("plugin.json"),
    config = await read("mcp.json");
  for (const [name, value] of [
    ["plugin", manifest],
    ["mcp", config],
  ]) {
    if (!validators[name](value))
      throw new Error(
        `${name}.json: ${ajv.errorsText(validators[name].errors)}`,
      );
  }
  if (manifest.name !== "usage" || manifest.version !== version)
    throw new Error("Portable plugin identity/version mismatch");
  deepStrictEqual(config.mcpServers, {
    usage: {
      type: "stdio",
      command: "./bin/chatgpt-usage",
      args: ["mcp"],
      cwd: "${PLUGIN_ROOT}",
    },
  });
  const legacy = await read(".codex-plugin/plugin.json");
  for (const key of ["name", "version", "description", "author"])
    deepStrictEqual(legacy[key], manifest[key]);
  deepStrictEqual(manifest.extensions, {
    "com.openai": { interface: legacy.interface },
  });
  if (legacy.mcpServers !== "./.mcp.json" || legacy.apps)
    throw new Error("Unexpected legacy plugin components");
  const legacyConfig = await read(".mcp.json");
  const { env_vars, tool_timeout_sec, ...server } =
    legacyConfig.mcpServers.usage;
  deepStrictEqual(Object.keys(legacyConfig.mcpServers), ["usage"]);
  deepStrictEqual(server, {
    command: "./bin/chatgpt-usage",
    args: ["mcp"],
    cwd: ".",
  });
  if (!Array.isArray(env_vars) || tool_timeout_sec !== 330)
    throw new Error("Unexpected legacy host settings");
  return config.mcpServers.usage;
}
