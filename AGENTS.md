# Development

- MIT-licensed ChatGPT Desktop plugin. Scope is Usage overview and Task usage; keep Agent execution, Kanban, Tunnel and Connector Desktop out of this repository.
- macOS Apple Silicon and Windows x64. Rust native backend plus React MCP panels; Node/npm are build tools only. No public npm package.
- No Git worktrees. Do not add compatibility aliases or depend on personal paths or sibling checkouts.
- Keep source on main and generated marketplace on stable. Repository publication requires user authorization; normal CI does not publish.
- Do not add test files or cases. Adapt and run existing checks and perform real acceptance appropriate to changes.
- Commit messages: single-line Conventional Commits with a concise Chinese description, no body.
- Never commit credentials, private paths, real task content, caches or native binaries to main.
- Documentation describes current functionality, architecture, limitations and operation, not internal work logs.
- Reuse shared React/Radix controls in ui/components/ui. Single choices use SingleChoice; shared semantic tokens and host themes live in ui/tokens.css and ui/theme.ts. Icons use the shared Lucide wrapper. Preserve keyboard navigation, focus restoration and reduced motion.
