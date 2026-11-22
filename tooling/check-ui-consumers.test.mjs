import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("a shared control needs value references from two feature modules", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "usage-ui-consumers-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["tooling", "ui/components/ui", "ui/overview"]) {
    mkdirSync(path.join(root, dir), { recursive: true });
  }
  symlinkSync(
    path.resolve(import.meta.dirname, "../node_modules"),
    path.join(root, "node_modules"),
    "junction",
  );
  const cli = path.join(root, "tooling/check-ui-consumers.mjs");
  copyFileSync(path.join(import.meta.dirname, "check-ui-consumers.mjs"), cli);
  writeFileSync(
    path.join(root, "ui/tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "preserve",
        types: [],
      },
      include: ["**/*.tsx"],
    }),
  );
  writeFileSync(
    path.join(root, "ui/components/ui/controls.tsx"),
    "export function Button() { return null; }",
  );
  writeFileSync(
    path.join(root, "ui/overview/first.tsx"),
    'import { Button } from "../components/ui/controls"; export const view = <Button />;',
  );
  const second = path.join(root, "ui/overview/second.tsx");
  const importButton =
    'import { Button as Action } from "../components/ui/controls";';
  writeFileSync(second, importButton + "export type Control = typeof Action;");
  const run = () => spawnSync(process.execPath, [cli], { encoding: "utf8" });
  const unused = run();
  assert.equal(unused.status, 1, unused.stderr);
  assert.match(
    unused.stderr,
    /controls\.tsx#Button has 1 feature module consumers/,
  );

  writeFileSync(second, importButton + "export const view = <Action />;");
  const used = run();
  assert.equal(used.status, 0, used.stderr);
});
