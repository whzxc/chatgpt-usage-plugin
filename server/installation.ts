import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { hash, root, saveBytes } from "./common.js";
let cached: string | undefined;
export function installation(): string {
  if (cached && existsSync(cached)) return cached;
  if (process.platform === "darwin")
    for (const base of ["/Applications", path.join(homedir(), "Applications")])
      for (const name of ["ChatGPT", "Codex"]) {
        const binary = path.join(
          base,
          `${name}.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`,
        );
        if (existsSync(binary)) return (cached = binary);
      }
  if (process.platform === "win32") {
    const location = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty InstallLocation",
      ],
      { encoding: "utf8", windowsHide: true, timeout: 15000 },
    ).trim();
    if (location) {
      const resources = path.join(location, "app/resources"),
        names = [
          "codex.exe",
          "codex-code-mode-host.exe",
          "codex-windows-sandbox-setup.exe",
          "codex-command-runner.exe",
        ];
      const files = names.map((name) => ({
        name,
        bytes: readFileSync(path.join(resources, name)),
      }));
      const directory = path.join(
        root(),
        "bin/codex-desktop",
        hash(files.map((f) => `${f.name}:${hash(f.bytes)}`).join("\n")),
      );
      // Store executables must be copied out with their sibling helpers before launch.
      for (const f of files) {
        const dest = path.join(directory, f.name);
        if (!existsSync(dest) || hash(readFileSync(dest)) !== hash(f.bytes))
          saveBytes(dest, f.bytes);
      }
      return (cached = path.join(directory, "codex.exe"));
    }
  }
  return process.platform === "win32" ? "codex.exe" : "codex";
}
