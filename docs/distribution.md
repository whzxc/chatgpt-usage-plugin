# Distribution

Source and installable marketplace belong to this repository. `main` contains TypeScript, React, launchers, documentation and build tools. `stable` is generated only by an explicitly authorized release.

The Plugin workflow runs only through manual dispatch. Build jobs on Apple Silicon macOS and Windows x64 install npm dependencies, type-check UI/server, bundle JavaScript and the self-contained UI, run the existing MCP artifact check, and upload platform ZIPs with SHA-256 checksums. There is no Rust toolchain or platform compilation. CI selects its Node through `CHATGPT_USAGE_NODE`; this does not validate host discovery. See [runtime support](runtime.md) for installed-host boundaries.

For a release, synchronize `package.json`, `package-lock.json` and `plugins/usage/.codex-plugin/plugin.json`. Update `docs/release-notes.md`, run `npm run check`, `npm run check:format` and `npm run plugin:build`, and accept the two panels in each supported installed host. Runtime layout changes require renewed host acceptance.

After publication is authorized, create `v<version>` on the verified source commit and dispatch the Plugin workflow on that tag with `publish=true`. The publish job verifies ZIP checksums, identical cross-platform bundles and metadata, matching source/tag identity, and every runtime payload hash. It advances `stable` and attaches release archives using the repository GITHUB_TOKEN. Pushes, PRs and tag creation do not trigger builds or publication.

Both platform archives contain the same generated server/worker bundles and shell, CMD and PowerShell launchers. On macOS the extensionless MCP command is a shell script; on Windows the host resolves its `.cmd` sibling. Generated payloads include the embedded UI, third-party notices and release provenance; source paths, caches, credentials and host binaries are excluded. These archives are not notarized apps or Authenticode-signed installers.

This repository does not update `whzxc/clc-plugins`. That marketplace distributes the original broader CLC plugin. Switching to `usage@chatgpt-usage` is explicit because it supplies usage panels only.
