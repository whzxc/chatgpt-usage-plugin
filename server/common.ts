import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  chmodSync,
  writeFileSync,
  renameSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
// External log formats are owned by Codex. Narrow fields as they enter projections.
export type Json = Record<string, any>;
export const version = __PLUGIN_VERSION__;
declare const __PLUGIN_VERSION__: string;
export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const codexHome = () =>
  process.env.CODEX_HOME || path.join(homedir(), ".codex");
export const root = () =>
  process.env.CHATGPT_USAGE_STATE_DIR ||
  path.join(
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || path.join(homedir(), "AppData/Local")
      : path.join(homedir(), ".local/state"),
    "chatgpt-usage-plugin",
  );
export const text = (v: Json | undefined | null, key: string): string | null =>
  typeof v?.[key] === "string" && v[key] ? v[key] : null;
export const time = (v: unknown): number | null =>
  typeof v === "string" && Number.isFinite(Date.parse(v))
    ? Date.parse(v)
    : null;
export const uint = (v: unknown): number | null =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
export const seconds = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v * 1000) : null;
export const sortedValues = <T>(map: Record<string, T>): T[] =>
  Object.keys(map)
    .sort()
    .map((key) => map[key]);
export const emptyMap = <T>(): Record<string, T> => Object.create(null);
const protectedDirs = new Set<string>();
export function privateDir(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32" && !protectedDirs.has(dir)) {
    chmodSync(dir, 0o700);
    protectedDirs.add(dir);
  }
  if (process.platform === "win32" && !protectedDirs.has(dir)) {
    const output = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const sid = output.trim().split(",").at(-1)?.replaceAll('"', "") ?? "";
    if (!/^S-1-\d+(?:-\d+)+$/.test(sid))
      throw new Error("Cannot identify local account");
    execFileSync(
      "icacls.exe",
      [dir, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`],
      { windowsHide: true, stdio: "pipe" },
    );
    protectedDirs.add(dir);
  }
}
export function saveBytes(file: string, data: string | Uint8Array) {
  privateDir(path.dirname(file));
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, data, { mode: 0o600 });
    renameSync(temp, file);
  } finally {
    try {
      unlinkSync(temp);
    } catch {}
  }
}
export function load(file: string): Json {
  return JSON.parse(readFileSync(file, "utf8"));
}
export const save = (file: string, value: unknown) =>
  saveBytes(file, JSON.stringify(value));
export function stableJson(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`)
    .join(",")}}`;
}
export const localDay = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const rangeStart = (days: number, end = Date.now()) =>
  days === 1 ? new Date(end).setHours(0, 0, 0, 0) : end - days * 86400000;
