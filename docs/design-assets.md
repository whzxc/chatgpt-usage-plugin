# Design asset register

[Direction, frames and review](design.md) · [ADG asset rules](https://github.com/whzxc/agent-design-gallery/blob/main/docs/asset-rules.md)

## Adoption and review

Quiet Native, light/dark host themes, Chinese product text and the 720px review basis remain the selected direction. Minimum ADG version: 0.5.0. All 32 reusable parts below have real implementation consumers, including internal and transitive use. Leo approved the final specimen crops on 2026-11-08.

Leo approved the original visual baseline at `2f983b9` on 2026-11-06. Governance batches 0–6, context rework and both ToolDialog/partial fidelity proposals are approved **2026-11-08 by Leo**. Leo approved the final data/lifecycle work, runtime typography correction and both Search/Tooltip crop proposals on 2026-11-08. No pending or abandoned proposal or study remains.

## Parts and implementation consumers

Paths in the source column are relative to design/. Internal users are named explicitly; gallery specimens alone are not counted as adoption. Each row is adopted in the mapped runtime, even when its exported name differs.

| Source | Part | Design/runtime consumer reach | Implementation owner | Status |
| --- | --- | --- | --- | --- |
| `components/button.tsx` | Button | Header, Minimap, RequestDetails, Status, TaskList, ToolBody, ToolDialog, Waterfall → overview, task, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): Button | Adopted |
| `components/header.tsx` | Header | overview, task, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): Header | Adopted |
| `components/layout.tsx` | Panel | Other Panel-based component specimens; overview, task, turn and module specimens | [`controls.tsx`](../ui/components/ui/controls.tsx): Panel; production overview/task containers use [`layout.css`](../ui/shared/layout.css) | Adopted |
| `components/layout.tsx` | Stack | Waterfall and task → turn; specimen layouts for Search, SingleChoice, Status, QuotaBar, TurnHeader and WaterfallRow | [`layout.css`](../ui/shared/layout.css): `.stack` and feature flex containers | Adopted |
| `components/layout.tsx` | Grid | Legend, MetricGrid, QuotaSection, RequestDetails → overview, quota, usage-trend, task, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): MetricGrid; [`overview.tsx`](../ui/overview/overview.tsx): quota/legend grids; [`waterfall.tsx`](../ui/task/waterfall.tsx): request fact grid | Adopted |
| `components/layout.tsx` | Section | ContextChart, ContextAllocation, QuotaSection, TaskList, UsageChart, Waterfall; overview, task → context, quota, task-list, usage-trend, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): Section | Adopted |
| `components/metric-figure.tsx` | MetricFigure | MetricGrid → overview, task, turn | [`controls.tsx`](../ui/components/ui/controls.tsx): MetricGrid's `.figure` markup | Adopted |
| `components/metric-figure.tsx` | MetricGrid | Waterfall, UsageSummary, task | [`controls.tsx`](../ui/components/ui/controls.tsx): MetricGrid; [`overview.tsx`](../ui/overview/overview.tsx): Figures; [`task.tsx`](../ui/task/task.tsx): TaskSummary; [`waterfall-head.tsx`](../ui/task/waterfall-head.tsx): WaterfallHead | Adopted |
| `components/search.tsx` | Search | TaskList → overview; module specimens | [`controls.tsx`](../ui/components/ui/controls.tsx): Search | Adopted |
| `components/single-choice.tsx` | SingleChoice | TaskList, UsageChart, UsageSummary → overview | [`SingleChoice.tsx`](../ui/components/ui/SingleChoice.tsx): SingleChoice | Adopted |
| `components/status.tsx` | Status | RequestDetails, TaskList, ToolDialog, Waterfall, QuotaSection, UsageSummary → overview, task, turn | [`status.tsx`](../ui/shared/status.tsx): Status, Indexing, Failure | Adopted |
| `components/tooltip.tsx` | Tooltip | ContextChart, UsageChart → context, overview, task, usage-trend | [`controls.tsx`](../ui/components/ui/controls.tsx): Tooltip | Adopted |
| `modules/usage-trend.tsx` | Legend | UsageChart → overview; usage-trend module specimens | [`overview.tsx`](../ui/overview/overview.tsx): ModelLegend | Adopted |
| `modules/usage-trend.tsx` | UsageChart | overview; usage-trend module specimens | [`overview.tsx`](../ui/overview/overview.tsx): UsageChart | Adopted |
| `modules/usage-summary.tsx` | UsageSummary | overview; module specimens | [`overview.tsx`](../ui/overview/overview.tsx): local usage Section, SingleChoice and Figures | Adopted |
| `modules/quota.tsx` | QuotaBar | QuotaSection → overview; quota module specimens | [`overview.tsx`](../ui/overview/overview.tsx): QuotaBar | Adopted |
| `modules/quota.tsx` | QuotaSection | overview; quota module specimens | [`overview.tsx`](../ui/overview/overview.tsx): QuotaBlock | Adopted |
| `modules/task-list.tsx` | TaskList | overview; module specimens | [`overview.tsx`](../ui/overview/overview.tsx): TaskTable | Adopted |
| `modules/task-list.tsx` | TaskColumns | TaskList and row specimen → overview, task-list | [`overview.tsx`](../ui/overview/overview.tsx): TaskColumns | Adopted |
| `modules/task-list.tsx` | TaskRow | TaskList → overview; module specimens | [`overview.tsx`](../ui/overview/overview.tsx): TaskRow | Adopted |
| `modules/context.tsx` | ContextChart | ContextSection → task; module specimens | [`context-chart.tsx`](../ui/task/context-chart.tsx): ContextChart | Adopted |
| `modules/context.tsx` | ContextAllocation | ContextSection → task; module specimens | [`task.tsx`](../ui/task/task.tsx): CurrentContext | Adopted |
| `modules/turn-summary.tsx` | TurnHeader | Waterfall, task and module specimens → turn | [`turn.tsx`](../ui/task/turn.tsx): TurnHeader | Adopted |
| `modules/waterfall.tsx` | Minimap | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): Minimap | Adopted |
| `modules/waterfall.tsx` | TimeAxis | Waterfall and row specimen → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): `.wf-heading` tick markup | Adopted |
| `modules/waterfall.tsx` | WaterfallRow | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): TraceRow | Adopted |
| `modules/request-details.tsx` | RequestDetails | Waterfall → turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): RequestDetailsPanel, NoteDetails | Adopted |
| `modules/waterfall.tsx` | Waterfall | turn | [`waterfall.tsx`](../ui/task/waterfall.tsx): Waterfall; [`waterfall-head.tsx`](../ui/task/waterfall-head.tsx): WaterfallHead | Adopted |
| `modules/tool-dialog.tsx` | ToolBody | ToolDialog; module specimens | [`tool-dialog.tsx`](../ui/task/tool-dialog.tsx): ToolBody | Adopted |
| `modules/tool-dialog.tsx` | ToolDialog | Module specimens; production Waterfall tool activation | [`tool-dialog.tsx`](../ui/task/tool-dialog.tsx): ToolDialog | Adopted |
| `modules/context.tsx` | ContextSection | task → ContextChart + ContextAllocation | [`task.tsx`](../ui/task/task.tsx): TaskPage context region | Adopted |
| `modules/turn-summary.tsx` | TurnSummary | Runtime expanded-turn feedback; module fixtures | [`turn.tsx`](../ui/task/turn.tsx): TurnRow | Adopted |

