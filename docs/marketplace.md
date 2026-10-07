# ChatGPT Usage marketplace

Installable Usage overview and Task usage panels for ChatGPT Desktop, with native Apple Silicon macOS and Windows x64 backends.

```sh
codex plugin marketplace add whzxc/chatgpt-usage-plugin --ref stable
codex plugin add usage@chatgpt-usage
```

Update with `codex plugin marketplace upgrade chatgpt-usage`, then reload the plugin and reopen the panels. The host controls installation and its cache. Existing processes keep their previous binary until reloaded.

This branch is generated. Source, development documentation and issues live on [main](https://github.com/whzxc/chatgpt-usage-plugin/tree/main). `release.json` identifies the source commit, version and binary SHA-256 hashes. Platform ZIPs and checksums are attached to [releases](https://github.com/whzxc/chatgpt-usage-plugin/releases). Packages are not notarized macOS apps or Authenticode-signed Windows installers.

MIT licensed. No Connector Desktop, Node/npm runtime or Tunnel is required. This plugin reads Codex history and quota; it does not expose Agent task controls.
