import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PAINT_PROPS = new Set([
  "color",
  "background",
  "background-color",
  "background-image",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "outline",
  "outline-color",
  "outline-width",
  "box-shadow",
  "text-shadow",
  "fill",
  "stroke",
  "caret-color",
  "accent-color",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
]);

const CAMEL_TO_KEBAB = new Map([
  ["backgroundColor", "background-color"],
  ["backgroundImage", "background-image"],
  ["borderTop", "border-top"],
  ["borderRight", "border-right"],
  ["borderBottom", "border-bottom"],
  ["borderLeft", "border-left"],
  ["borderColor", "border-color"],
  ["borderWidth", "border-width"],
  ["borderRadius", "border-radius"],
  ["outlineColor", "outline-color"],
  ["outlineWidth", "outline-width"],
  ["boxShadow", "box-shadow"],
  ["textShadow", "text-shadow"],
  ["caretColor", "caret-color"],
  ["accentColor", "accent-color"],
  ["fontFamily", "font-family"],
  ["fontSize", "font-size"],
  ["fontWeight", "font-weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
]);

const ALLOWED_KEYWORDS = new Set([
  "none",
  "transparent",
  "inherit",
  "initial",
  "unset",
  "revert",
  "currentcolor",
  "solid",
  "dashed",
  "dotted",
  "double",
  "auto",
]);

export function walkFiles(dir, extRe) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, extRe));
    else if (entry.isFile() && extRe.test(entry.name)) out.push(full);
  }
  return out.sort();
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === "\\" && i + 1 < str.length) i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")" && depth > 0) depth--;
    else if (depth === 0 && ch === sep) {
      parts.push(str.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(str.slice(start));
  return parts;
}

function stripVarCalls(value) {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    if (value.startsWith("var(", i)) {
      let depth = 1;
      i += 4;
      while (i < value.length && depth > 0) {
        if (value[i] === "(") depth++;
        else if (value[i] === ")") depth--;
        i++;
      }
      i--;
      out += " __VAR__ ";
    } else {
      out += value[i];
    }
  }
  return out;
}

export function isPaintAllowed(prop, value) {
  if (!PAINT_PROPS.has(prop)) return true;
  const trimmed = value.trim();
  if (/^-?(?:0|0px)$/.test(trimmed)) return true;
  const cleaned = stripVarCalls(trimmed)
    .replace(/\bcolor-mix\s*\(/gi, " ")
    .replace(/\bin\s+srgb\b/gi, " ")
    .replace(/__VAR__/g, " ")
    .replace(/[(),/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return true;
  for (const part of cleaned.split(" ")) {
    const lower = part.toLowerCase();
    if (!lower) continue;
    if (ALLOWED_KEYWORDS.has(lower)) continue;
    if (/^-?(?:0|0px)$/.test(lower)) continue;
    if (/\bcolor-mix\b/.test(lower)) continue;
    if (/^\d+(?:\.\d+)?%$/.test(lower) && trimmed.includes("color-mix"))
      continue;
    return false;
  }
  return true;
}

export function scanCssPaint(file, root) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const clean = stripComments(readFileSync(file, "utf8"));
  const findings = [];
  const ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
  for (const match of clean.matchAll(ruleRe)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2];
    const bodyOffset = match.index + match[0].indexOf("{") + 1;
    let cursor = 0;
    for (const rawDecl of splitTopLevel(body, ";")) {
      const idx = body.indexOf(rawDecl, cursor);
      cursor = idx + rawDecl.length;
      const colon = rawDecl.indexOf(":");
      if (colon < 0) continue;
      const prop = rawDecl.slice(0, colon).trim().toLowerCase();
      const val = rawDecl.slice(colon + 1).trim();
      if (!val || prop.startsWith("--")) continue;
      if (!isPaintAllowed(prop, val)) {
        const line = clean.slice(0, bodyOffset + idx).split("\n").length;
        findings.push({
          file: rel,
          line,
          selector,
          property: prop,
          value: val,
        });
      }
    }
  }
  return findings;
}

export function scanTsxStylePaint(file, root) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  const source = readFileSync(file, "utf8");
  const findings = [];
  const styleRe = /style=\{\{([\s\S]*?)\}\}/g;
  for (const match of source.matchAll(styleRe)) {
    const body = match[1];
    const baseLine = source.slice(0, match.index).split("\n").length;
    for (const part of splitTopLevel(body, ",")) {
      const colon = part.indexOf(":");
      if (colon < 0) continue;
      const key = part
        .slice(0, colon)
        .trim()
        .replace(/^["']|["']$/g, "");
      const prop = CAMEL_TO_KEBAB.get(key) ?? key;
      const valExpr = part.slice(colon + 1).trim();
      if (!PAINT_PROPS.has(prop)) continue;
      const literalMatch = /^["']([\s\S]*)["']$/.exec(valExpr);
      if (literalMatch && !isPaintAllowed(prop, literalMatch[1])) {
        findings.push({
          file: rel,
          line: baseLine,
          selector: "inline-style",
          property: prop,
          value: literalMatch[1],
        });
      }
      if (/^\d+(?:\.\d+)?$/.test(valExpr) && valExpr !== "0") {
        findings.push({
          file: rel,
          line: baseLine,
          selector: "inline-style",
          property: prop,
          value: valExpr,
        });
      }
    }
  }
  return findings;
}
