# ChatGPT Usage marketplace

Installable Usage overview and Task usage panels for ChatGPT Desktop, with a bundled TypeScript backend and host Node launchers. See the [runtime support matrix](https://github.com/whzxc/chatgpt-usage-plugin/blob/main/docs/runtime.md) before installation.

```sh
codex plugin marketplace add whzxc/chatgpt-usage-plugin --ref stable
codex plugin add usage@chatgpt-usage
```

Update with `codex plugin marketplace upgrade chatgpt-usage`, then reload the plugin and reopen the panels. The host controls installation and its cache. Existing processes keep their previous server process until reloaded.

This branch is generated. Source, development documentation and issues live on [main](https://github.com/whzxc/chatgpt-usage-plugin/tree/main). `release.json` identifies the source commit, version and runtime payload SHA-256 hashes. Platform ZIPs and checksums are attached to [releases](https://github.com/whzxc/chatgpt-usage-plugin/releases). Packages are not notarized macOS apps or Authenticode-signed Windows installers.

MIT licensed. No separately installed Node/npm, Connector Desktop or Tunnel is required. A compatible host-managed Node is required. This plugin reads Codex history and quota; it does not expose Agent task controls.
