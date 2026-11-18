# Development

- MIT-licensed ChatGPT Desktop plugin. Scope is Usage overview and Task usage; keep Agent execution, Kanban, Tunnel and Connector Desktop out of this repository.
- macOS Apple Silicon and Windows x64. TypeScript backend plus React MCP panels using the official MCP/MCP Apps SDKs; installed packages reuse validated host Node 24.19+ (24.x), while npm is build-only. No public npm package.
- No Git worktrees. Do not add compatibility aliases or depend on personal paths or sibling checkouts.
- Keep source on main and generated marketplace on stable. Repository publication requires user authorization; normal CI does not publish.
- Do not add test files or cases. Adapt and run existing checks and perform real acceptance appropriate to changes.
- Commit messages: single-line English Conventional Commits, no body.
- Never commit credentials, private paths, real task content, caches or native binaries to main.
- Documentation describes current functionality, architecture, limitations and operation, not internal work logs.
- Start significant visual changes from TSX design sources in design/, built and rendered with the global adg (>=0.15.0); everyday UI edits implement directly in ui/, verify via `npm run check`, `npm run check:ui`, and `adg compare --all`, and review with `adg review --base=<rev> --json`. Design layers are tokens/components/modules/surfaces with ownership in design/implementation.json and chapters in design/gallery.json; see docs/design.md. Reuse shared React controls in ui/components/ui (SingleChoice for single selection, shared Icon wrapper). Preserve MCP host token fallbacks in ui/tokens.css, ui/theme.ts, keyboard navigation, focus restoration, and reduced motion.
