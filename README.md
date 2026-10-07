# ChatGPT Usage Plugin

Two usage panels for **ChatGPT Desktop**: an overview of readable Codex history and a detailed view of one task.

- Tokens, estimated cost, cache hits, model mix and usage trends for today, 7 days or 30 days.
- Searchable tasks, turn timelines, recorded responses, tool calls and context observations.
- Account quota from the native Codex login, separate from log statistics.
- Host theme and language integration, keyboard controls and reduced motion.

The native backend is bundled. Installed packages need no Node, npm, Rust, Connector Desktop or network ingress. The plugin does not create or modify Agent tasks. It does not include Kanban, task orchestration, a tray app or Tunnel management. It reports readable Codex history on this device, not all ChatGPT conversations or account-wide billing.

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

Until `stable` exists, use a locally built package or the verified `marketplace` artifact from the [Plugin workflow](https://github.com/whzxc/chatgpt-usage-plugin/actions/workflows/plugin.yml). Extract the entire artifact, register its root with `codex plugin marketplace add <directory>`, then install `usage@chatgpt-usage`. Do not register the source checkout: it contains no native executables.

Open **Usage overview** from the host explorer/sidebar or **Task usage** from a task's additional tools. You can also select a task in the overview. A host that cannot bind a local task may require selecting it in the overview. Cloud or other-device history is outside this plugin's scope.

Update with `codex plugin marketplace upgrade chatgpt-usage`, then reload the plugin and reopen its panels. The host owns installation and updates; no desktop application synchronizes or replaces the plugin.

### Existing Local Connector users

`clc@local-connector` and `usage@chatgpt-usage` are different plugins. Install and verify Usage, then disable the old plugin if you no longer need its other tools. The old `whzxc/clc-plugins` marketplace remains a separate source for that plugin. This repository does not rewrite existing installations, remove task tools or migrate Connector state. Both plugins read the original Codex logs independently; no history import is required.

## Development

Use Node 24.12+ and stable Rust on Apple Silicon macOS or Windows x64.

```sh
npm ci
npm run check
npm run build
npm run dev
```

The browser preview is at `http://127.0.0.1:5188/plugin.html?scope=global`. It uses the real Rust backend through the same MCP tools as the host. React/CSS edits hot-reload; Rust edits require restarting the command. The preview binds only to loopback and requires its same-origin request header. Browser rendering is not installed-host acceptance.

`npm run plugin:dev` creates and installs an isolated `usage@chatgpt-usage-dev` development marketplace through the host CLI. Saving UI source rebuilds the embedded resource; open development panels reload through MCP. Disable the development variant before validating a release variant. No host restart is automated.

```sh
npm run plugin:build           # native release build, package and existing artifact verification
npm run plugin:build -- --debug
npm run check:format
```

The workflow builds and checks both supported platforms, combines them into one marketplace, and verifies that marketplace on both operating systems. Source changes do not publish a release or advance `stable`. See [distribution](docs/distribution.md).

## Data and architecture

The host starts `chatgpt-usage mcp` over stdio. The process serves the embedded React panel, indexes Codex JSONL logs and reads quota through a short-lived native `account/rateLimits/read` call. Only three panel tools are exposed: `usage_overview`, `usage_task`, `usage_refresh`. Detailed statistics travel in tool-result `_meta`, outside model-visible text. The backend starts no HTTP listener and has no dependency on Connector's Core, version or state.

`CODEX_HOME` selects the native history/login location. `CHATGPT_USAGE_STATE_DIR` selects the plugin's disposable cache; the default is `~/.local/state/chatgpt-usage-plugin` on macOS and `%LOCALAPPDATA%/chatgpt-usage-plugin` on Windows. Preview and development installations use their own directories under `dist`. Original logs, login files and tasks are not changed. Quota follows the installed host's bundled Codex CLI, falling back to `codex` on PATH.

Each MCP process owns its collectors; it does not share a daemon with other plugins or Connector. Checkpoints are written atomically and can be rebuilt. Hidden panels stop polling. The host terminating the plugin stops its analysis and quota reader, not external tasks.

Model prices use bundled snapshots and public feed refreshes. No task records or credentials are sent to price feeds. Cost figures are estimates; cached input and reasoning output are subsets, and missing fields remain unknown. Account quota and local history have different coverage and cannot establish exact per-task billing. HTTP proxy environment variables apply to public pricing requests.

## License

MIT. Extracted usage functionality from [ChatGPT Local Connector](https://github.com/whzxc/chatgpt-local-connector). Pricing data adaptations retain their [OpenUsage license](shared/pricing/LICENSE.OpenUsage).
