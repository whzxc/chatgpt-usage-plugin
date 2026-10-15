# Release notes

## 0.2.3 — P1–P5

- **P1 — Shared indexing:** one index worker per MCP process, CODEX_HOME-isolated SQLite WAL storage and cross-process scan leases. Quota uses a shared five-minute cache; cycle-equivalent cost is aggregated on the server.
- **P2 — View-specific data:** normalized relational rows, SQL aggregation and generation-keyed responses. Two entry tools provide initial panel data; six app-only tools serve summary, tasks, quota, thread, turn and tool details with output schemas.
- **P3 — Overview:** account quota and cycle progress, six summary metrics, model charts and searchable/sortable tasks. Filters and scroll position survive navigation back from a task.
- **P4 — Task view:** four summary metrics, per-request context chart, estimated current context allocation, expandable turns, paginated timelines and tool input/output dialogs. Shared host-themed UI preserves keyboard interaction and focus restoration; hidden panels stop polling. Removed the old refresh tool, projection-table double writes, old UI and heavy chart/theme/animation dependencies. The embedded panel uses compressed JavaScript without remote scripts.
- **P5 — Packaging:** portable root plugin/MCP manifests with vendored offline schema validation, deterministic cross-platform gzip headers, retained legacy manifests pending host acceptance, 20×20 monochrome entrypoint icons and explicit fullscreen resource preference. Thread entrypoints open in the conversation side panel. Installation, privacy, runtime, distribution and data contracts are documented. Tool output trims boundary blank lines while retaining interior whitespace and copy behavior.

Costs use API price estimates. Context categories are estimates whose sum matches the last observed input. Original logs, tasks and login files remain read-only; the plugin writes only its own caches. Native `.jsonl.zst` archives are not supported. Windows installed-host acceptance and portable-only manifest loading remain unverified.
