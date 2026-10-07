# Distribution

Source and installable marketplace belong to this repository. A second repository, deploy key or cross-repository synchronization is unnecessary.

The Plugin workflow runs only through manual dispatch and has two jobs: build and optional publish. Build runs on Apple Silicon macOS and Windows x64, compiles the native executable and embedded UI, checks each package through MCP, and uploads platform ZIPs with SHA-256 checksums. With `publish=false` (the default), the workflow stops after build. Pushes, pull requests and tag creation do not trigger it. TypeScript and Rust formatting checks are run locally before committing.

For a release, synchronize the version in `package.json`, `package-lock.json`, `native/Cargo.toml`, `native/Cargo.lock` and `plugins/usage/.codex-plugin/plugin.json`. Update `docs/release-notes.md` with the current release's features. Verify the intended source commit in CI and validate the two panels in the supported installed hosts.

After publication is authorized, create `v<version>` on that source commit and dispatch the Plugin workflow on that tag with `publish=true`. Publication requires a matching tag and package identity and a successful two-platform build. The publish job verifies ZIP checksums and shared metadata, assembles the dual-platform marketplace and checks binary hashes before delivery. The workflow uses the repository's `GITHUB_TOKEN` with contents-write permission to advance `stable` and publish versioned ZIPs/checksums. Only an explicit manual dispatch with `publish=true` publishes.

`main` contains no generated executables. `stable` contains only `.agents/plugins/marketplace.json`, the plugin manifest, MCP launch configuration, icon, license and both executables, plus release provenance. Windows resolves the extensionless MCP command to the sibling `.exe`; platform ZIPs explicitly select their native executable. These archives are not OS-notarized or Authenticode-signed installers.

The repository does not update `whzxc/clc-plugins`. That repository distributes the original broader CLC plugin. Switching to `usage@chatgpt-usage` is explicit because it supplies usage panels only. The old source can remain available to existing users without a synchronization job here.
