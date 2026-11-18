import { readFileSync } from "node:fs";
import path from "node:path";
import { deltaE2000, parseHex } from "./token-distance.mjs";
import { walkFiles } from "./ui-paint.mjs";

const root = path.resolve(import.meta.dirname, "..");
const designTokensPath = path.join(root, "design/tokens.css");
const uiTokensPath = path.join(root, "ui/tokens.css");
const allowlist = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "ui-token-allowlist.json"),
    "utf8",
  ),
);
const allowedSmallDiff = new Set((allowlist.entries ?? []).map((e) => e.token));

const VALUE_NAME_RE =
  /--(?:white|black|gray|grey|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|silver|gold)\b/i;

function unwrapHostFallback(value) {
  const m = /^var\(\s*--[\w-]+\s*,\s*([\s\S]+)\)$/.exec(value.trim());
  return m
    ? m[1].replace(/\s+/g, " ").trim()
    : value.replace(/\s+/g, " ").trim();
}

function parseTokenBlocks(css, allowCssProps = false) {
  const headings = [...css.matchAll(/^\s*\/\*\s*([^*]+?)\s*\*\//gm)].map((m) =>
    m[1].trim(),
  );
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [...clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const lightBlock = blocks.find((b) => b[1].trim() === ":root");
  const darkBlock = blocks.find(
    (b) => b[1].trim() === ':root[data-theme="dark"]',
  );
  if (!lightBlock || !darkBlock) {
    throw new Error('Expected :root and :root[data-theme="dark"] blocks');
  }
  const parseDecls = (body) => {
    const map = new Map();
    for (const raw of body.split(";")) {
      const compact = raw.replace(/\s+/g, " ").trim();
      if (!compact) continue;
      const m = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(compact);
      if (m) {
        if (map.has(m[1])) throw new Error(`Duplicate token ${m[1]}`);
        map.set(m[1], m[2].trim());
      } else if (!allowCssProps) {
        throw new Error(`Unexpected declaration in tokens: ${compact}`);
      }
    }
    return map;
  };
  return {
    headings,
    light: parseDecls(lightBlock[2]),
    dark: parseDecls(darkBlock[2]),
  };
}

const designCss = readFileSync(designTokensPath, "utf8");
const uiCss = readFileSync(uiTokensPath, "utf8");
const design = parseTokenBlocks(designCss, false);
const ui = parseTokenBlocks(uiCss, true);

const errors = [];
if (design.headings.length === 0 || ui.headings.length === 0) {
  errors.push(
    "Both design/tokens.css and ui/tokens.css need /* Heading */ section comments.",
  );
}
if (JSON.stringify(design.headings) !== JSON.stringify(ui.headings)) {
  errors.push(
    `Token section headings differ: design=[${design.headings.join(", ")}] ui=[${ui.headings.join(", ")}]`,
  );
}

for (const key of design.light.keys()) {
  if (VALUE_NAME_RE.test(key)) {
    errors.push(`Value-named token forbidden: ${key}`);
  }
  if (!ui.light.has(key)) {
    errors.push(`Token ${key} missing from ui/tokens.css :root`);
  } else {
    const dVal = design.light.get(key).replace(/\s+/g, " ").trim();
    const uVal = unwrapHostFallback(ui.light.get(key));
    if (dVal !== uVal) {
      errors.push(
        `Token ${key} light fallback mismatch: design="${dVal}" ui="${uVal}"`,
      );
    }
  }
}

for (const key of ui.light.keys()) {
  if (!design.light.has(key)) {
    errors.push(
      `Extra or legacy token ${key} in ui/tokens.css not in design/tokens.css`,
    );
  }
}

for (const key of design.dark.keys()) {
  if (!design.light.has(key))
    errors.push(`Dark token ${key} missing in design :root`);
  if (!ui.dark.has(key))
    errors.push(`Dark token ${key} missing in ui/tokens.css`);
  else if (design.dark.get(key) !== unwrapHostFallback(ui.dark.get(key))) {
    errors.push(`Dark token ${key} mismatch between design and ui`);
  }
}
for (const key of ui.dark.keys()) {
  if (!design.dark.has(key))
    errors.push(`Extra dark token ${key} in ui/tokens.css`);
}

// Count actual references outside custom-property declarations.
const uiFiles = walkFiles(path.join(root, "ui"), /\.(css|ts|tsx)$/);
const uiUsage = new Map([...ui.light.keys()].map((k) => [k, 0]));
for (const file of uiFiles) {
  const rel = path.relative(root, file);
  const lines = readFileSync(file, "utf8").split("\n");
  for (const line of lines) {
    if (rel === "ui/tokens.css" && /^\s*--[\w-]+\s*:/.test(line)) continue;
    for (const m of line.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (uiUsage.has(m[1])) {
        uiUsage.set(m[1], uiUsage.get(m[1]) + 1);
      }
    }
  }
}

for (const [key, count] of uiUsage) {
  if (count === 0) errors.push(`Unused token in ui/: ${key}`);
}

const isAlias = (value) => /^var\(--[\w-]+\)$/.test(value.trim());
const resolveThemeColor = (tokens, key, seen = new Set()) => {
  if (seen.has(key)) return null;
  seen.add(key);
  const val = tokens.get(key);
  if (!val) return null;
  if (parseHex(val)) return val;
  const m = /^var\((--[\w-]+)\)$/.exec(val);
  return m ? resolveThemeColor(tokens, m[1], seen) : null;
};

const effectiveDark = new Map([...design.light, ...design.dark]);
const nonAliasPaintKeys = [...design.light.keys()].filter(
  (k) => !isAlias(design.light.get(k)) && parseHex(design.light.get(k)),
);
const allPaintKeys = [...design.light.keys()].filter((k) =>
  resolveThemeColor(design.light, k),
);

for (const a of nonAliasPaintKeys) {
  for (const b of allPaintKeys) {
    if (a === b) continue;
    const deLight = deltaE2000(
      resolveThemeColor(design.light, a),
      resolveThemeColor(design.light, b),
    );
    const deDark = deltaE2000(
      resolveThemeColor(effectiveDark, a),
      resolveThemeColor(effectiveDark, b),
    );
    if (deLight < 5 || deDark < 5) {
      const u = uiUsage.get(a) ?? 0;
      if (u < 3 && !allowedSmallDiff.has(a)) {
        errors.push(
          `Low-use (${u}) paint token ${a} is close to ${b} (dE light=${deLight.toFixed(2)}, dark=${deDark.toFixed(2)}); consolidate or allowlist`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error("UI token policy errors:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(
  `check-ui-tokens: ok (${ui.light.size} declarations, ${allowlist.entries?.length ?? 0} allowlisted exceptions)`,
);
