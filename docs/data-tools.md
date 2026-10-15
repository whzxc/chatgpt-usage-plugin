# Indexed usage data

Two entry tools provide initial data. Six app-only data tools return `structuredContent` validated against Zod output schemas, without UI resources or entrypoints. Numbers use milliseconds, USD and percentages from 0 to 100. Unknown measurements remain `null`; missing prices do not imply zero cost.

`usage_overview` returns the global entrypoint's complete initial payload in `_meta.usageOverview`: `{ range: "7d", summary, tasks, quota }`. `usage_task` returns the thread entrypoint payload in `_meta.usageTask`, using the exact `usage_thread` schema. The server validates both payloads; model-visible content contains one summary sentence plus structured scope and index state, and the app renders `_meta` without a duplicate mount request.

| Tool            | Input                                                                                                            | Output                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usage_summary` | `range: today / 7d / 30d`                                                                                        | Totals, models with stable 30-day token-ranked slots 1–3 (others 0), time buckets, index progress                                                        |
| `usage_tasks`   | `range`, `sort: recent / cost / tokens`, optional `query`, `page`, optional `pageSize` (default 10, maximum 100) | Total match count, clamped page and task rows                                                                                                            |
| `usage_quota`   | Optional `refresh`                                                                                               | Plan, credit balance, available reset count, windows with elapsed percentage, projected exhaustion and cycle-equivalent USD, status and observation time |
| `usage_thread`  | Optional `threadId`, otherwise request metadata `threadId` / `thread_id`                                         | Thread metadata, totals, current context allocation, request input series, turn boundaries, compactions and turn summaries                               |
| `usage_turn`    | `threadId`, `turnId`, optional `offset` and `limit` (default and maximum 100)                                    | Eight metrics, total row count and one chronological page of request, reply, reasoning and unassociated tool rows                                        |
| `usage_tool`    | `threadId`, `toolId`                                                                                             | Tool metadata; input and output each capped at 16,000 characters, original UTF-8 byte counts and truncation flags                                        |

Today begins at local midnight. Other ranges are rolling 7/30-day windows; daily buckets follow local calendar boundaries, including daylight-saving changes. Task rows include catalogued historical tasks with no usage in the selected range. `requests` counts observed model responses; legacy cumulative deltas contribute tokens and cost but cannot establish a response count. Request sequence positions are one-based, ordered by event time and record ID. Prompt previews, tool previews and narrative summaries are capped at 300, 200 and 400 characters respectively; turn details return the full prompt.

Tools are associated with a request only when there is one reliable model response within the tool emission/result interval and no intervening compaction. Other tools remain separate timeline rows. Narratives and tool bodies are read from indexed JSONL byte ranges; no whole-file reread is required. Large turns are loaded in pages of at most 100 timeline rows.

Tool previews are generated during indexing: shell commands use their first line, stdin writes identify the session, and other calls show the tool name and primary parameter. Static arguments inside code-mode wrappers are parsed without executing code. Tool details show full shell commands or formatted arguments, unwrap text items and nested output envelopes, and expose `exitCode` and recorded execution duration when available. Tool output removes only leading/trailing blank lines, preserving indentation, line endings and blank lines inside the content. Copy actions use the displayed text; byte counts still describe the original payload. Reasoning summaries remove bold markers and separate headings with `；`.

Summary and thread totals include `outputTps`, `ttftMedianMs`, `ttftP90Ms` and `ttftTurns`; thread totals also include `ttftMaxMs`. Output speed uses summed output tokens divided by summed duration for completed/interrupted turns with reliable output and positive duration. Range summaries include only whole turns whose start/end and request timestamps lie within the range. TTFT statistics include turns with a recorded TTFT (including zero); range summaries require both turn boundaries within the range. The median averages the two middle values for even counts; P90 uses nearest rank. SQL computes the ordering and aggregates. Turn summaries also expose `ttftMs` and `outputTps`.

## Storage and refresh

Each process has one worker and a read-only query connection to a shared, CODEX_HOME-specific SQLite WAL database. Schema 5 contains:

- `threads`: identity, session, title, first/last event, latest model/tier, running state, context limit and coverage flags.
- `turns`: composite thread/turn identity, sequence, prompt preview, timing, status and context limit.
- `requests`: composite thread/record identity, turn, sequence, timestamp, model/tier, four token measures, reliability, accounting family, estimated cost and price version. Indexes cover event time, model/time and thread/turn/sequence.
- `compactions`: thread/turn, event identity/time, preceding request sequence and before/after context inputs.
- `tools`: call identity, thread/turn, name/timing, preview, original input/output byte counts and source offsets.
- `content_locations`: typed source intervals for narration and tool input/output.
- `cursors`: file identity, byte cursor and compact incremental parser state, without record projections.
- `context_parts`: current input allocation by category, including individual fixed overhead estimates.

The worker uses the existing parser and merge rules, including legacy deltas and duplicate/conflicting records. It updates relational rows and compact file cursors in one transaction. Schema upgrades drop obsolete projection tables and rebuild disposable indexes. Queries use relational rows directly; only the worker reconstructs parser records when resuming changed files. Files are parsed only when identity, size or modification time changes; older catalogue-only threads are expanded when requested. Title sources are reread only when their file/database/WAL cursor changes.

Costs are calculated during writes. A content-derived price version covers effective rates, aliases and tier multipliers. A changed price file rebuilds pricing; the worker updates all stored request costs and their price version in one transaction. Queries never calculate per-request prices.

Data changes increment the metadata generation in the same write transaction. The process keeps at most 32 tool responses in an LRU keyed by normalized parameters, generation and price version, plus a minute bucket for relative-time views. Initial progress-only responses are not cached; background scans update the progress field without discarding unchanged cached data. Queries trigger scanning at most once per two seconds and return immediately during initial indexing. Quota uses the existing cross-process lease/cache; its committed updates also invalidate responses. Cycle estimates use SQL window sums and retain the existing freshness and coverage restrictions.

Native `.jsonl.zst` archives are not discovered or decompressed by the indexer.

Turn pages contain at most 100 timeline rows and roughly 30 KB of content. `offset` counts timeline rows; use `nextOffset` rather than assuming a full page. `timelineTotal` counts all rows and `requestTotal` counts requests. Turn details also include the full user prompt.

Current context uses the last recorded input total. The writer estimates fixed instructions, skills and environment from log text, infers missing tool definitions from the first request, and apportions input deltas by new message, reasoning, tool-call and tool-result text weights. Compaction resets the dynamic allocation to its replacement history. Largest-remainder rounding preserves the exact observed total. Categories are estimates, not tokenizer output.

Entrypoint tools advertise 20×20 monochrome icons and share one embedded UI resource with a fullscreen display preference. `global` selects navigation; `thread` selects the conversation side panel. Entry input accepts an optional `threadId` (maximum 128 characters); overview always opens the 7-day range. Data inputs are strict: task query is limited to 200 characters, thread/turn IDs to 128 and tool IDs to 256. `page` is required and starts at 1; `offset` defaults to 0. Unknown thread/turn/tool results return a null object and a reason.