ContextSection forwards selected, gaps and unknownLimit to its two owning parts without a wrapper; task owns their spacing. TurnSummary composes TurnHeader and explicit loading/error feedback. TimeAxis maps to the wf-heading markup in waterfall.tsx and tick writes in waterfall-clock.ts. ToolDialog is invoked by runtime Waterfall even though its design surface wrapper is retired. No ownership correction is pending.

## Retained surfaces

| Source under design/surfaces | Frames and whole-layout purpose | Implementation | Status |
| --- | --- | --- | --- |
| overview.tsx | ready: complete layout; indexing/unavailable: replace lower page; empty: remove trend/table; stale: banner; unpriced: warning replaces chart while tasks remain | [`overview.tsx`](../ui/overview/overview.tsx): Overview | Adopted |
| task.tsx | ready: metrics/context/turns; empty: direct entry without Header; indexing/unavailable: whole body replacement; stale: banner; long-title: wrapped Header shifts the page | [`task.tsx`](../ui/task/task.tsx): TaskPage | Adopted |
| turn.tsx | completed: expanded turn page; request-detail: selected rail and inserted details alter regional alignment | [`waterfall.tsx`](../ui/task/waterfall.tsx): Waterfall via the review composition | Adopted |

There are 14 retained surface frames. Local execution, pagination, body, tool and selection states belong to modules. Entry, turn-loading, tool-dialog and other component-only surfaces are retired; their routes are absent from gallery.json, the fixture manifest and capture preparations. No frame is an undeclared state matrix.

## Data, support and captures

All representative content and projections live in design/fixtures/. usage.ts owns the shared fictional calls, turns, history, prices and aggregation; per-feature files own specimen inputs and state-to-prop projections. overview.ts and task.ts own history transforms and metric selection. No scenes directory or compatibility import remains.

The support directory has two neutral helpers: format.ts for displayed values, frame.ts for frame/capture defaults. Neither imports a visual layer or feature fixture. Generic components accept neutral scalar and label/value interfaces; domain types Call, Turn, Model and TaskRowData are confined to fixtures/modules and the runtime review projection.

The library has **20 sources, 69 frames and 32 reusable parts**. design/gallery.json lists exactly 8 component, 9 module and 3 surface sources. tooling/design-review/fixtures.json lists exactly the 69 declared frame IDs plus cup-waterfall-scroll. The declared forms table in design.md is the frame/capture register; Frame props own current dimensions and selectors. No stale source or capture ID is retained.

Part crops keep 4px display clearance, including focus outline and offset. Normal content width is 672px. Button and SingleChoice use intrinsic width; Panel preserves its 720px region inside clearance, and ToolDialog preserves its 720px modal region. Approved narrower Search/Tooltip dimensions are listed below. Surface captures retain 720x2400 viewport, page origin and natural content height. Both themes use zh-CN, Asia/Shanghai labels and the fixed review clock 2026-11-06T06:32:00Z.

