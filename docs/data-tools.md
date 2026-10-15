# Indexed usage data

The three panel tools retain their existing snapshots. Six app-only data tools return `structuredContent` validated against Zod output schemas, without UI resources or entrypoints. Numbers use milliseconds, USD and percentages from 0 to 100. Unknown measurements remain `null`; missing prices do not imply zero cost.

| Tool | Input | Output |
| --- | --- | --- |
| `usage_summary` | `range: today / 7d / 30d` | Totals, models with stable 30-day token-ranked slots 1–3 (others 0), time buckets, index progress |
| `usage_tasks` | `range`, `sort: recent / cost / tokens`, optional `query`, `page`, optional `pageSize` (default 10, maximum 100) | Total match count, clamped page and task rows |
| `usage_quota` | Optional `refresh` | Plan, credit balance, available reset count, windows with elapsed percentage, projected exhaustion and cycle-equivalent USD, status and observation time |
| `usage_thread` | Optional `threadId`, otherwise request metadata `threadId` / `thread_id` | Thread metadata, totals, request input series, turn boundaries, compactions and turn summaries |
| `usage_turn` | `threadId`, `turnId` | Eight metrics and chronological request, reply, reasoning and unassociated tool rows |
| `usage_tool` | `threadId`, `toolId` | Tool metadata; input and output each capped at 16,000 characters, original UTF-8 byte counts and truncation flags |

Today begins at local midnight. Other ranges are rolling 7/30-day windows; daily buckets follow local calendar boundaries, including daylight-saving changes. Task rows include catalogued historical tasks with no usage in the selected range, matching the panel snapshot. `requests` counts observed model responses; legacy cumulative deltas contribute tokens and cost but cannot establish a response count. Request sequence positions are one-based, ordered by event time and record ID. Prompt, tool preview and narrative summaries are capped at 300, 200 and 400 characters respectively.

Tools are associated with a request only when there is one reliable model response within the tool emission/result interval and no intervening compaction. Other tools remain separate timeline rows. Narratives and tool bodies are read from indexed JSONL byte ranges; no whole-file reread is required. Large turns return their complete timeline and can exceed typical payload sizes.

Summary and thread totals include `outputTps`, `ttftMedianMs`, `ttftP90Ms` and `ttftTurns`; thread totals also include `ttftMaxMs`. Output speed uses summed output tokens divided by summed duration for completed/interrupted turns with reliable output and positive duration, matching `wholeTurnOutputTps`. Range summaries include only whole turns whose start/end and request timestamps lie within the range. TTFT statistics include turns with a recorded TTFT (including zero); range summaries require both turn boundaries within the range. The median averages the two middle values for even counts; P90 uses nearest rank. SQL computes the ordering and aggregates. Turn summaries also expose `ttftMs` and `outputTps`.

## Storage and refresh

Each process has one worker and a read-only query connection to a shared, CODEX_HOME-specific SQLite WAL database. Schema 3 contains:

- `threads`: identity, session, title, first/last event, latest model/tier, running state, context limit and coverage flags.
- `turns`: composite thread/turn identity, sequence, prompt preview, timing, status and context limit.
- `requests`: composite thread/record identity, turn, sequence, timestamp, model/tier, four token measures, reliability, accounting family, estimated cost and price version. Indexes cover event time, model/time and thread/turn/sequence.
- `compactions`: thread/turn, event identity/time, preceding request sequence and before/after context inputs.
- `tools`: call identity, thread/turn, name/timing, preview, original input/output byte counts and source offsets.
- `content_locations`: typed source intervals for narration and tool input/output.

The worker uses the existing parser and merge rules, including legacy deltas and duplicate/conflicting records. It updates relational rows and the existing projection/cursor tables in one transaction. Schema changes rebuild disposable indexes. Files are parsed only when identity, size or modification time changes; older catalogue-only threads are expanded when requested. Title sources are reread only when their file/database/WAL cursor changes.

Costs are calculated during writes. A content-derived price version covers effective rates, aliases and tier multipliers. A changed price file rebuilds pricing; the worker updates all stored request costs and their price version in one transaction. Queries never calculate per-request prices.

Data changes increment the metadata generation in the same write transaction. The process keeps at most 32 tool responses in an LRU keyed by normalized parameters, generation and price version, plus a minute bucket for relative-time views. Initial progress-only responses are not cached; background scans update the progress field without discarding unchanged cached data. Queries trigger scanning at most once per two seconds and return immediately during initial indexing. Quota uses the existing cross-process lease/cache; its committed updates also invalidate responses. Cycle estimates use SQL window sums and retain the existing freshness and coverage restrictions.

The previous panel projection remains available. Its memory and query costs are incurred when a legacy panel tool is used. Native `.jsonl.zst` archives are not discovered or decompressed by the indexer.
