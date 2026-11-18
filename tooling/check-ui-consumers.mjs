import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { walkFiles } from "./ui-paint.mjs";

const root = path.resolve(import.meta.dirname, "..");
const uiDir = path.join(root, "ui");

function stripStringsAndComments(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  const scanTemplate = () => {
    out += "``";
    i++;
    while (i < n) {
      const c = source[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        i++;
        return;
      }
      if (c === "$" && source[i + 1] === "{") {
        out += " ${";
        i += 2;
        let depth = 1;
        while (i < n && depth > 0) {
          const ch = source[i];
          if (ch === "'" || ch === '"') scanQuote(ch);
          else if (ch === "`") scanTemplate();
          else if (ch === "/" && source[i + 1] === "/") skipLineComment();
          else if (ch === "/" && source[i + 1] === "*") skipBlockComment();
          else {
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
            out += ch;
            i++;
          }
        }
        out += " ";
        continue;
      }
      if (c === "\n") out += "\n";
      i++;
    }
  };
  const scanQuote = (q) => {
    out += q + q;
    i++;
    while (i < n) {
      const c = source[i];
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === q) {
        i++;
        return;
      }
      if (c === "\n") out += "\n";
      i++;
    }
  };
  const skipLineComment = () => {
    while (i < n && source[i] !== "\n") i++;
  };
  const skipBlockComment = () => {
    i += 2;
    while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
      if (source[i] === "\n") out += "\n";
      i++;
    }
    i += 2;
  };
  while (i < n) {
    const c = source[i];
    if (c === "'" || c === '"') scanQuote(c);
    else if (c === "`") scanTemplate();
    else if (c === "/" && source[i + 1] === "/") skipLineComment();
    else if (c === "/" && source[i + 1] === "*") skipBlockComment();
    else {
      out += c;
      i++;
    }
  }
  return out;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(candidate) && candidate.startsWith(uiDir)) return candidate;
  }
  return null;
}

function featureOf(file) {
  const rel = path.relative(uiDir, file).split(path.sep).join("/");
  if (rel.startsWith("components/ui/") || rel === "shared/status.tsx")
    return null;
  if (rel.startsWith("task/waterfall/")) return "task/waterfall";
  const parts = rel.split("/");
  if (parts.length >= 2)
    return `${parts[0]}/${parts[1].replace(/\.(tsx|ts)$/, "")}`;
  return rel.replace(/\.(tsx|ts)$/, "");
}

const files = walkFiles(uiDir, /\.(ts|tsx)$/).filter(
  (f) => !f.endsWith(".d.ts") && !f.endsWith(".test.mjs"),
);

const fileExports = new Map();
const exportBodies = new Map();
const importedSymbols = new Map();

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const clean = stripStringsAndComments(raw);
  const exports = [];
  const declRe =
    /^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  const positions = [];
  for (const m of clean.matchAll(declRe)) {
    exports.push(m[1]);
    positions.push({ name: m[1], start: m.index });
  }
  fileExports.set(file, exports);
  const bodies = new Map();
  positions.forEach((pos, idx) => {
    const end = positions[idx + 1]?.start ?? clean.length;
    bodies.set(pos.name, clean.slice(pos.start, end));
  });
  exportBodies.set(file, bodies);

  const imports = [];
  const impRe = /^import\s+(?!type\b)([\s\S]*?)\s+from\s+["']([^"']+)["'];?/gm;
  for (const m of raw.matchAll(impRe)) {
    const target = resolveImport(file, m[2]);
    if (!target) continue;
    const spec = m[1].trim();
    const names = [];
    const braced = /\{([\s\S]*?)\}/.exec(spec);
    if (braced) {
      for (const item of braced[1].split(",")) {
        const cleaned = item.replace(/\btype\s+/, "").trim();
        if (!cleaned) continue;
        const [orig] = cleaned.split(/\s+as\s+/);
        names.push(orig.trim());
      }
    } else if (/^[A-Za-z_$][\w$]*$/.test(spec)) {
      names.push(...(fileExports.get(target) ?? []));
      names.push("__default__");
    }
    imports.push({ target, names });
  }
  importedSymbols.set(file, imports);
}

const sharedLibraries = files.filter((f) => {
  const rel = path.relative(uiDir, f).split(path.sep).join("/");
  return rel.startsWith("components/ui/") || rel === "shared/status.tsx";
});

const reverseEdges = new Map();
const addEdge = (toKey, fromKey) => {
  if (!reverseEdges.has(toKey)) reverseEdges.set(toKey, new Set());
  reverseEdges.get(toKey).add(fromKey);
};

for (const file of files) {
  const rel = path.relative(uiDir, file).split(path.sep).join("/");
  const isShared =
    rel.startsWith("components/ui/") || rel === "shared/status.tsx";
  if (isShared) {
    const bodies = exportBodies.get(file);
    const exps = fileExports.get(file) ?? [];
    for (const [expName, body] of bodies) {
      const fromKey = `${file}#${expName}`;
      for (const local of exps) {
        if (local !== expName && new RegExp(`\\b${local}\\b`).test(body)) {
          addEdge(`${file}#${local}`, fromKey);
        }
      }
      for (const imp of importedSymbols.get(file) ?? []) {
        for (const sym of imp.names) {
          if (sym === "__default__" || new RegExp(`\\b${sym}\\b`).test(body)) {
            const targetKey = `${imp.target}#${sym === "__default__" ? (fileExports.get(imp.target)?.[0] ?? "default") : sym}`;
            addEdge(targetKey, fromKey);
          }
        }
      }
    }
  } else {
    for (const imp of importedSymbols.get(file) ?? []) {
      for (const sym of imp.names) {
        const targetKey = `${imp.target}#${sym === "__default__" ? (fileExports.get(imp.target)?.[0] ?? "default") : sym}`;
        addEdge(targetKey, `${file}#__feature__`);
      }
    }
  }
}

const errors = [];
let checked = 0;
for (const file of sharedLibraries) {
  for (const expName of fileExports.get(file) ?? []) {
    checked++;
    const key = `${file}#${expName}`;
    const queue = [key];
    const seen = new Set(queue);
    const consumers = new Set();
    while (queue.length) {
      const cur = queue.shift();
      for (const prev of reverseEdges.get(cur) ?? []) {
        const prevFile = prev.split("#")[0];
        const feat = featureOf(prevFile);
        if (feat) consumers.add(feat);
        else if (!seen.has(prev)) {
          seen.add(prev);
          queue.push(prev);
        }
      }
    }
    if (consumers.size < 2) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      errors.push(
        `${rel}#${expName} has ${consumers.size} feature module consumers (${[...consumers].join(", ") || "none"})`,
      );
    }
  }
}

if (errors.length) {
  console.error("Single-consumer or dead shared UI exports found:");
  for (const err of errors) console.error(`  ${err}`);
  process.exit(1);
}

console.log(`check-ui-consumers: ok (${checked} shared exports verified)`);
