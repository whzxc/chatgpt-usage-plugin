# Design asset register

[Design direction and review](design.md) · [SDG asset rules](https://github.com/whzxc/svg-design-gallery/blob/main/docs/asset-rules.md)

## State and ownership

The 22 component sources, 10 surface sources and 69 frames have an approved visual baseline at `2f983b9` (2026-11-06). Leo has confirmed the adoption audit and the feature boundaries in `design.md`. All 22 component sources have a composed surface consumer. The runtime mappings below identify implementation adoption; gallery presence alone is not an adoption claim.

The minimum toolkit version is 0.5.0. Default discovery is `components → modules → surfaces`; import-direction lint is enabled. Current feature sources still live in `components/`. The module paths in `design.md` identify their agreed owners and pending migrations, not existing files.

| Batch scope | Implementation state | Leo review state |
| --- | --- | --- |
| Ownership, mapping and source metadata | Documented; no source moves, frame renames or visual changes | Approved 2026-11-08 by Leo |
| Tokens and Button | Implemented: shared fixture, content crop and equivalent Panel token bindings | Approved 2026-11-08 by Leo |
| Batch 2: SingleChoice, Search, Layout/MetricFigure, Header, Status, Tooltip | Implemented: fixtures, part names and 4px specimen clearance | Leo gallery review pending |
| Eight feature owners | Migration pending; original visual baseline retained | Per-batch review pending |
| Composed surfaces and final lifecycle cleanup | Pending dependency review | Per-surface review pending |

## Part mappings and consumers

Paths in the source column are relative to `design/`. Consumer names refer to defining parts in this table or to surfaces below. Arrows identify transitive consumers. Named functions are implementation anchors; CSS anchors identify layout parts without a standalone runtime export.

| Current source | Part | Direct design consumers / surface reach | Runtime implementation |
| --- | --- | --- | --- |
| `components/button.tsx` | Button | Header, Minimap, RequestDetails, Status, TaskList, ToolBody, ToolDialog, Waterfall → entry, overview, task-list, task, tool-dialog, turn-loading, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): Button |
| `components/header.tsx` | Header | overview, task, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): Header |
| `components/layout.tsx` | Panel | Other Panel-based component specimens; context, entry, overview, quota, task-list, task, turn-loading, turn, usage-trend | [`controls.tsx`](../ui/components/ui/controls.tsx): Panel; production overview/task containers use [`layout.css`](../ui/shared/layout.css) |
| `components/layout.tsx` | Stack | Waterfall and task → turn; specimen layouts for Search, SingleChoice, Status, QuotaBar, TurnHeader and WaterfallRow | [`layout.css`](../ui/shared/layout.css): `.stack` and feature flex containers |
| `components/layout.tsx` | Grid | Legend, MetricGrid, QuotaSection, RequestDetails → overview, quota, usage-trend, task, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): MetricGrid; [`overview.tsx`](../ui/overview/overview.tsx): quota/legend grids; [`waterfall.tsx`](../ui/task/waterfall.tsx): request fact grid |
| `components/layout.tsx` | Section | ContextChart, ContextAllocation, QuotaSection, TaskList, UsageChart, Waterfall; overview, task → context, quota, task-list, usage-trend, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): Section |
| `components/metric-figure.tsx` | MetricFigure | MetricGrid → overview, task, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): MetricGrid's `.figure` markup |
| `components/metric-figure.tsx` | MetricGrid | Waterfall, overview, task | [`controls.tsx`](../ui/components/ui/controls.tsx): MetricGrid; [`overview.tsx`](../ui/overview/overview.tsx): Figures; [`task.tsx`](../ui/task/task.tsx): TaskSummary; [`waterfall-head.tsx`](../ui/task/waterfall-head.tsx): WaterfallHead |
| `components/search.tsx` | Search | TaskList → overview, task-list | [`controls.tsx`](../ui/components/ui/controls.tsx): Search |
| `components/single-choice.tsx` | SingleChoice | TaskList, UsageChart, overview → task-list, usage-trend | [`SingleChoice.tsx`](../ui/components/ui/SingleChoice.tsx): SingleChoice |
| `components/status.tsx` | Status | RequestDetails, TaskList, ToolDialog, Waterfall, entry, overview, task, turn-loading → task-list, tool-dialog, turn | [`status.tsx`](../ui/shared/status.tsx): Status, Indexing, Failure |
| `components/tooltip.tsx` | Tooltip | ContextChart, UsageChart → context, overview, task, usage-trend | [`controls.tsx`](../ui/components/ui/controls.tsx): Tooltip |
| `components/legend.tsx` | Legend | UsageChart → overview, usage-trend | [`overview.tsx`](../ui/overview/overview.tsx): ModelLegend |
| `components/usage-chart.tsx` | UsageChart | overview, usage-trend | [`overview.tsx`](../ui/overview/overview.tsx): UsageChart |
| `components/quota-bar.tsx` | QuotaBar | QuotaSection → overview, quota | [`overview.tsx`](../ui/overview/overview.tsx): QuotaBar |
| `components/quota-bar.tsx` | QuotaSection | overview, quota | [`overview.tsx`](../ui/overview/overview.tsx): QuotaBlock |
| `components/task-list.tsx` | TaskList | overview, task-list | [`overview.tsx`](../ui/overview/overview.tsx): TaskTable |
| `components/task-row.tsx` | TaskColumns | TaskList and row specimen → overview, task-list | [`overview.tsx`](../ui/overview/overview.tsx): TaskColumns |
| `components/task-row.tsx` | TaskRow | TaskList → overview, task-list | [`overview.tsx`](../ui/overview/overview.tsx): TaskRow |
| `components/context-chart.tsx` | ContextChart | context, task | [`context-chart.tsx`](../ui/task/context-chart.tsx): ContextChart |
| `components/context-allocation.tsx` | ContextAllocation | context, task | [`task.tsx`](../ui/task/task.tsx): CurrentContext |
| `components/turn-header.tsx` | TurnHeader | Waterfall, task, turn-loading → turn | [`turn.tsx`](../ui/task/turn.tsx): TurnHeader |
| `surfaces/turn-loading.tsx` | Expanded loading/failure composition | Gallery region entry; TurnHeader + Status | [`turn.tsx`](../ui/task/turn.tsx): TurnRow |
| `components/minimap.tsx` | Minimap | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): Minimap |
| `components/waterfall-row.tsx` | TimeAxis | Waterfall and row specimen → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): `.wf-heading` tick markup |
| `components/waterfall-row.tsx` | WaterfallRow | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): TraceRow |
| `components/request-details.tsx` | RequestDetails | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): RequestDetailsPanel, NoteDetails |
| `components/waterfall.tsx` | Waterfall | turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): Waterfall; [`waterfall-head.tsx`](../ui/task/waterfall-head.tsx): WaterfallHead |
| `components/tool-body.tsx` | ToolBody | ToolDialog → tool-dialog | [`tool-dialog.tsx`](../ui/task/tool-dialog.tsx): ToolBody |
| `components/tool-dialog.tsx` | ToolDialog | tool-dialog | [`tool-dialog.tsx`](../ui/task/tool-dialog.tsx): ToolDialog |

