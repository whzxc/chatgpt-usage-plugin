import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const uiDir = path.join(root, "ui");
const configPath = path.join(uiDir, "tsconfig.json");
const config = ts.getParsedCommandLineOfConfigFile(
  configPath,
  {},
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic(diagnostic) {
      throw new Error(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    },
  },
);
const program = ts.createProgram(config.fileNames, config.options);
const checker = program.getTypeChecker();
const sources = config.fileNames
  .map((file) => program.getSourceFile(file))
  .filter((source) => source && !source.isDeclarationFile);

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

const sharedExports = new Map();
for (const source of sources) {
  if (featureOf(source.fileName)) continue;
  const module = checker.getSymbolAtLocation(source);
  if (!module) continue;
  for (const symbol of checker.getExportsOfModule(module)) {
    const declaration = symbol.valueDeclaration;
    if (declaration?.getSourceFile() === source) {
      sharedExports.set(symbol, declaration);
    }
  }
}

const reverseEdges = new Map();
function recordReferences(node, consumer) {
  if (
    ts.isImportDeclaration(node) ||
    ts.isExportDeclaration(node) ||
    ts.isTypeNode(node)
  )
    return;
  if (ts.isIdentifier(node) && !ts.isDeclarationName(node)) {
    let symbol = ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    if (sharedExports.has(symbol) && symbol !== consumer) {
      if (!reverseEdges.has(symbol)) reverseEdges.set(symbol, new Set());
      reverseEdges.get(symbol).add(consumer);
    }
  }
  ts.forEachChild(node, (child) => recordReferences(child, consumer));
}

for (const source of sources) {
  const feature = featureOf(source.fileName);
  if (feature) recordReferences(source, feature);
}
for (const [symbol, declaration] of sharedExports) {
  recordReferences(declaration, symbol);
}

const errors = [];
for (const [symbol, declaration] of sharedExports) {
  const queue = [symbol];
  const seen = new Set(queue);
  const consumers = new Set();
  while (queue.length) {
    const cur = queue.shift();
    for (const prev of reverseEdges.get(cur) ?? []) {
      if (typeof prev === "string") consumers.add(prev);
      else if (!seen.has(prev)) {
        seen.add(prev);
        queue.push(prev);
      }
    }
  }
  if (consumers.size < 2) {
    const rel = path
      .relative(root, declaration.getSourceFile().fileName)
      .split(path.sep)
      .join("/");
    errors.push(
      `${rel}#${symbol.name} has ${consumers.size} feature module consumers (${[...consumers].join(", ") || "none"})`,
    );
  }
}

if (errors.length) {
  console.error("Single-consumer or dead shared UI exports found:");
  for (const err of errors) console.error(`  ${err}`);
  process.exit(1);
}

console.log(
  `check-ui-consumers: ok (${sharedExports.size} shared exports verified)`,
);
