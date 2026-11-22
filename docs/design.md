# UI design and board governance

[Development](../README.md#development) · [Data contracts](data-tools.md) · [ADG asset rules](https://github.com/whzxc/agent-design-gallery/blob/main/docs/asset-rules.md) · [Boards](https://github.com/whzxc/agent-design-gallery/blob/main/docs/boards.md) · [Toolkit contract](https://github.com/whzxc/agent-design-gallery/blob/main/docs/design-toolkit.md)

## Direction

Quiet Native uses a neutral host canvas, restrained teal emphasis, flat sections, and thin dividers. Body text is 14px, metadata 12px, section headings 20px, and major figures 28px; panels use 24px padding and section spacing, controls 8px corners, panels 12px, and modal dialogs 16px elevation. The interface lives inside the ChatGPT Desktop MCP panel without sidebar or window chrome.

## Governance, boards, and everyday workflow

Design assets live in `design/` and are verified against the global `adg` toolkit (`>=0.17.5`) with strict layer, lifecycle, and motion checks in [adg.config.mjs](../adg.config.mjs).

- **Tokens board (`design/tokens.css`)**: Semantic tokens grouped with single-line `/* Heading */` comments inside `:root`. Exact role aliases use `var(--...)`; `:root[data-theme="dark"]` overrides only tokens whose values change. Runtime tokens in [ui/tokens.css](../ui/tokens.css) mirror those headings and fallbacks inside MCP host `var(--host-var, <fallback>)` wrappers and supply the CSS rules checked by `npm run check:ui`.
- **Motion (`design/motion-patterns.json`)**: `busy-icon-spin` owns the shared busy icon. `waterfall-visible-range` describes how the chart retargets its visible timeline. The design-only timing tokens record the current runtime literals. [Adopting motion](https://github.com/whzxc/agent-design-gallery/blob/main/docs/asset-rules.md#adopting-motion) · [Motion patterns and consumers](https://github.com/whzxc/agent-design-gallery/blob/main/docs/design-toolkit.md#motion-tokens-and-patterns)
- **Boards (`design/gallery.json`)**: Four layer-pure chapters ordered general to specific — `Components`, `Overview`, `Task and turn`, and `Panels`. Feature-folder modules enter through `modules/<feature>/index.tsx`.
- **Ownership (`design/implementation.json`)**: Version 2 binds exported design parts, runtime stylesheets, panel surfaces, and current motion edges to implementation owners. `adg owner` and `adg impact` resolve bindings across `ui/` and `design/`.
- **Everyday changes**: Start routine UI updates directly in `ui/`, run `npm run check`, `npm run check:ui`, `npm run check:design`, and `adg compare --all`, then generate an impact-scoped review sheet with `adg review --base=<rev> --json`. Reconcile `design/` first only when introducing new layouts or visual structure.

## Source, layers, and capture contract

- **Components (`design/components/`)**: Shared multi-feature primitives (`layout`, `button`, `single-choice`, `header`, `metric-figure`, `status`, `tooltip`) mirroring `ui/components/ui/` and `ui/shared/status.tsx`.
- **Modules (`design/modules/`)**: Feature-owned sections (`quota`, `usage-summary`, `usage-trend`, `task-list` with `Search`, `context`, `turn-summary`, `waterfall/` split across `index`, `minimap`, `row`, `request-details`, and `tool-dialog`).
- **Surfaces (`design/surfaces/`)**: Full panel compositions (`overview`, `task`, `turn`). `surfaces/turn.tsx` composes `TurnHeader` and `Waterfall`.
- **Fixtures & support (`design/fixtures/`, `design/support/`)**: Fictional Chinese product copy (`zh-CN`, `Asia/Shanghai`, fixed review clock `2026-11-06T06:32:00Z`).
- **Captures**: 720px panel width (4px display clearance around component/module specimens). `startDesignDev` (`tooling/design-dev.mjs`) serves `/__design/review` on port 5191 with fictional `tooling/design-review/` fixtures, including `cup-waterfall-scroll` for scroll-following verification. External HTTPS and API traffic remain blocked.

## Verification and handoff

Run `adg motion --coverage` for the scanned inventory. The
`waterfall-visible-range` pattern binds both animation frame calls in
[`useWaterfallClock`](../ui/task/waterfall-clock.ts#L14). Its `update` callback
queues the first `requestAnimationFrame(tick)`, and `tick` reschedules it while
a range transition or the live clock is active. The range moves linearly over
150 ms and snaps to the target with reduced motion. The 32 ms redraw gate and
1 s reduced-motion clock interval control update cadence.

The [waterfall minimap pilot](../design/modules/waterfall/index.motion.json)
starts from either the running or completed turn on the Playable board. Click
「最慢」 to jump to the slowest call while the sticky header pins the flow.
The runtime centers and focuses the row immediately and interpolates the
horizontal position and width of the range outline.

```sh
npm run check         # Typechecks (ui, server, design-review, design), Node unit tests, check:ui
npm run check:ui      # Literal paint rules, >=2 feature consumer checks, token parity & allowance
npm run check:design  # ADG strictLayers + lifecycle check & design typecheck
npm run check:format  # Prettier verification across JS/TS/CSS/MJS
adg compare --all     # Compare all fixtures in light mode (set CUP_REVIEW_THEME=dark for dark)
adg review --base=<rev> --json  # Standalone HTML diff review sheet in output/design/review.html
```

The production build (`npm run build` / `ui/app/main.tsx`) excludes `design/`, `tooling/design-review/`, and `output/`. Packaging rules and MCP host token bindings remain governed by [AGENTS.md](../AGENTS.md) and [data contracts](data-tools.md).
