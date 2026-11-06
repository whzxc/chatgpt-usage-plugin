# TSX design record

Status: **proposal pending user approval**.

[Development](../README.md#development) · [Data contracts](data-tools.md) · [Toolkit contract](https://github.com/whzxc/svg-design-gallery/blob/main/docs/design-toolkit.md)

## Direction

Quiet Native uses a neutral host canvas, restrained teal emphasis, flat sections and thin dividers. The body is 14px, metadata 12px, headings 20px and major figures 28px. Panels use 24px padding and 24px section spacing; controls use 8px corners, panels 12px and dialogs 16px. Only modal dialogs have elevation. The interface stays inside the ChatGPT MCP panel without adding an application sidebar or window chrome.

The user selected this direction. Approval of the complete library is pending. These sources propose presentation; the existing React UI remains the current implementation.

## Source and capture contract

Use the global `sdg` version 0.4.3 or later. `sdg.config.mjs` deliberately has no compare adapter. The implementation segment supplies the reserved fixtures, route preparation, ready conditions and selectors. No toolkit dependency is added to this project.

- `design/tokens.css` owns the proposal's semantic palette and geometry.
- `design/components/` exports parameterized presentation functions and component specimens.
- `design/surfaces/` composes components without duplicating their markup.
- `design/scenes/usage.ts`, `context.ts`, `chart.ts` and `tool.ts` own fictional records and calculated projections. `forms.ts` declares surface presentations; `format.ts` owns formatting and frame metadata.
- Every frame is 720 CSS pixels wide, with a reserved fixture and a page capture at `720x2400`, origin `0 0`. Height follows content. Component and isolated section fixtures render only that specimen at the page origin. Complete panel fixtures render the corresponding composition. The viewport accommodates the longest full-content specimen; it does not prescribe the host panel height.
- The 720px width is the approved review basis, not a claimed ChatGPT default. Runtime width continues to follow `ui/host-size.ts` and the host's `containerDimensions`.
- Fixtures use Chinese product text, a fixed review clock of `2026-11-06T06:32:00Z`, and `Asia/Shanghai` calendar labels. No frame uses the current system clock or a live source.
- Theme selection belongs to the host. The same frame renders light and dark; there are no theme or width matrices.

```sh
sdg check
sdg render
npx --no-install tsc --noEmit -p design/tsconfig.json
```

Renders are written to `output/design/<source>/<frame>-light.png` and `-dark.png`. `output/` and `design/.sdg/` are ignored. Keep each token declaration on one line, including font stacks and shadows, as required by the toolkit parser.

## Token-to-host mapping

`ui/theme.ts` selects `data-theme` from the MCP host and copies supplied CSS variables onto the root. `ui/tokens.css` currently binds those variables to runtime aliases. The table describes the intended implementation binding; it does not modify the runtime sheet. The static design uses concrete light/dark fallback values so checks and review renders are deterministic. Preserve host-provided canvas, text and border values when integrating the approved design.

| Design tokens                                                                  | Host binding / current runtime role                                                                | Proposal rule                                                                                                                                                      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--font-ui`                                                                    | Host `--font-sans`; current `--font`                                                               | Use host family when supplied, otherwise the design system stack.                                                                                                  |
| `--font-mono`                                                                  | Host `--font-mono`; current `--mono`                                                               | Use host family when supplied, otherwise SF Mono / Menlo / Consolas.                                                                                               |
| `--canvas`                                                                     | `--color-background-primary`; `--ground`                                                           | Host primary background, with white / `#212121` fallback.                                                                                                          |
| `--surface`                                                                    | `--color-background-secondary`; `--well`                                                           | Host secondary background, with `#f5f5f5` / `#2b2b2b` fallback.                                                                                                    |
| `--raised`                                                                     | `--raised`, currently primary background in light and a local dark override                        | Keep the existing binding strategy; proposal dark fallback is `#343434`. No unverified elevated-background host variable is assumed.                               |
| `--text`                                                                       | `--color-text-primary`; `--ink`                                                                    | Primary text; fallback `#202020` / `#eeeeee`.                                                                                                                      |
| `--muted`                                                                      | `--color-text-secondary`; `--ink-2`                                                                | Secondary text; fallback `#666666` / `#b6b6b6`.                                                                                                                    |
| `--subtle`                                                                     | `--color-text-tertiary`; `--ink-3`                                                                 | Tertiary/disabled information; fallback `#757575` / `#a0a0a0`.                                                                                                     |
| `--border`                                                                     | `--color-border-primary`; `--rule`, `--rule-soft`                                                  | One quiet divider family; fallback `#e5e5e5` / `#434343`.                                                                                                          |
| `--accent`, `--focus`                                                          | Local `--accent`; no current host accent binding                                                   | Teal `#277768` / `#81c8b5`; focus has a 2px outline and 2px offset.                                                                                                |
| `--selected`                                                                   | Local `--accent-wash`, `--hover` roles                                                             | `#e6f1ed` / `#29443c`; selection also has structure or focus indication.                                                                                           |
| `--on-accent`                                                                  | No existing host binding                                                                           | White / dark canvas foreground for filled accent controls.                                                                                                         |
| `--success`                                                                    | Local semantic role                                                                                | Teal, accompanied by a status label.                                                                                                                               |
| `--warning`, `--warning-surface`                                               | Local `--warn` plus a new warning surface                                                          | Amber text and soft background; keep quota consequences visible.                                                                                                   |
| `--danger`, `--danger-surface`                                                 | Local `--crit` plus a new error surface                                                            | Red text and soft background; keep explicit errors and retries.                                                                                                    |
| `--disabled`                                                                   | Local control background role                                                                      | Neutral gray; native disabled behavior and accessible state remain required.                                                                                       |
| `--overlay`, `--shadow-dialog`                                                 | Local modal backdrop and `--shadow`                                                                | Theme-specific translucent backdrop and modal-only shadow.                                                                                                         |
| `--model-primary`                                                              | Local `--m1`                                                                                       | Teal, matching the primary model slot.                                                                                                                             |
| `--other`, `--model-secondary`                                                 | Local `--m2`                                                                                       | Muted lavender. `--other` retains the direction token; charts consume the semantic model token.                                                                    |
| `--model-other`                                                                | Local `--ink-3` model slot                                                                         | Neutral aggregate for additional models.                                                                                                                           |
| `--tool`, `--tool-text`                                                        | Local tool phase roles                                                                             | Bronze bars; darker light-theme text (`#8a5d2d`) preserves small-label legibility.                                                                                 |
| `--context-messages`, `--context-fixed`                                        | Local context uses of `--ink-3`, `--ink-2`                                                         | Neutral categories, independent of model ranking.                                                                                                                  |
| `--context-compaction`                                                         | Local context use of `--m4`                                                                        | Amber for compaction. Context tool results use `--model-primary`, reasoning uses `--model-secondary`, tool calls use `--tool`; remaining capacity uses `--border`. |
| `--text-meta`, `--text-small`, `--text-body`, `--text-title`, `--text-display` | No currently consumed host size variable                                                           | Local 12 / 13 / 14 / 20 / 28px scale.                                                                                                                              |
| `--radius-control`, `--radius-panel`, `--radius-dialog`                        | Host `--border-radius-sm`, `--border-radius-md`, `--border-radius-lg`; current `--radius-sm/md/lg` | Host radius when supplied; proposal fallbacks 8 / 12 / 16px.                                                                                                       |
| `--control-height`, `--icon-size`, `--panel-padding`, `--section-gap`          | Local geometry; no host binding                                                                    | 32 / 16 / 24 / 24px.                                                                                                                                               |

## Data semantics

All task names, commands, results, dates, prices and measurements are fictional. The model price table is fixture input, not a current price claim. No credential, private path or real task content belongs in a scene.

The call records are the source of truth. `totals` derives token sums, request/tool counts, failure counts, cost and cache share. Day buckets, model legends, task rows and summary metrics aggregate the same history. The primary task's four turns also produce its context curve and current context allocation. Surface variants transform those records before computing their displays.

- Token totals are input plus output. Cached input is a subset of input; reasoning output is a subset of output. K/M use decimal magnitudes. Token axis ticks omit trailing fractional zeros; measured values retain their declared precision. Display rounding can make rounded subtotals differ slightly; raw totals remain consistent.
- Costs are USD estimates calculated from uncached input, cached input and output rates. Unknown measurements and unavailable pricing remain `null` and display `—`; no missing value is converted into a measured zero. The unpriced form has unknown usage fields as well as missing pricing.
- Request counts count observed model responses. Tool calls are separate records. Running unrecorded model requests have no invented bar.
- TPS uses completed/interrupted turn output divided by turn duration. Running and failed turns have no completion TPS. TTFT is a turn measurement; median, P90 and P99 come from recorded turn TTFT values, never per-request durations.
- A model bar uses an inferred start and may include waiting. Tool bars use recorded starts and ends. A missing start has no bar. The whole-turn minimap bins the exact call starts; when a start is unknown it uses that call's recorded event time. Each call contributes once, separated into model and tool counts. Empty bins have zero height. The viewport box, cursor and slowest marker derive from the same time domain.
- `partial` renders a prefix of calls, but the summary and minimap cover the whole turn. The remaining request count is calculated from hidden model records. Folded parents preserve their child time extent and start marks.
- Context points are request input tokens, not accumulated usage. Missing measurements break the line. Compaction marks the before/after request boundary. The latest input is apportioned using fixture category weights; the raw category sum exactly equals that observed input. Percentages use capacity when known; unknown capacity displays `—` and no invented remaining amount.
- Account quota is an independent fixture feed. Remaining quota is `100 - usedPercent`; the marker is remaining cycle time. Credits and available resets are independent account values. These cannot establish per-task billing or quota consumption from local tokens.
- Tool text preserves interior whitespace. The display is capped at 16,000 characters; byte counts use the original UTF-8 text. Copy targets the displayed text. Unknown bodies and measurements remain unknown.
- Today uses hourly buckets; the 7/30-day modes use local calendar buckets. The hourly specimen uses the same final-day calls as the daily chart. A single-model specimen omits the multi-model legend.

## Behavior and composition

Keep the shared React/Radix ownership rules in [AGENTS.md](../AGENTS.md). Runtime single selections use `SingleChoice`; the static counterpart declares the same choice semantics. Arrow keys move through choices, focus is visible, and disabled controls are not interactive. Shared icons use the Lucide wrapper.

Overview navigation preserves filters and scroll position on return. Task rows are keyboard reachable. A task opened from the overview has a back action; a direct thread entry omits it. The header keeps refresh and its observation time together. Pending refresh stays in place; failed refresh preserves known data with one explicit stale notice and a retry.

Model rows and their tool children form contiguous groups. Request details follow the last visible child, with a shared accent rail and a request-number/title heading tying them to the selected model row. The waterfall remains a keyboard tree: Up/Down/Home/End move, Left/Right collapse and expand, Enter opens details, and Escape closes details with focus restored. Default branches remain collapsed except running/failed/slowest or materially time-consuming branches. Static forms show representative branches, not event handlers. The minimap remains keyboard operable and disables navigation while its target loads. The waterfall viewport follows visible rows while the minimap retains the whole-turn domain; sticky chrome must not obscure a label's only copy. Reduced motion avoids animated range transitions.

Task titles, task-row titles and long prompts wrap within their text column; metadata stays together as one compact line where space permits. Numeric columns retain their alignment. A selected chart's inspection card anchors below its selected bucket/point in reserved space, preserving data visibility. Context selection uses a teal ring and a leader ending at the card; compaction uses a separate amber diamond and its before/after label. The context scale labels its midpoint gridline. These are deliberate proposal differences from single-line truncation and floating tooltips.

Copy controls are disabled when their content is unavailable. Tool dialogs have one close control, initial focus on close, modal focus containment, Escape/backdrop dismissal and focus restoration. Long code has its own bounded scroll region. Copy failure stays next to the content and does not masquerade as a tool-fetch failure. Loading/error forms do not display fabricated successful measurements.

## Declared forms

Every name below reserves an implementation fixture. All captures are page captures with viewport `720x2400`; all frames are 720px wide. Partial surfaces and component fixtures render at page origin. Themes use the same form. The compare adapter is added only in the implementation segment.

| Source                              | Frame                    | Fixture                                   |
| ----------------------------------- | ------------------------ | ----------------------------------------- |
| `components/button.tsx`             | `actions`                | `cup-button-actions`                      |
| `components/context-allocation.tsx` | `estimated`              | `cup-context-allocation-estimated`        |
| `components/context-allocation.tsx` | `unknown-capacity`       | `cup-context-allocation-unknown-capacity` |
| `components/context-chart.tsx`      | `selected-compaction`    | `cup-context-chart-selected-compaction`   |
| `components/header.tsx`             | `long-title`             | `cup-header-long-title`                   |
| `components/header.tsx`             | `refreshing`             | `cup-header-refreshing`                   |
| `components/layout.tsx`             | `shell`                  | `cup-layout-shell`                        |
| `components/legend.tsx`             | `models`                 | `cup-legend-models`                       |
| `components/metric-figure.tsx`      | `overview`               | `cup-metric-figure-overview`              |
| `components/metric-figure.tsx`      | `unknown`                | `cup-metric-figure-unknown`               |
| `components/minimap.tsx`            | `selected-range`         | `cup-minimap-selected-range`              |
| `components/minimap.tsx`            | `loading-target`         | `cup-minimap-loading-target`              |
| `components/quota-bar.tsx`          | `windows`                | `cup-quota-bar-windows`                   |
| `components/request-details.tsx`    | `narrative`              | `cup-request-details-narrative`           |
| `components/search.tsx`             | `field`                  | `cup-search-field`                        |
| `components/single-choice.tsx`      | `selection`              | `cup-single-choice-selection`             |
| `components/status.tsx`             | `feedback`               | `cup-status-feedback`                     |
| `components/task-list.tsx`          | `search-empty`           | `cup-task-list-search-empty`              |
| `components/task-row.tsx`           | `selection-long`         | `cup-task-row-selection-long`             |
| `components/tool-body.tsx`          | `truncated`              | `cup-tool-body-truncated`                 |
| `components/tool-dialog.tsx`        | `ready`                  | `cup-tool-dialog-ready`                   |
| `components/tooltip.tsx`            | `bucket`                 | `cup-tooltip-bucket`                      |
| `components/turn-header.tsx`        | `states`                 | `cup-turn-header-states`                  |
| `components/usage-chart.tsx`        | `tokens`                 | `cup-usage-chart-tokens`                  |
| `components/usage-chart.tsx`        | `selected`               | `cup-usage-chart-selected`                |
| `components/waterfall-row.tsx`      | `branches`               | `cup-waterfall-row-branches`              |
| `components/waterfall-row.tsx`      | `unknown`                | `cup-waterfall-row-unknown`               |
| `components/waterfall.tsx`          | `completed`              | `cup-waterfall-completed`                 |
| `surfaces/context.tsx`              | `selected-compaction`    | `cup-context-selected-compaction`         |
| `surfaces/context.tsx`              | `missing-measurements`   | `cup-context-missing-measurements`        |
| `surfaces/context.tsx`              | `unknown-capacity`       | `cup-context-unknown-capacity`            |
| `surfaces/entry.tsx`                | `loading`                | `cup-entry-loading`                       |
| `surfaces/entry.tsx`                | `failure`                | `cup-entry-failure`                       |
| `surfaces/overview.tsx`             | `ready`                  | `cup-overview-ready`                      |
| `surfaces/overview.tsx`             | `indexing`               | `cup-overview-indexing`                   |
| `surfaces/overview.tsx`             | `unavailable`            | `cup-overview-unavailable`                |
| `surfaces/overview.tsx`             | `empty`                  | `cup-overview-empty`                      |
| `surfaces/overview.tsx`             | `stale`                  | `cup-overview-stale`                      |
| `surfaces/overview.tsx`             | `refreshing`             | `cup-overview-refreshing`                 |
| `surfaces/overview.tsx`             | `unpriced`               | `cup-overview-unpriced`                   |
| `surfaces/overview.tsx`             | `quota-unavailable`      | `cup-overview-quota-unavailable`          |
| `surfaces/quota.tsx`                | `credits-and-exhaustion` | `cup-quota-credits-and-exhaustion`        |
| `surfaces/task-list.tsx`            | `selected`               | `cup-task-list-surface-selected`          |
| `surfaces/task-list.tsx`            | `search-empty`           | `cup-task-list-surface-search-empty`      |
| `surfaces/task.tsx`                 | `ready`                  | `cup-task-ready`                          |
| `surfaces/task.tsx`                 | `empty`                  | `cup-task-empty`                          |
| `surfaces/task.tsx`                 | `indexing`               | `cup-task-indexing`                       |
| `surfaces/task.tsx`                 | `unavailable`            | `cup-task-unavailable`                    |
| `surfaces/task.tsx`                 | `stale`                  | `cup-task-stale`                          |
| `surfaces/task.tsx`                 | `long-title`             | `cup-task-long-title`                     |
| `surfaces/tool-dialog.tsx`          | `ready`                  | `cup-tool-dialog-surface-ready`           |
| `surfaces/tool-dialog.tsx`          | `loading`                | `cup-tool-dialog-surface-loading`         |
| `surfaces/tool-dialog.tsx`          | `error`                  | `cup-tool-dialog-surface-error`           |
| `surfaces/tool-dialog.tsx`          | `long`                   | `cup-tool-dialog-surface-long`            |
| `surfaces/tool-dialog.tsx`          | `failed`                 | `cup-tool-dialog-surface-failed`          |
| `surfaces/tool-dialog.tsx`          | `copy-error`             | `cup-tool-dialog-surface-copy-error`      |
| `surfaces/tool-dialog.tsx`          | `unknown`                | `cup-tool-dialog-surface-unknown`         |
| `surfaces/turn-loading.tsx`         | `pending`                | `cup-turn-loading-pending`                |
| `surfaces/turn-loading.tsx`         | `failure`                | `cup-turn-loading-failure`                |
| `surfaces/turn.tsx`                 | `completed`              | `cup-turn-completed`                      |
| `surfaces/turn.tsx`                 | `running`                | `cup-turn-running`                        |
| `surfaces/turn.tsx`                 | `failed`                 | `cup-turn-failed`                         |
| `surfaces/turn.tsx`                 | `unknown`                | `cup-turn-unknown`                        |
| `surfaces/turn.tsx`                 | `partial`                | `cup-turn-partial`                        |
| `surfaces/turn.tsx`                 | `request-detail`         | `cup-turn-request-detail`                 |
| `surfaces/turn.tsx`                 | `narrative-loading`      | `cup-turn-narrative-loading`              |
| `surfaces/turn.tsx`                 | `narrative-error`        | `cup-turn-narrative-error`                |
| `surfaces/usage-trend.tsx`          | `hourly-cost`            | `cup-usage-trend-hourly-cost`             |
| `surfaces/usage-trend.tsx`          | `single-model`           | `cup-usage-trend-single-model`            |

## Approval scope

The library contains 22 component sources and 10 surface sources, with 69 declared frames. The surface forms cover entry initialization; overview and quota; task search and selection; task summaries and empty/failure/stale forms; context, compaction and unknown capacity; turn loading, waterfall execution states, paging and narrative detail; and tool dialogs.

Changes relative to the selected specimen retain the palette, type scale and flat chrome while deriving all displayed metrics from records, distinguishing model/tool density in the minimap, wrapping long text, anchoring chart inspection below data, and adding semantic feedback and modal treatment. Only the dialog receives a shadow. Header repetition is removed when turn metrics are already expanded.

User approval is required for the complete library before UI implementation. The implementation segment must resolve the reserved fixtures against the real data contracts, bind host tokens, replace current visual rules within their owning components, and add the compare adapter. Static sources do not implement pointer, keyboard, focus or host resize behavior.
