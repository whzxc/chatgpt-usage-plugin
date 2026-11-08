# Design asset register

[Design direction and review](design.md) · [SDG asset rules](https://github.com/whzxc/svg-design-gallery/blob/main/docs/asset-rules.md)

## State and ownership

The original 22 component sources, 10 surface sources and 69 frames have an approved visual baseline at `2f983b9` (2026-11-06). Leo has confirmed the adoption audit and the feature boundaries in `design.md`. Every adopted part listed below has a composed surface or mapped runtime consumer. The runtime mappings below identify implementation adoption; gallery presence alone is not an adoption claim.

The minimum toolkit version is 0.5.0. Default discovery is `components → modules → surfaces`; import-direction lint is enabled. Feature owners migrate from components into modules as recorded below. Unmigrated owner paths remain planned locations.

| Batch scope | Implementation state | Leo review state |
| --- | --- | --- |
| Ownership, mapping and source metadata | Documented; no source moves, frame renames or visual changes | Approved 2026-11-08 by Leo |
| Tokens and Button | Implemented: shared fixture, content crop and equivalent Panel token bindings | Approved 2026-11-08 by Leo |
| Batch 2: SingleChoice, Search, Layout/MetricFigure, Header, Status, Tooltip | Implemented: fixtures, part names and 4px specimen clearance | Approved 2026-11-08 by Leo |
| Batch 3: quota, usage-trend, task-list, context | Implemented, including context interface and frame rework | Approved 2026-11-08 by Leo |
| Batches 4–5: waterfall, turn-summary, request-details, tool-dialog | Implemented: part states and explicit props | Approved 2026-11-08 by Leo |
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
| `components/search.tsx` | Search | TaskList → overview; module specimens | [`controls.tsx`](../ui/components/ui/controls.tsx): Search |
| `components/single-choice.tsx` | SingleChoice | TaskList, UsageChart, overview → task-list, usage-trend | [`SingleChoice.tsx`](../ui/components/ui/SingleChoice.tsx): SingleChoice |
| `components/status.tsx` | Status | RequestDetails, TaskList, ToolDialog, Waterfall, entry, overview, task, turn-loading → task-list, tool-dialog, turn | [`status.tsx`](../ui/shared/status.tsx): Status, Indexing, Failure |
| `components/tooltip.tsx` | Tooltip | ContextChart, UsageChart → context, overview, task, usage-trend | [`controls.tsx`](../ui/components/ui/controls.tsx): Tooltip |
| `modules/usage-trend.tsx` | Legend | UsageChart → overview; usage-trend module specimens | [`overview.tsx`](../ui/overview/overview.tsx): ModelLegend |
| `modules/usage-trend.tsx` | UsageChart | overview; usage-trend module specimens | [`overview.tsx`](../ui/overview/overview.tsx): UsageChart |
| `modules/quota.tsx` | QuotaBar | QuotaSection → overview; quota module specimens | [`overview.tsx`](../ui/overview/overview.tsx): QuotaBar |
| `modules/quota.tsx` | QuotaSection | overview; quota module specimens | [`overview.tsx`](../ui/overview/overview.tsx): QuotaBlock |
| `modules/task-list.tsx` | TaskList | overview; module specimens | [`overview.tsx`](../ui/overview/overview.tsx): TaskTable |
| `modules/task-list.tsx` | TaskColumns | TaskList and row specimen → overview, task-list | [`overview.tsx`](../ui/overview/overview.tsx): TaskColumns |
| `modules/task-list.tsx` | TaskRow | TaskList → overview; module specimens | [`overview.tsx`](../ui/overview/overview.tsx): TaskRow |
| `modules/context.tsx` | ContextChart | ContextSection → task; module specimens | [`context-chart.tsx`](../ui/task/context-chart.tsx): ContextChart |
| `modules/context.tsx` | ContextAllocation | ContextSection → task; module specimens | [`task.tsx`](../ui/task/task.tsx): CurrentContext |
| `modules/turn-summary.tsx` | TurnHeader | Waterfall, task, turn-loading → turn | [`turn.tsx`](../ui/task/turn.tsx): TurnHeader |
| `surfaces/turn-loading.tsx` | Expanded loading/failure composition | Gallery region entry; TurnHeader + Status | [`turn.tsx`](../ui/task/turn.tsx): TurnRow |
| `modules/waterfall.tsx` | Minimap | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): Minimap |
| `modules/waterfall.tsx` | TimeAxis | Waterfall and row specimen → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): `.wf-heading` tick markup |
| `modules/waterfall.tsx` | WaterfallRow | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): TraceRow |
| `modules/request-details.tsx` | RequestDetails | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): RequestDetailsPanel, NoteDetails |
| `modules/waterfall.tsx` | Waterfall | turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): Waterfall; [`waterfall-head.tsx`](../ui/task/waterfall-head.tsx): WaterfallHead |
| `modules/tool-dialog.tsx` | ToolBody | ToolDialog → tool-dialog | [`tool-dialog.tsx`](../ui/task/tool-dialog.tsx): ToolBody |
| `modules/tool-dialog.tsx` | ToolDialog | tool-dialog | [`tool-dialog.tsx`](../ui/task/tool-dialog.tsx): ToolDialog |

