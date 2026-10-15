# ChatGPT Usage Plugin

Two usage panels for **ChatGPT Desktop**: an overview of readable Codex history and a detailed view of one task.

- Tokens, estimated cost, cache hits, model mix and usage trends for today, 7 days or 30 days.
- Searchable tasks, turn timelines, recorded responses, tool calls and context observations.
- Account quota from the native Codex login, separate from log statistics.
- Host theme and language integration, keyboard controls and reduced motion.

The TypeScript backend and React UI are bundled. Installed packages reuse a compatible ChatGPT/Codex host Node; users do not need to install Node, npm or Rust. This depends on host internals and is limited to the runtime layouts described in [runtime support](docs/runtime.md). No Connector Desktop or network ingress is required. The plugin does not create or modify Agent tasks. It does not include Kanban, task orchestration, a tray app or Tunnel management. It reports readable Codex history on this device, not all ChatGPT conversations or account-wide billing.

## Installation

The repository maintains both source and marketplace distribution:

| Branch | Contents |
| --- | --- |
| `main` | Source, documentation, build and verification tools |
| `stable` | Generated installable marketplace, created by an explicitly published release |

Once a release is published, install with the CLI supplied by your ChatGPT Desktop host:

```sh
codex plugin marketplace add whzxc/chatgpt-usage-plugin --ref stable
codex plugin add usage@chatgpt-usage
```

For a development build, use a locally built package or the platform ZIP from the manually triggered [Plugin workflow](https://github.com/whzxc/chatgpt-usage-plugin/actions/workflows/plugin.yml). Extract the ZIP, register its root with `codex plugin marketplace add <directory>`, then install `usage@chatgpt-usage`. Do not register the source checkout: it contains no built server bundle.

Open **Usage overview** from the host explorer/sidebar or **Task usage** from a task's additional tools. You can also select a task in the overview. A host that cannot bind a local task may require selecting it in the overview. Cloud or other-device history is outside this plugin's scope.

Update with `codex plugin marketplace upgrade chatgpt-usage`, then reload the plugin and reopen its panels. The host owns installation and updates; no desktop application synchronizes or replaces the plugin.

### Existing Local Connector users

`clc@local-connector` and `usage@chatgpt-usage` are different plugins. Install and verify Usage, then disable the old plugin if you no longer need its other tools. The old `whzxc/clc-plugins` marketplace remains a separate source for that plugin. This repository does not rewrite existing installations, remove task tools or migrate Connector state. Both plugins read the original Codex logs independently; no history import is required.

## Development

Use Node 24.19+ (24.x) and npm on Apple Silicon macOS or Windows x64. Rust is not used.

```sh
npm ci
npm run check
npm run build
npm run dev
```

The browser preview is at `http://127.0.0.1:5188/plugin.html?scope=global`. It uses the real TypeScript backend through the same MCP tools as the host. React/CSS edits hot-reload; Server edits require restarting the command. The preview binds only to loopback and requires its same-origin request header. Browser rendering is not installed-host acceptance.

`npm run plugin:dev` creates and installs an isolated `usage@chatgpt-usage-dev` development marketplace through the host CLI. Saving UI source rebuilds the embedded resource; open development panels reload through MCP. Disable the development variant before validating a release variant. No host restart is automated.

```sh
npm run plugin:build           # bundle, package and existing artifact verification
npm run plugin:build -- --debug
npm run check:format
```

The workflow runs only when manually triggered. It builds and checks packages for both supported platforms. With `publish=true` on a matching version tag, it assembles the marketplace, advances `stable` and publishes the release archives. Source pushes, pull requests and tag creation do not trigger builds. See [distribution](docs/distribution.md).

## Data and architecture

The host starts a small OS launcher, which locates and validates its bundled Node, then runs `main.mjs mcp` over stdio. The official MCP SDK owns server protocol handling; MCP Apps `App` owns panel transport, initialization, host context, sizing, teardown and resource reload. The browser preview uses `AppBridge`. The process serves the embedded React panel, indexes Codex JSONL logs and reads quota through a short-lived native `account/rateLimits/read` call. Only three panel tools are exposed: `usage_overview`, `usage_task`, `usage_refresh`. Detailed statistics travel in tool-result `_meta`, outside model-visible text. The backend starts no HTTP listener and has no dependency on Connector's Core, version or state.

`CODEX_HOME` selects the native history/login location. `CHATGPT_USAGE_STATE_DIR` selects the plugin's disposable cache; the default is `~/.local/state/chatgpt-usage-plugin` on macOS and `%LOCALAPPDATA%/chatgpt-usage-plugin` on Windows. Preview and development installations use their own directories under `dist`. Original logs, login files and tasks are not changed. Quota follows the installed host's bundled Codex CLI, falling back to `codex` on PATH.

Each MCP process has one index worker for scanning and writing, and a separate read-only SQLite connection on the main thread for queries. Processes sharing the same state directory and resolved `CODEX_HOME` share `index/<first 16 hex characters of SHA-256 of the real CODEX_HOME path>.sqlite`. The disposable, versioned index uses WAL and a bounded busy timeout. A renewable scan lease prevents duplicate cold scans; parsing and serialization happen outside short transactions that check the previous cursor before committing. Queries use a consistent read transaction and merge per-source records with the existing response-conflict, turn and tool rules. There is no selection worker pool, history worker, response cache or timed response race.

Requests trigger incremental refreshes, coalesced within a process with a three-second minimum interval. An initial index returns `collecting` immediately. Unchanged logs require only metadata checks; changed logs resume from persisted offsets and parser state. Identity, length and head/tail fingerprints detect rewrites and rebuild that source's rows. Files modified within 32 days are fully indexed; older files have directory metadata until selected for task details. Session titles are read incrementally from `session_index.jsonl`; native state databases are reread only when their database or WAL timestamp changes. Turn ranges and tool input/output offsets avoid rereading entire logs for details. Prompt offsets retain SHA-256 validation, oversized compactions are streamed, and incomplete lines wait for the next refresh.

Quota results share the index with a five-minute TTL and an independent lease. Manual refresh bypasses the TTL but cannot launch another native reader within 30 seconds. Window estimates are computed on the server from local usage within the quota period, subject to freshness, coverage and pool checks; per-record quota history is no longer sent to the panel. Task panels do not request quota. Pricing tables rebuild only when their cached price files change.

The plugin removes only its obsolete `usage-ts` checkpoint directory at startup. Old Rust caches under `usage` are neither read nor deleted. Hidden panels stop polling; host teardown unmounts the panel and clears its timers and subscriptions. Bundled panels and preview dependencies omit SDK `console.debug` calls so browser console history does not retain successive tool payloads; warnings and errors remain available. Stopping the plugin terminates its index worker and quota reader, not external tasks.

Model prices use bundled snapshots and public feed refreshes. No task records or credentials are sent to price feeds. Cost figures are estimates; cached input and reasoning output are subsets, and missing fields remain unknown. Account quota and local history have different coverage and cannot establish exact per-task billing. HTTP_PROXY, HTTPS_PROXY and NO_PROXY apply to public pricing requests through Node’s environment proxy support.

## License

MIT. Extracted usage functionality from [ChatGPT Local Connector](https://github.com/whzxc/chatgpt-local-connector). Pricing data adaptations retain their [OpenUsage license](shared/pricing/LICENSE.OpenUsage).