The review adapter in tooling/design-review/main.tsx mounts real production parts; data.ts projects fixture records into runtime types; bridge.ts serves fictional responses. RequestDetails standalone notes use the representative full summary while request titles retain their short indexed headings. Production data and request-heading logic are unchanged. Packaging excludes design/, tooling/design-review/ and output/.

## Resolved fidelity items

| Item | Current behavior |
| --- | --- |
| Waterfall unknown | Runtime direct Status explicitly uses 14px / 21px. Design and implementation are both 680x932px including specimen clearance. |
| RequestDetails | Runtime note headers explicitly use 12px / 18px. full, collapsed, loading and error match design heights 358, 296, 357 and 368px at 680px specimen width. |
| ToolDialog | Approved 20px title with 28px line height, 24px padding and 24px gap. The prior 2px content-frame height drift is resolved; ready is 728x449px. |
| Original turn/partial 0–24s record | Approved padded visible range is [0, 24960]ms. Axis labels are 0s, 8.3s, 16.6s, 25s; the footer floors seconds to 0s–24s. Reveal Button has 24px outer Stack spacing. Both captures are 680x785px. Summary/minimap retain the complete 45s turn and runtime scroll-following behavior. |

## Approved specimen crops

Both frames are marked **Approved 2026-11-08 by Leo**. Component defaults, source ownership, names and fixture IDs stay unchanged; the adapter uses the same narrower specimen regions.

| Frame | Proposed content / frame width | Real usage constraint |
| --- | --- | --- |
| components/search.tsx / field | 180px / 188px | Runtime .task-filters .search in ui/shared/layout.css; preserve 4px focus clearance. |
| components/tooltip.tsx / bucket | 240px / 248px | Runtime .inspection > .tooltip and the composed chart inspection cards; preserve border and 4px clearance. |

Closed without change: Header keeps 672px for actual panel title wrapping and trailing refresh placement; metric grids keep 672px for production column alignment; Status keeps 672px for full-width progress, feedback and retry alignment. Layout preserves its panel constraint. Button and SingleChoice already use intrinsic crops. Narrowing these specimens would introduce an unused layout constraint.

## Lifecycle and exceptions

No asset or token has been deleted on a specimen-only usage count. All 32 parts are mapped above; all 19 fixture files and both support files are reachable from design or the review adapter. All 37 design tokens have design utility or runtime consumers. model-other remains for runtime additional-model slots. There are no unconsumed assets, abandoned alternatives, artwork or studies; image dimensions/budgets are not applicable.

Removed stale code: unused duration/Stack imports from RequestDetails, variant from turn-summary, compact/tools from waterfall; the obsolete task-row fixture exclusion; retired narrative-loading/error route suffixes and the old tool-dialog route alias; the noPrompt fixture text had zero references and is removed. The shared corpus and formatting helper moved without aliases; no fictional records were dropped. Current fixture IDs and capture selectors remain reachable.

cup-waterfall-scroll is the deliberate interaction-only fixture: six fictional minutes in a 480px scroller, used for viewport-following, minimap navigation and reduced motion. It has no gallery frame and is excluded from installed assets. Empty task direct entry omits a back action; navigation from overview retains it. Native dialogs remain modal and viewport bounded. These are intentional runtime behaviors, with no outstanding design discrepancy.

## Conformance and final review

The final audit follows the linked ADG placement, dependencies, frames, names, fidelity/gaps, lifecycle, supporting-data and local-process checklist. Import-direction lint remains enabled. The design TypeScript check also rejects unused imports and parameters. Automated and manual review cover all 20 sources, support/fixture indirection, token consumers, the 69 frame IDs plus the interaction route, and the implementation mappings above. Open findings: **0**. Missing mapping or capture evidence: **0**.

| Final check | Verified result |
| --- | --- |
| Placement and source imports | 8 components, 9 modules, 3 surfaces; no upward or helper-hidden dependency. |
| Supporting data and types | 19 reachable fixture files and 2 neutral support helpers; no scenes paths or business types in generic interfaces. |
| Names, frames and captures | 69 built frames match declared IDs; 70 unique fixture routes include the deliberate interaction fixture; all relevant code lines are at most 140 characters. |
| Lifecycle and mappings | 32 adopted parts mapped to real implementation consumers; 37 consumed tokens, including model-other; no orphan asset or abandoned alternative. |
| Structural fidelity | All 28 retained surface theme images are pixel-identical; only the two approved specimen crops change design pixels. |
| Runtime typography and regression | 16 existing waterfall tests pass. All 69 frames pass compare in each theme; the other 64 runtime frames are pixel-identical after the five-frame correction. Both cropped specimens pass refreshed comparison in each theme. |
| Tooling | ADG 0.5.0 non-read-only check passes all 20 sources; repository check and strict design typecheck pass. |

Leo approved the complete final batch and both Search/Tooltip crops on 2026-11-08. Governance is complete, with no deferred implementation batch, open finding or pending review.
