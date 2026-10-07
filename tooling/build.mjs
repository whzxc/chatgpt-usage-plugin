import { readFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function buildServer({ release = false } = {}) {
  await import("./build-plugin.mjs");
  const version = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  ).version;
  const outdir = path.join(root, "dist/server");
  await mkdir(outdir, { recursive: true });
  const result = await build({
    metafile: true,
    entryPoints: [
      path.join(root, "server/main.ts"),
      path.join(root, "server/worker.ts"),
    ],
    outdir,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    minify: release,
    legalComments: "eof",
    define: {
      __PLUGIN_VERSION__: JSON.stringify(version),
      __PANEL_HTML__: JSON.stringify(
        await readFile(path.join(root, "dist/plugin/app.html"), "utf8"),
      ),
      __ICON_SVG__: JSON.stringify(
        await readFile(
          path.join(root, "plugins/usage/assets/icon.svg"),
          "utf8",
        ),
      ),
      __DEV__: String(!release),
    },
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
  });
  const inputs = [
    ...Object.keys(result.metafile.inputs),
    ...JSON.parse(
      await readFile(path.join(root, "dist/plugin/modules.json"), "utf8"),
    ),
  ];
  const packages = new Set(
    inputs.flatMap((input) => {
      const clean = input.replaceAll("\\", "/").replace(/^\0/, "");
      const matches = [
        ...clean.matchAll(/(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+/g),
      ];
      const match = matches.at(-1);
      return match
        ? [path.resolve(root, clean.slice(0, match.index + match[0].length))]
        : [];
    }),
  );
  const notices = [];
  for (const directory of packages) {
    const pkg = JSON.parse(
      await readFile(path.join(directory, "package.json"), "utf8"),
    );
    const licenses = (await readdir(directory, { recursive: true }))
      .filter((name) =>
        /^(LICENSE|LICENCE|COPYING|NOTICE)([.-]|$)/i.test(path.basename(name)),
      )
      .sort();
    const texts = await Promise.all(
      licenses.map((name) => readFile(path.join(directory, name), "utf8")),
    );
    if (["react-remove-scroll-bar", "victory-vendor"].includes(pkg.name))
      texts.unshift(
        await readFile(
          path.join(root, "shared/licenses", `${pkg.name}.LICENSE`),
          "utf8",
        ),
      );
    if (!texts.length)
      throw new Error(`Missing bundled dependency license: ${pkg.name}`);
    notices.push({
      name: pkg.name,
      text: `${pkg.name} ${pkg.version}\n` + texts.join("\n"),
    });
  }
  notices.push({
    name: "OpenUsage",
    text:
      "OpenUsage pricing adaptations\n" +
      (await readFile(
        path.join(root, "shared/pricing/LICENSE.OpenUsage"),
        "utf8",
      )),
  });
  await writeFile(
    path.join(outdir, "THIRD_PARTY_NOTICES.txt"),
    notices
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((n) => n.text)
      .join("\n--------------------\n"),
  );
  return path.join(outdir, "main.mjs");
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  await buildServer({ release: process.argv.includes("--release") });
