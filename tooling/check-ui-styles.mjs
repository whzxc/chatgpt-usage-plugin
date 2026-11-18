import { readFileSync } from "node:fs";
import path from "node:path";
import { scanCssPaint, scanTsxStylePaint, walkFiles } from "./ui-paint.mjs";

const root = path.resolve(import.meta.dirname, "..");
const uiDir = path.join(root, "ui");
const allowlist = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "ui-style-allowlist.json"),
    "utf8",
  ),
);
const allowed = new Set(
  (allowlist.entries ?? []).map((e) => `${e.file}:${e.property}:${e.value}`),
);

const findings = [];
for (const file of walkFiles(uiDir, /\.css$/)) {
  if (path.relative(root, file) === "ui/tokens.css") continue;
  findings.push(...scanCssPaint(file, root));
}
for (const file of walkFiles(uiDir, /\.tsx$/)) {
  findings.push(...scanTsxStylePaint(file, root));
}

const unallowlisted = findings.filter(
  (f) => !allowed.has(`${f.file}:${f.property}:${f.value}`),
);

if (unallowlisted.length) {
  console.error("Literal UI style violations found:");
  for (const f of unallowlisted) {
    console.error(
      `  ${f.file}:${f.line} [${f.selector}] ${f.property}: ${f.value}`,
    );
  }
  process.exit(1);
}

console.log(`check-ui-styles: ok (${findings.length} allowlisted exceptions)`);
