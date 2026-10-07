# Distribution

Source and installable marketplace belong to this repository. A second repository, deploy key or cross-repository synchronization is unnecessary.

The Plugin workflow runs TypeScript and Rust formatting checks, builds the native executable and embedded UI on Apple Silicon macOS and Windows x64, verifies each package with the existing MCP artifact check, and assembles one marketplace. Both operating systems then verify the assembled result. CI artifacts are downloadable without publishing to users.

For a release, synchronize the version in `package.json`, `package-lock.json`, `native/Cargo.toml`, `native/Cargo.lock` and `plugins/usage/.codex-plugin/plugin.json`. Update `docs/release-notes.md` with the current release's features. Verify the intended source commit in CI and validate the two panels in the supported installed hosts.

After publication is authorized, create `v<version>` on that source commit and dispatch the Plugin workflow on that tag with `publish=true`. Publication requires a matching tag and package identity, a successful two-platform build and assembled-marketplace verification. The workflow uses the repository's `GITHUB_TOKEN` with contents-write permission to advance `stable` and publish versioned ZIPs/checksums. Ordinary pushes and pull requests never publish.

`main` contains no generated executables. `stable` contains only `.agents/plugins/marketplace.json`, the plugin manifest, MCP launch configuration, icon, license and both executables, plus release provenance. Windows resolves the extensionless MCP command to the sibling `.exe`; platform ZIPs explicitly select their native executable. These archives are not OS-notarized or Authenticode-signed installers.

The repository does not update `whzxc/clc-plugins`. That repository distributes the original broader CLC plugin. Switching to `usage@chatgpt-usage` is explicit because it supplies usage panels only. The old source can remain available to existing users without a synchronization job here.