`trendTip`, `stateLabel` and the `longOutput` re-export are support values rather than independent visual assets. `trendTip` lives in `fixtures/tooltip.ts`; the longOutput re-export remains pending fixture cleanup. Shared Lucide geometry is provided by SDG's Icon and the runtime [`Icons.tsx`](../ui/components/ui/Icons.tsx) wrapper.

## Surface mappings and declared states

The exact frame-to-fixture identifiers remain in [Declared forms](design.md#declared-forms). Every surface is a gallery entry; none is imported by another design source. Local-only frames move with their feature owner before redundant wrappers are removed.

| Source under `design/surfaces/` | Frames | Composition / runtime consumer | Governance state |
| --- | --- | --- | --- |
| `entry.tsx` | loading, failure | Panel + Status / [`root.tsx`](../ui/app/root.tsx) | Pending composition review |
| `overview.tsx` | ready, indexing, unavailable, empty, stale, refreshing, unpriced, quota-unavailable | Header, quota, figures, usage trend, task list / [`overview.tsx`](../ui/overview/overview.tsx) | Pending dependency and surface review |
| `quota.tsx` | credits-and-exhaustion | QuotaSection / QuotaBlock | Local states pending quota migration |
| `task-list.tsx` | selected, search-empty | TaskList / TaskTable | Local states and duplicate empty specimen pending migration |
| `usage-trend.tsx` | hourly-cost, single-model | UsageChart / UsageChart | Local states pending trend migration |
| `task.tsx` | ready, empty, indexing, unavailable, stale, long-title | Header, metrics, context, turn summaries / [`task.tsx`](../ui/task/task.tsx) | Pending dependency and surface review |
| `context.tsx` | selected-compaction, missing-measurements, unknown-capacity | ContextChart + ContextAllocation / ContextChart + CurrentContext | Local states pending context migration |
| `turn-loading.tsx` | pending, failure | TurnHeader + Status / TurnRow | Pending turn-summary migration |
| `turn.tsx` | completed, running, failed, unknown, partial, request-detail, narrative-loading, narrative-error | Header + Waterfall / production Waterfall through review WaterfallFixture | Pending dependency and surface review |
| `tool-dialog.tsx` | ready, loading, error, long, failed, copy-error, unknown | ToolDialog / production ToolDialog | Local states and duplicate ready specimen pending migration |

## Fixtures, captures and evidence

`design/fixtures/` owns this project's representative data and fixture projections. The temporary legacy locations are [`scenes/usage.ts`](../design/scenes/usage.ts) for calls, turns, histories, quota records and projections, plus [`scenes/context.ts`](../design/scenes/context.ts), [`chart.ts`](../design/scenes/chart.ts), [`tool.ts`](../design/scenes/tool.ts) and [`forms.ts`](../design/scenes/forms.ts) for their projections and state lists. Migrate these records into `fixtures/` with each feature's owning batch; new fixture data goes into `fixtures/`. [`scenes/format.ts`](../design/scenes/format.ts) remains a supporting formatting/frame helper outside the source layers.

[`tooling/design-review/main.tsx`](../tooling/design-review/main.tsx) composes the mapped production parts; [`data.ts`](../tooling/design-review/data.ts) projects the same fictional records into production types; [`bridge.ts`](../tooling/design-review/bridge.ts) serves them. The manifest [`fixtures.json`](../tooling/design-review/fixtures.json) includes all 69 frame fixtures and `cup-waterfall-scroll`.

[`fixtures/button.ts`](../design/fixtures/button.ts) supplies the same five actions to the design and runtime Button specimens. The `components/button.tsx` / `actions` identity and `cup-button-actions` route are unchanged, so the existing gallery and fixture manifests retain their entries. The specimen capture selects `[data-design-button-actions]` and fits the content with 4px focus clearance.

The baseline captures are page captures at `720x2400`, origin `0 0`; frame width is 720 CSS pixels and height follows content. Both themes use the same `zh-CN` content, fixed clock `2026-11-06T06:32:00Z` and `Asia/Shanghai` labels. The Button actions capture is content-sized; other component crop changes remain with their owning batch. Current renders are reachable in `output/design/components/<source>/<frame>-{light,dark}.png` and `output/design/surfaces/<source>/<frame>-{light,dark}.png`. Local before/after comparisons are retained under ignored `output/design-governance/`; these files are not part of the installed plugin.

Leo approved batches 0 and 1, including the Button content crop, on 2026-11-08. The original approval is recorded in `design.md`. Batch 2 and later migrations still require Leo's gallery review; batches 0 and 1 are approved. Render availability, a passing check and implementation adoption are recorded separately.

## Token disposition

Panel padding and section spacing now consume `--panel-padding` and `--section-gap`. The original Tailwind `p-6`/`gap-6` resolve as `6 × 0.25rem = 24px` in the SDG document, matching both token values. Runtime Panel styles already consume those tokens.

`--other`, `--on-accent`, `--success`, `--icon-size` and `--text-small` were removed from both token files after checking their CSS variable uses and generated utility names across design sources, runtime UI and the review adapter. They had declarations only, with no consumers. `ui/theme.ts` forwards host variables without reading these roles. `--model-other` remains: `ui/overview/overview.tsx` uses it for additional model slots.

## Fidelity and policy exceptions

| Item | Current behavior and disposition |
| --- | --- |
| `surfaces/turn.tsx` / partial | Static axis: 0–24s. `cup-turn-partial` runtime visible prefix: 0–24.96s from padded row bounds. Summary and minimap cover the complete 45s. Preserve the runtime scroll-following behavior; retain this explicit fidelity item for the waterfall/surface review. |
| `cup-waterfall-scroll` | Retained interaction-only fixture: six fictional minutes in a 480px scroll container, shared by viewport-following, minimap navigation and reduced-motion review. No additional design frame; excluded from packaged assets with the other review fixtures. |
| Existing feature placement | Feature assets temporarily remain in components until their agreed module batch. No import-lint opt-out; each move includes all importers. |
| Legacy fixture locations | Data in `scenes/usage.ts`, `context.ts`, `chart.ts`, `tool.ts` and `forms.ts` moves to its `fixtures/` owner with the corresponding feature batch. This temporary location ends when those moves close; `scenes/` is not a fixture destination. |
| Existing frame names and full-width specimens | Retained until their owner is reviewed. Multi-part prefixes, duplicate local surface states and specimen crops remain explicit migration work. |
| Runtime structure | Empty task direct entry omits a back action; overview navigation retains it. Tool dialogs keep the approved 40px review inset and native viewport bounds. Unknown-start and running review fixtures prepare the approved branch folding through keyboard controls. |
| Artwork and studies | No image assets or studies exist. Display dimensions and image budgets are not applicable to the current inventory. |

## Remaining work

- Migrate the eight agreed feature owners and their local states; keep generic assets in components.
- Extract remaining embedded representative content, remove the fixture re-export and give generic assets neutral data interfaces.
- Resolve multi-part frame prefixes and remaining source lines over 140 characters with their owners.
- Review component crops and preserve real layout constraints for charts and lists.
- Move fixture projections out of surfaces, then review each retained surface against its mapped implementation.
- Remove duplicate wrappers and assets without consumers when their batch closes; synchronize the declared forms and fixture routes.
- Obtain Leo's gallery approval for each batch. Full runtime comparison, interactions and platform acceptance follow `design.md` before publication.

## single-choice family

The single-choice specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. SingleChoice uses intrinsic content width. Governance state: implemented, awaiting Leo gallery review.

## search family

The search specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: implemented, awaiting Leo gallery review.

## layout-metrics family

The layout, metric-figure specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment; the Panel specimen retains its own 24px padding inside the 4px clearance. Governance state: implemented, awaiting Leo gallery review.

- Frame route: `cup-layout-shell` → `cup-layout-panel-shell`.

- Frame route: `cup-metric-figure-overview` → `cup-metric-figure-grid-overview`.

- Frame route: `cup-metric-figure-unknown` → `cup-metric-figure-grid-unknown`.

## header family

The header specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: implemented, awaiting Leo gallery review.

## status family

The status specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: implemented, awaiting Leo gallery review.

## tooltip family

The tooltip specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: implemented, awaiting Leo gallery review.

Visual proposal, pending a separate review: narrower Search, Header, metric, Status and Tooltip specimens may change wrapping or alignment. Their original content widths remain constraints for this structural batch.
