# TSX design record

Status: **approved by the user on 2026-11-06 at design commit `2f983b9`**. Approval covers the original visual baseline of every source and frame listed below. Leo approved governance batches 0 and 1 (ownership, mappings, exceptions, tokens and Button crop) on 2026-11-08. Leo approved batch 2 (all six generic families and three frame renames) on 2026-11-08. Leo approved batch 3 (quota, usage-trend, task-list, context and its rework) on 2026-11-08. Later governance changes have a separate review status in [the asset register](design-assets.md).

[Development](../README.md#development) · [Data contracts](data-tools.md) · [Toolkit contract](https://github.com/whzxc/svg-design-gallery/blob/main/docs/design-toolkit.md) · [Asset rules](https://github.com/whzxc/svg-design-gallery/blob/main/docs/asset-rules.md) · [Asset register](design-assets.md)

## Direction

Quiet Native uses a neutral host canvas, restrained teal emphasis, flat sections and thin dividers. The body is 14px, metadata 12px, headings 20px and major figures 28px. Panels use 24px padding and 24px section spacing; controls use 8px corners, panels 12px and dialogs 16px. Only modal dialogs have elevation. The interface stays inside the ChatGPT MCP panel without adding an application sidebar or window chrome.

The runtime implements this direction with shared React controls and host-bound semantic tokens. The approved TSX sources remain the visual reference.

## Source and capture contract

Use the global `sdg` version 0.5.0 or later. `sdg.config.mjs` starts the isolated design-review server on port 5191, resolves the declared fixtures, and prepares selections through runtime controls. No toolkit dependency is added to this project.

- `design/tokens.css` owns the approved semantic palette and geometry.
- `design/components/` keeps Button, Header, Layout, MetricFigure, Search, SingleChoice, Status and Tooltip. Feature assets remain here until their owning migration batch is reviewed.
- `design/modules/` contains migrated feature owners; the ownership table records the current locations.
- `design/surfaces/` currently contains 6 composition sources. Their local states will move with their owning modules.
- `design/fixtures/quota.ts` owns quota records; `usage-trend.ts`, `task-list.ts` and `context.ts` own their feature projections and specimen inputs.
- `design/fixtures/` is the project owner for representative data and fixture projections. `button.ts` supplies the shared Button actions to the design specimen and runtime review fixture.
- Temporary legacy paths: `design/scenes/usage.ts`, `tool.ts` and `forms.ts` still contain records, projections and state lists. Move each feature's data to `fixtures/` with its owning migration batch; add new fixture data there. `scenes/format.ts` remains a supporting formatting/frame helper, outside the source layers.
- Frames use the 720 CSS pixel review basis and implemented fixtures, with page captures at `720x2400`, origin `0 0`, except content-cropped generic specimens, whose current dimensions and selectors are declared in their Frame props and the asset register. Height follows content. Component and isolated section fixtures capture their specimen region; unchanged legacy specimens retain page-origin captures. Complete panel fixtures render the corresponding composition. The viewport accommodates the longest full-content specimen; it does not prescribe the host panel height.
- The 720px width is the approved review basis, not a claimed ChatGPT default. Runtime width continues to follow `ui/host-size.ts` and the host's `containerDimensions`.
- Fixtures use Chinese product text, a fixed review clock of `2026-11-06T06:32:00Z`, and `Asia/Shanghai` calendar labels. No frame uses the current system clock or a live source.
- Theme selection belongs to the host. The same frame renders light and dark; there are no theme or width matrices.

```sh
sdg check
sdg render
npx --no-install tsc --noEmit -p design/tsconfig.json
```

Renders are written to `output/design/<source>/<frame>-light.png` and `-dark.png`. `output/` and `design/.sdg/` are ignored. Keep each token declaration on one line, including font stacks and shadows, as required by the toolkit parser.

The Button `actions` frame is content-sized, with 4px clearance for its 2px focus outline and 2px outline offset. Its runtime capture selects `[data-design-button-actions]`; both sources use the same action fixture. Button defaults and all composed-panel frames retain the original visual baseline.

## Ownership and review

SDG discovers sources in `components`, `modules`, `surfaces` order. Import-direction checking remains enabled. Fixtures and the formatting/frame helpers are supporting files. This project has no artwork or studies; image dimensions and budgets are currently not applicable.

The selected direction remains Quiet Native, Chinese product copy, light/dark host themes and a 720px review basis. Supported installed targets are macOS Apple Silicon and Windows x64. Review captures run on macOS; platform and host-resize acceptance remain part of runtime acceptance.

| Agreed feature owner | Owned parts | Current source locations under `design/` |
| --- | --- | --- |
| `modules/quota.tsx` | QuotaBar, QuotaSection | `modules/quota.tsx` |
| `modules/usage-trend.tsx` | UsageChart, Legend | `modules/usage-trend.tsx` |
| `modules/task-list.tsx` | TaskList, TaskColumns, TaskRow | `modules/task-list.tsx` |
| `modules/context.tsx` | ContextChart, ContextAllocation, ContextSection | `modules/context.tsx` |
| `modules/turn-summary.tsx` | TurnHeader and expanded loading/failure states | `components/turn-header.tsx`, `surfaces/turn-loading.tsx` |
| `modules/waterfall.tsx` | Minimap, TimeAxis, WaterfallRow, Waterfall | `components/minimap.tsx`, `components/waterfall-row.tsx`, `components/waterfall.tsx` |
| `modules/request-details.tsx` | RequestDetails | `components/request-details.tsx` |
| `modules/tool-dialog.tsx` | ToolBody, ToolDialog | `components/tool-body.tsx`, `components/tool-dialog.tsx` |

Codex proposes and implements each authorized batch, checks the source and reviews both theme renders. Leo reviews the gallery and approves its visual result. The user authorizes batch scope and repository publication. Original visual approval does not close a governance batch. The asset register separates implementation adoption, migration state and pending reviewer decisions.

Batches 0–2 are approved. The currently authorized batch migrates quota, usage-trend, task-list and context, with one local commit per module before Leo's gallery review. Later feature modules, composed surfaces and unused-asset cleanup retain their separate review scope. The turn summary owner remains `turn-summary`, distinct from `surfaces/turn`.

For each batch, update affected imports, captures, gallery entries, fixture routes and asset mappings together. Run `sdg check`, render every affected frame in both themes, compare against the preceding baseline and inspect the result. Keep scope, outstanding gaps and review status in the asset register. Open the gallery with `sdg open design --port=4331`; if occupied, select another free port other than 4310. Pause for Leo before the next authorized batch group. Full runtime comparison and interaction acceptance retain the separate acceptance workflow below.

## Token-to-host mapping

`ui/theme.ts` selects `data-theme` from the MCP host and copies supplied CSS variables onto the root. `ui/tokens.css` implements the bindings below, retaining the runtime aliases used by the charts. Removed host overrides are cleared when the host supplies a replacement variable set. The static design uses concrete light/dark fallback values so checks and review renders are deterministic. Host-provided canvas, text, border, fonts and radii take precedence over local fallbacks.

| Design tokens                                                                  | Host binding / current runtime role                                                                | Implementation binding                                                                                                                                             |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--font-ui`                                                                    | Host `--font-sans`; current `--font`                                                               | Use host family when supplied, otherwise the design system stack.                                                                                                  |
| `--font-mono`                                                                  | Host `--font-mono`; current `--mono`                                                               | Use host family when supplied, otherwise SF Mono / Menlo / Consolas.                                                                                               |
| `--canvas`                                                                     | `--color-background-primary`; `--ground`                                                           | Host primary background, with white / `#212121` fallback.                                                                                                          |
| `--surface`                                                                    | `--color-background-secondary`; `--well`                                                           | Host secondary background, with `#f5f5f5` / `#2b2b2b` fallback.                                                                                                    |
| `--raised`                                                                     | `--raised`, currently primary background in light and a local dark override                        | Keep the existing binding strategy; dark fallback is `#343434`. No unverified elevated-background host variable is assumed.                                        |
| `--text`                                                                       | `--color-text-primary`; `--ink`                                                                    | Primary text; fallback `#202020` / `#eeeeee`.                                                                                                                      |
| `--muted`                                                                      | `--color-text-secondary`; `--ink-2`                                                                | Secondary text; fallback `#666666` / `#b6b6b6`.                                                                                                                    |
| `--subtle`                                                                     | `--color-text-tertiary`; `--ink-3`                                                                 | Tertiary/disabled information; fallback `#757575` / `#a0a0a0`.                                                                                                     |
| `--border`                                                                     | `--color-border-primary`; `--rule`, `--rule-soft`                                                  | One quiet divider family; fallback `#e5e5e5` / `#434343`.                                                                                                          |
| `--accent`, `--focus`                                                          | Local `--accent`; no current host accent binding                                                   | Teal `#277768` / `#81c8b5`; focus has a 2px outline and 2px offset.                                                                                                |
| `--selected`                                                                   | Local `--accent-wash`, `--hover` roles                                                             | `#e6f1ed` / `#29443c`; selection also has structure or focus indication.                                                                                           |
| `--warning`, `--warning-surface`                                               | Local `--warn` plus a new warning surface                                                          | Amber text and soft background; keep quota consequences visible.                                                                                                   |
| `--danger`, `--danger-surface`                                                 | Local `--crit` plus a new error surface                                                            | Red text and soft background; keep explicit errors and retries.                                                                                                    |
| `--disabled`                                                                   | Local control background role                                                                      | Neutral gray; native disabled behavior and accessible state remain required.                                                                                       |
| `--overlay`, `--shadow-dialog`                                                 | Local modal backdrop and `--shadow`                                                                | Theme-specific translucent backdrop and modal-only shadow.                                                                                                         |
| `--model-primary`                                                              | Local `--m1`                                                                                       | Teal, matching the primary model slot.                                                                                                                             |
| `--model-secondary`                                                 | Local `--m2`                                                                                       | Muted lavender; charts consume the semantic model token.                                                                    |
| `--model-other`                                                                | Local `--ink-3` model slot                                                                         | Neutral aggregate for additional models.                                                                                                                           |
| `--tool`, `--tool-text`                                                        | Local tool phase roles                                                                             | Bronze bars; darker light-theme text (`#8a5d2d`) preserves small-label legibility.                                                                                 |
| `--context-messages`, `--context-fixed`                                        | Local context uses of `--ink-3`, `--ink-2`                                                         | Neutral categories, independent of model ranking.                                                                                                                  |
| `--context-compaction`                                                         | Local context use of `--m4`                                                                        | Amber for compaction. Context tool results use `--model-primary`, reasoning uses `--model-secondary`, tool calls use `--tool`; remaining capacity uses `--border`. |
| `--text-meta`, `--text-body`, `--text-title`, `--text-display` | No currently consumed host size variable                                                           | Local 12 / 14 / 20 / 28px scale.                                                                                                                              |
| `--radius-control`, `--radius-panel`, `--radius-dialog`                        | Host `--border-radius-sm`, `--border-radius-md`, `--border-radius-lg`; current `--radius-sm/md/lg` | Host radius when supplied; fallbacks 8 / 12 / 16px.                                                                                                                |
| `--control-height`, `--panel-padding`, `--section-gap`          | Local geometry; no host binding                                                                    | 32 / 24 / 24px.                                                                                                                                               |

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

Task titles, task-row titles and long prompts wrap within their text column; metadata stays together as one compact line where space permits. Numeric columns retain their alignment. A selected chart's inspection card anchors below its selected bucket/point in reserved space, preserving data visibility. Context selection uses a teal ring and a leader ending at the card; compaction uses a separate amber diamond and its before/after label. The context scale labels its midpoint gridline. Inspection cards reserve space below the data and keep the selected point visible.

Copy controls are disabled when their content is unavailable. Tool dialogs have one close control, initial focus on close, modal focus containment, Escape/backdrop dismissal and focus restoration. Long code has its own bounded scroll region. Copy failure stays next to the content and does not masquerade as a tool-fetch failure. Loading/error forms do not display fabricated successful measurements.

## Declared forms

Every name below resolves to an implementation fixture. Captures use viewport `720x2400`; all frames are 720px wide. The running turn captures the `.panel` element at its full natural height, including the final status note. Other frames use page captures. Partial surfaces and component fixtures render at page origin. Themes use the same form. The fixture manifest is `tooling/design-review/fixtures.json`.

| Source                              | Frame                    | Fixture                                   |
| ----------------------------------- | ------------------------ | ----------------------------------------- |
| `components/button.tsx`             | `actions`                | `cup-button-actions`                      |
| `components/header.tsx`             | `long-title`             | `cup-header-long-title`                   |
| `components/header.tsx`             | `refreshing`             | `cup-header-refreshing`                   |
| `components/layout.tsx`             | `panel-shell`                  | `cup-layout-panel-shell`                        |
| `components/metric-figure.tsx`      | `grid-overview`               | `cup-metric-figure-grid-overview`              |
| `components/metric-figure.tsx`      | `grid-unknown`                | `cup-metric-figure-grid-unknown`               |
| `components/minimap.tsx`            | `selected-range`         | `cup-minimap-selected-range`              |
| `components/minimap.tsx`            | `loading-target`         | `cup-minimap-loading-target`              |
| `components/request-details.tsx`    | `narrative`              | `cup-request-details-narrative`           |
| `components/search.tsx`             | `field`                  | `cup-search-field`                        |
| `components/single-choice.tsx`      | `selection`              | `cup-single-choice-selection`             |
| `components/status.tsx`             | `feedback`               | `cup-status-feedback`                     |
| `components/tool-body.tsx`          | `truncated`              | `cup-tool-body-truncated`                 |
| `components/tool-dialog.tsx`        | `ready`                  | `cup-tool-dialog-ready`                   |
| `components/tooltip.tsx`            | `bucket`                 | `cup-tooltip-bucket`                      |
| `components/turn-header.tsx`        | `states`                 | `cup-turn-header-states`                  |
| `components/waterfall-row.tsx`      | `branches`               | `cup-waterfall-row-branches`              |
| `components/waterfall-row.tsx`      | `unknown`                | `cup-waterfall-row-unknown`               |
| `components/waterfall.tsx`          | `completed`              | `cup-waterfall-completed`                 |
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
| `modules/quota.tsx` | `bar-windows` | `cup-quota-bar-windows` |
| `modules/quota.tsx` | `section-credits-and-exhaustion` | `cup-quota-section-credits-and-exhaustion` |
| `modules/usage-trend.tsx` | `chart-tokens` | `cup-usage-trend-chart-tokens` |
| `modules/usage-trend.tsx` | `chart-selected` | `cup-usage-trend-chart-selected` |
| `modules/usage-trend.tsx` | `legend-models` | `cup-usage-trend-legend-models` |
| `modules/usage-trend.tsx` | `chart-hourly-cost` | `cup-usage-trend-chart-hourly-cost` |
| `modules/usage-trend.tsx` | `chart-single-model` | `cup-usage-trend-chart-single-model` |
| `modules/task-list.tsx` | `list-search-empty` | `cup-task-list-list-search-empty` |
| `modules/task-list.tsx` | `row-selection-long` | `cup-task-list-row-selection-long` |
| `modules/task-list.tsx` | `list-selected` | `cup-task-list-list-selected` |
| `modules/context.tsx` | `chart-selected-compaction` | `cup-context-chart-selected-compaction` |
| `modules/context.tsx` | `chart-missing-measurements` | `cup-context-chart-missing-measurements` |
| `modules/context.tsx` | `chart-unknown-capacity` | `cup-context-chart-unknown-capacity` |
| `modules/context.tsx` | `allocation-estimated` | `cup-context-allocation-estimated` |
| `modules/context.tsx` | `allocation-unknown-capacity` | `cup-context-allocation-unknown-capacity` |

Context states belong to their parts: chart selection, missing measurements and unknown capacity; allocation estimates and unknown capacity. `ContextSection` forwards explicit `selected`, `gaps` and `unknownLimit` props with false defaults. It emits the two parts without a layout node, so the task surface owns their spacing and there is no standalone section frame.

## Approval scope

The library contains 15 component sources, 4 module sources and 6 surface sources, with 67 declared frames. The module and surface forms cover entry initialization; overview and quota; task search and selection; task summaries and empty/failure/stale forms; context, compaction and unknown capacity; turn loading, waterfall execution states, paging and narrative detail; and tool dialogs.

Changes relative to the selected specimen retain the palette, type scale and flat chrome while deriving all displayed metrics from records, distinguishing model/tool density in the minimap, wrapping long text, anchoring chart inspection below data, and adding semantic feedback and modal treatment. Only the dialog receives a shadow. Header repetition is removed when turn metrics are already expanded.

The user approved all 22 component sources, 10 surface sources and 69 frames on 2026-11-06 at commit `2f983b9`. Runtime pointer, keyboard, focus and host resize behavior belongs to the React implementation.

## Runtime and compare adapter

Shared buttons, headers, sections, figures, search, tooltips, single choices and Lucide icons live in `ui/components/ui/`. Surface controllers keep their polling, navigation and data-tool contracts. Request details sit after the selected request's visible children; Escape and the close action restore the request's focus. The native tool dialog contains focus, restores its opener and disables copying unavailable text. Stale refreshes preserve the last complete view with a single retry notice.

```sh
npm run dev:design
# http://127.0.0.1:5191/__design/review?fixture=cup-overview-ready
sdg compare surfaces/overview.tsx --frame=ready
# Acceptance owns the complete sweep:
sdg compare --all
CUP_REVIEW_THEME=dark sdg compare --all
```

`startDesignDev` in `tooling/design-dev.mjs` starts Vite without the backend. The dev-only `/__design/review` entry renders production React components. Its Vite resolver replaces only the panel bridge with `tooling/design-review/bridge.ts`; the fixture projections in `data.ts` convert the fictional design scene records to the production tool types. The fixture manifest contains the 67 names in the declared-forms table and the interaction fixture `cup-waterfall-scroll`. `npm run check` includes the fixture projections and compositions.

For viewport-following interaction review, open `/__design/review?fixture=cup-waterfall-scroll`. It repeats the fictional turn records with distinct IDs and timestamps across six minutes in a 480px scroll container. Scroll through the calls or navigate with the minimap; the visible range and selection window follow the visible rows. With the system's reduced-motion preference enabled, range changes apply immediately without interpolation. This fixture has no additional design frame and is excluded from the packaged plugin with the other review data.

The adapter fixes the clock to `2026-11-06T06:32:00Z`, the locale to `zh-CN` and the timezone to `Asia/Shanghai`. It waits for the fixture-ready marker, fails on a fixture error, and prepares chart inspection, refresh failure, narrative loading, dialog copy failure and keyboard focus through runtime controls. Live API and external HTTPS requests are blocked. Both themes use the same fixtures; `CUP_REVIEW_THEME=dark` selects the dark capture.

The production build starts at `ui/app/main.tsx`; it has no import of the review entry, fixture bridge or design scenes. Packaging copies the generated UI/backend and plugin assets, leaving `tooling/design-review/` and `design/` outside the installed plugin.

## Reachability and drift

All declared forms have runtime fixture compositions; no frame is intentionally unbound. Migrated generic specimens capture their exported runtime parts with 4px clearance; legacy section fixtures retain page-origin captures. The empty task frame represents direct entry; an empty task reached from the overview retains its back action. Native dialogs remain modal and viewport-bounded, with the approved 40px inset at the review width.

`cup-turn-partial` uses the runtime's padded visible-row time range (0–24.96s for its loaded prefix), while the static frame labels 0–24s. Its summary and minimap still cover the complete 45s turn. This timing-range drift preserves the existing scroll-following behavior and is visible in the compare review.

Request titles come from the indexed reasoning summary, falling back to the request number. The fictional bridge provides matching summaries for the approved request titles; full narrative text is loaded separately. Real tasks retain their recorded summaries. The unknown-start turn fixture explicitly opens its second branch through the keyboard, and the running turn fixture folds its first branch to match the approved static forms. Runtime default folding still follows measured duration, failure and running state.

Full-library visual comparison and interaction acceptance run in the separate acceptance thread before push or release.