`ContextSection` in `modules/context.tsx` composes ContextChart and ContextAllocation with explicit `selected`, `gaps` and `unknownLimit` props, all false by default. `surfaces/task.tsx` consumes it. Its runtime mapping is ContextChart + CurrentContext in the task page. It emits no layout node; the task surface owns the gap between parts, so no standalone section frame is declared. Chart capture fixtures mount ContextChart alone through ContextChartFixture; allocation fixtures mount CurrentContext.

`trendTip`, `stateLabel` and `longOutput` are support values rather than independent visual assets. `trendTip` lives in `fixtures/tooltip.ts`; `longOutput` lives in `fixtures/tool-dialog.ts` and is imported directly. Shared Lucide geometry is provided by SDG's Icon and the runtime [`Icons.tsx`](../ui/components/ui/Icons.tsx) wrapper.

## Surface mappings and declared states

The exact frame-to-fixture identifiers remain in [Declared forms](design.md#declared-forms). Every surface is a gallery entry; none is imported by another design source. Local-only frames move with their feature owner before redundant wrappers are removed.

| Source under `design/surfaces/` | Frames | Composition / runtime consumer | Governance state |
| --- | --- | --- | --- |
| `entry.tsx` | loading, failure | Panel + Status / [`root.tsx`](../ui/app/root.tsx) | Pending composition review |
| `overview.tsx` | ready, indexing, unavailable, empty, stale, refreshing, unpriced, quota-unavailable | Header, quota, figures, usage trend, task list / [`overview.tsx`](../ui/overview/overview.tsx) | Pending dependency and surface review |
| `task.tsx` | ready, empty, indexing, unavailable, stale, long-title | Header, metrics, context, turn summaries / [`task.tsx`](../ui/task/task.tsx) | Pending dependency and surface review |
| `turn-loading.tsx` | pending, failure | TurnHeader + Status / TurnRow | Pending turn-summary migration |
| `turn.tsx` | completed, running, failed, unknown, partial, request-detail, narrative-loading, narrative-error | Header + Waterfall / production Waterfall through review WaterfallFixture | Pending dependency and surface review |
| `tool-dialog.tsx` | ready, loading, error, long, failed, copy-error, unknown | ToolDialog / production ToolDialog | Local states and duplicate ready specimen pending migration |

## Fixtures, captures and evidence

`design/fixtures/` owns this project's representative data and fixture projections. Feature fixtures now live in `fixtures/quota.ts`, `usage-trend.ts`, `task-list.ts` and `context.ts`. The temporary legacy locations are [`scenes/usage.ts`](../design/scenes/usage.ts) for shared calls, turns, histories and projections, [`fixtures/tool-dialog.ts`](../design/fixtures/tool-dialog.ts) and [`forms.ts`](../design/scenes/forms.ts) for remaining tool/turn content and states. Migrate these records into `fixtures/` with each feature's owning batch; new fixture data goes into `fixtures/`. [`scenes/format.ts`](../design/scenes/format.ts) remains a supporting formatting/frame helper outside the source layers.

[`tooling/design-review/main.tsx`](../tooling/design-review/main.tsx) composes the mapped production parts; [`data.ts`](../tooling/design-review/data.ts) projects the same fictional records into production types; [`bridge.ts`](../tooling/design-review/bridge.ts) serves them. The manifest [`fixtures.json`](../tooling/design-review/fixtures.json) includes all 85 frame fixtures and `cup-waterfall-scroll`.

[`fixtures/button.ts`](../design/fixtures/button.ts) supplies the same five actions to the design and runtime Button specimens. The `components/button.tsx` / `actions` identity and `cup-button-actions` route are unchanged, so the existing gallery and fixture manifests retain their entries. The specimen capture selects `[data-design-button-actions]` and fits the content with 4px focus clearance.

The baseline captures are page captures at `720x2400`, origin `0 0`; frame width is 720 CSS pixels and height follows content. Both themes use the same `zh-CN` content, fixed clock `2026-11-06T06:32:00Z` and `Asia/Shanghai` labels. The Button actions capture is content-sized; other component crop changes remain with their owning batch. Current renders are reachable in `output/design/components/<source>/<frame>-{light,dark}.png` and `output/design/surfaces/<source>/<frame>-{light,dark}.png`. Local before/after comparisons are retained under ignored `output/design-governance/`; these files are not part of the installed plugin.

Leo approved batches 0 and 1, including the Button content crop, on 2026-11-08. The original approval is recorded in `design.md`. Leo approved batch 2 (all six families and the three frame renames) on 2026-11-08. Later migrations still require gallery review; batches 0, 1 and 2 are approved. Render availability, a passing check and implementation adoption are recorded separately.

## Token disposition

Panel padding and section spacing now consume `--panel-padding` and `--section-gap`. The original Tailwind `p-6`/`gap-6` resolve as `6 × 0.25rem = 24px` in the SDG document, matching both token values. Runtime Panel styles already consume those tokens.

`--other`, `--on-accent`, `--success`, `--icon-size` and `--text-small` were removed from both token files after checking their CSS variable uses and generated utility names across design sources, runtime UI and the review adapter. They had declarations only, with no consumers. `ui/theme.ts` forwards host variables without reading these roles. `--model-other` remains: `ui/overview/overview.tsx` uses it for additional model slots.

## Fidelity and policy exceptions

| Item | Current behavior and disposition |
| --- | --- |
| `surfaces/turn.tsx` / partial | Static axis: 0–24s. `cup-turn-partial` runtime visible prefix: 0–24.96s from padded row bounds. Summary and minimap cover the complete 45s. Preserve the runtime scroll-following behavior; retain this explicit fidelity item for the waterfall/surface review. |
| `cup-waterfall-scroll` | Retained interaction-only fixture: six fictional minutes in a 480px scroll container, shared by viewport-following, minimap navigation and reduced-motion review. No additional design frame; excluded from packaged assets with the other review fixtures. |
| Legacy fixture locations | Remaining data in `scenes/usage.ts`, `tool.ts` and `forms.ts` moves to its `fixtures/` owner with the corresponding feature batch. This temporary location ends when those moves close; `scenes/` is not a fixture destination. |
| Existing frame names and full-width specimens | Retained until their owner is reviewed. Multi-part prefixes, duplicate local surface states and specimen crops remain explicit migration work. |
| Runtime structure | Empty task direct entry omits a back action; overview navigation retains it. Tool dialogs keep the approved 40px review inset and native viewport bounds. Unknown-start and running review fixtures prepare the approved branch folding through keyboard controls. |
| Artwork and studies | No image assets or studies exist. Display dimensions and image budgets are not applicable to the current inventory. |

## Remaining work

- Obtain gallery approval for the remaining migrated feature owners and their local states; keep generic assets in components.
- Extract remaining embedded representative content and give generic assets neutral data interfaces.
- Resolve multi-part frame prefixes and remaining source lines over 140 characters with their owners.
- Review component crops and preserve real layout constraints for charts and lists.
- Move fixture projections out of surfaces, then review each retained surface against its mapped implementation.
- Remove duplicate wrappers and assets without consumers when their batch closes; synchronize the declared forms and fixture routes.
- Obtain Leo's gallery approval for each batch. Full runtime comparison, interactions and platform acceptance follow `design.md` before publication.

## single-choice family

The single-choice specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. SingleChoice uses intrinsic content width. Governance state: approved 2026-11-08 by Leo.

## search family

The search specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: approved 2026-11-08 by Leo.

## layout-metrics family

The layout, metric-figure specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment; the Panel specimen retains its own 24px padding inside the 4px clearance. Governance state: approved 2026-11-08 by Leo.

- Frame route: `cup-layout-shell` → `cup-layout-panel-shell`.

- Frame route: `cup-metric-figure-overview` → `cup-metric-figure-grid-overview`.

- Frame route: `cup-metric-figure-unknown` → `cup-metric-figure-grid-unknown`.

## header family

The header specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: approved 2026-11-08 by Leo.

## status family

The status specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: approved 2026-11-08 by Leo.

## tooltip family

The tooltip specimens use `fixtures/` data and a `[data-design-specimen]` runtime capture with 4px outer clearance. Exported part defaults are preserved. The 672px content width is retained to preserve wrapping and alignment. Governance state: approved 2026-11-08 by Leo.

Visual proposal, pending a separate review: narrower Search, Header, metric, Status and Tooltip specimens may change wrapping or alignment. Their original content widths remain constraints for this structural batch.

## quota module

Current owner: `modules/quota.tsx`. Migration state: approved 2026-11-08 by Leo. Parts retain defaults and 672px content width with 4px display clearance. Common controls are imported from components. Consumer and shared business leaf move in this same module; import-direction lint remains enabled.

| Old frame | Current module frame | Disposition |
| --- | --- | --- |
| `components/quota-bar.tsx` / `windows` | `modules/quota.tsx` / `bar-windows` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `surfaces/quota.tsx` / `credits-and-exhaustion` | `modules/quota.tsx` / `section-credits-and-exhaustion` | Moved with equivalent fixture content; wrapper surface removed when applicable. |

The removed `surfaces/quota.tsx` contained local feature states only. Its complete state coverage now belongs to the module; no independent page geometry is lost. Current fixture IDs and selector captures are listed in `design.md`.

## usage-trend module

Current owner: `modules/usage-trend.tsx`. Migration state: approved 2026-11-08 by Leo. Parts retain defaults and 672px content width with 4px display clearance. Common controls are imported from components. Consumer and shared business leaf move in this same module; import-direction lint remains enabled.

| Old frame | Current module frame | Disposition |
| --- | --- | --- |
| `components/usage-chart.tsx` / `tokens` | `modules/usage-trend.tsx` / `chart-tokens` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `components/usage-chart.tsx` / `selected` | `modules/usage-trend.tsx` / `chart-selected` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `components/legend.tsx` / `models` | `modules/usage-trend.tsx` / `legend-models` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `surfaces/usage-trend.tsx` / `hourly-cost` | `modules/usage-trend.tsx` / `chart-hourly-cost` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `surfaces/usage-trend.tsx` / `single-model` | `modules/usage-trend.tsx` / `chart-single-model` | Moved with equivalent fixture content; wrapper surface removed when applicable. |

The removed `surfaces/usage-trend.tsx` contained local feature states only. Its complete state coverage now belongs to the module; no independent page geometry is lost. Current fixture IDs and selector captures are listed in `design.md`.

## task-list module

Current owner: `modules/task-list.tsx`. Migration state: approved 2026-11-08 by Leo. Parts retain defaults and 672px content width with 4px display clearance. Common controls are imported from components. Consumer and shared business leaf move in this same module; import-direction lint remains enabled.

| Old frame | Current module frame | Disposition |
| --- | --- | --- |
| `components/task-list.tsx` / `search-empty` | `modules/task-list.tsx` / `list-search-empty` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `components/task-row.tsx` / `selection-long` | `modules/task-list.tsx` / `row-selection-long` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `surfaces/task-list.tsx` / `selected` | `modules/task-list.tsx` / `list-selected` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `surfaces/task-list.tsx` / `search-empty` | `modules/task-list.tsx` / `list-search-empty` | Duplicate of component search-empty; one module frame and fixture cover both. |

The removed `surfaces/task-list.tsx` contained local feature states only. Its complete state coverage now belongs to the module; no independent page geometry is lost. Current fixture IDs and selector captures are listed in `design.md`.

## context module

Current owner: `modules/context.tsx`. Migration state: approved 2026-11-08 by Leo. Parts retain defaults and 672px content width with 4px display clearance. Common controls are imported from components. Consumer and shared business leaf move in this same module; import-direction lint remains enabled.

| Old frame | Current module frame | Disposition |
| --- | --- | --- |
| `components/context-chart.tsx` / `selected-compaction` | `modules/context.tsx` / `chart-selected-compaction` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `components/context-allocation.tsx` / `estimated` | `modules/context.tsx` / `allocation-estimated` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `components/context-allocation.tsx` / `unknown-capacity` | `modules/context.tsx` / `allocation-unknown-capacity` | Moved with equivalent fixture content; wrapper surface removed when applicable. |
| `surfaces/context.tsx` / `selected-compaction` | `modules/context.tsx` / `chart-selected-compaction` | Chart selection belongs to ContextChart; unchanged allocation is covered by allocation-estimated. |
| `surfaces/context.tsx` / `missing-measurements` | `modules/context.tsx` / `chart-missing-measurements` | Missing measurements belong to ContextChart; unchanged allocation is covered by allocation-estimated. |
| `surfaces/context.tsx` / `unknown-capacity` | `modules/context.tsx` / `chart-unknown-capacity`, `allocation-unknown-capacity` | Each part owns its capacity state; no combined-state frame. |

The context module declares exactly five part frames: chart-selected-compaction, chart-missing-measurements, chart-unknown-capacity, allocation-estimated and allocation-unknown-capacity. The removed `surfaces/context.tsx` contained local states; the part frames replace its combined-state coverage. Current fixture IDs and selector captures are listed in `design.md`.

Module migration adds no visual proposal. Existing narrower-specimen proposals remain separate; the four modules preserve the 672px content width and original state content.

## waterfall module

Current owner: `modules/waterfall.tsx`. Approved 2026-11-08 by Leo. Explicit part props preserve defaults; local states are declared on the owning part. Surfaces retain their compositions for batch 6.

| Old frame | Current frame | Disposition |
| --- | --- | --- |
| `components/waterfall.tsx` / `completed` | `waterfall-completed` | Moved and cropped with 4px display clearance. |
| `components/minimap.tsx` / `selected-range` | `minimap-selected-range` | Moved and cropped with 4px display clearance. |
| `components/minimap.tsx` / `loading-target` | `minimap-loading-target` | Moved and cropped with 4px display clearance. |
| `components/waterfall-row.tsx` / `branches` | `row-branches` | Moved and cropped with 4px display clearance. |
| `components/waterfall-row.tsx` / `unknown` | `row-unknown` | Moved and cropped with 4px display clearance. |
| Local state previously represented in a surface | `waterfall-running` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `waterfall-failed` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `waterfall-unknown` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `waterfall-partial` | Part-level coverage; surface retained for batch 6. |

## turn-summary module

Current owner: `modules/turn-summary.tsx`. Approved 2026-11-08 by Leo. Explicit part props preserve defaults; local states are declared on the owning part. Surfaces retain their compositions for batch 6.

| Old frame | Current frame | Disposition |
| --- | --- | --- |
| `components/turn-header.tsx` / `states` | `header-states` | Moved and cropped with 4px display clearance. |
| Local state previously represented in a surface | `summary-loading` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `summary-error` | Part-level coverage; surface retained for batch 6. |

## request-details module

Current owner: `modules/request-details.tsx`. Approved 2026-11-08 by Leo. Explicit part props preserve defaults; local states are declared on the owning part. Surfaces retain their compositions for batch 6.

| Old frame | Current frame | Disposition |
| --- | --- | --- |
| `components/request-details.tsx` / `narrative` | `full` | Moved and cropped with 4px display clearance. |
| Local state previously represented in a surface | `collapsed` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `loading` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `error` | Part-level coverage; surface retained for batch 6. |

## tool-dialog module

Current owner: `modules/tool-dialog.tsx`. Approved 2026-11-08 by Leo. Explicit part props preserve defaults; local states are declared on the owning part. Surfaces retain their compositions for batch 6.

| Old frame | Current frame | Disposition |
| --- | --- | --- |
| `components/tool-dialog.tsx` / `ready` | `dialog-ready` | Moved and cropped with 4px display clearance. |
| `components/tool-body.tsx` / `truncated` | `body-truncated` | Moved and cropped with 4px display clearance. |
| Local state previously represented in a surface | `dialog-loading` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `dialog-error` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `dialog-long` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `dialog-failed` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `dialog-copy-error` | Part-level coverage; surface retained for batch 6. |
| Local state previously represented in a surface | `dialog-unknown` | Part-level coverage; surface retained for batch 6. |

`surfaces/tool-dialog.tsx` / ready is removed: identical to module dialog-ready. The other six surface frames remain until batch 6. ToolBody imports longOutput directly from fixtures and does not re-export it.

TurnSummary composes the expanded TurnHeader and explicit loading/error feedback without a layout node. Its surface consumer remains turn-loading. RequestDetails.narrative is the body disclosure/load status, not a whole-module review form. ToolDialog accepts input, output, durationMs, exitCode, loading, error and copyError; fixture helpers map review names to those props. Dialog specimens keep the original 720px modal region inside 4px clearance; their review adapter mirrors that region without changing production CSS.

No ownership correction is pending: TimeAxis, Minimap and WaterfallRow retain call/turn semantics; ToolBody retains tool payload, truncation and copy semantics. They remain in their approved feature modules. No new visual proposal is introduced; the recorded turn/partial 0–24s versus 0–24.96s fidelity item remains unchanged.

Runtime comparison follow-ups: standalone RequestDetails captures differ by about 6px in height; waterfall/unknown differs by about 3px, and partial keeps its recorded padded-range drift. Native ToolDialog typography differs by about 2px in height. These differences are separate visual-acceptance proposals; the retained design surfaces remain pixel-identical.

## Batch 6: overview

Governance status: implemented; Leo gallery review pending.

New owner: `modules/usage-summary.tsx` → runtime Overview local usage Section, SingleChoice range filter and Figures (`ui/overview/overview.tsx`). Consumers: overview surface and module specimens. `fixtures/overview.ts` owns records, unknown-model transforms, summary metrics, task records and indexing progress. QuotaSection now owns its loading/error branches; runtime owner remains QuotaBlock.

| Old surface frame | Coverage / disposition |
| --- | --- |
| overview/ready | Retained: complete account, summary, trend and task arrangement. |
| overview/indexing | Retained: both account and local-index regions replace the complete lower page. |
| overview/unavailable | Retained: account remains while local usage and the lower page become unavailable. |
| overview/empty | Retained: zero summary and empty page replace trend and tasks. |
| overview/stale | Retained: refresh banner changes page geometry. |
| overview/unpriced | Retained: warning replaces trend while task table remains. |
| overview/refreshing | Removed: header/refreshing and usage-summary/refreshing cover local busy controls; page arrangement is unchanged. |
| overview/quota-unavailable | Removed: quota/section-error owns the account-local replacement; overview/ready covers its surrounding arrangement. |

Quota part frames: section-loading and section-error. UsageSummary part frames: ready, refreshing, indexing and unavailable; each is one owned state, with no combined-state matrix. All new specimens use 672px content width plus 4px clearance. Structural extraction preserves retained surface pixels.

## Batch 6: task

Governance status: implemented; Leo gallery review pending.

`fixtures/task.ts` owns task-specific history filtering, metric selection, newest-first turn ordering, progress and title selection. The surface now composes explicit projection fields; runtime consumers remain TaskPage, TaskSummary, ContextChart, CurrentContext and TurnHeader. No new module is needed: the metric grid and page branch arrangement are layout glue.

| Old surface frame | Disposition / retained layout |
| --- | --- |
| task/ready | Retained: metrics, context and turn-list arrangement. |
| task/empty | Retained: direct-entry empty page omits Header and all content regions. Status/feedback covers the local empty control. |
| task/indexing | Retained: Header with whole-page indexing replacement. |
| task/unavailable | Retained: Header with retry replacement for the whole body. |
| task/stale | Retained: banner changes whole-page geometry above metrics. |
| task/long-title | Retained: wrapped title changes Header and downstream geometry. |

All six retained frames preserve their original light/dark pixels. No frame is a local context or row state combination.
