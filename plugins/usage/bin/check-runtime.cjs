// Host internals are not a public API. Reject an incompatible runtime explicitly.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 24 || minor < 19) {
  console.error(
    `Usage requires host Node 24.19+ within the 24.x line; found ${process.versions.node}.`,
  );
  process.exit(1);
}
try {
  require("node:sqlite").DatabaseSync;
  require("node:worker_threads").Worker;
  if (typeof fetch !== "function") throw new Error("fetch unavailable");
} catch (error) {
  console.error(`Usage host runtime is incomplete: ${error.message}`);
  process.exit(1);
}
