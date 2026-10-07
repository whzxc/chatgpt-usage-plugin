# Host runtime support

Usage bundles JavaScript and small shell/PowerShell launchers. It does not ship a Node binary, download a runtime, invoke npm at startup, or fall back to `node` on PATH. Runtime discovery is an explicitly limited dependency on desktop internals, not a public OpenAI plugin runtime API.

## macOS Apple Silicon

The launcher looks for `ChatGPT.app` and `Codex.app` in `/Applications` and `~/Applications`, then uses `Contents/Resources/cua_node/bin/node`. ChatGPT 26.930.61225 with Node 24.21.0 has been verified locally through the packaged launcher and MCP. A missing or incompatible runtime stops with a diagnostic on stderr.

## Windows x64

The launcher queries the current user’s `OpenAI.Codex` Store package. It checks `app/resources/cua_node/bin/node.exe`, `cua_node/node.exe`, and `node.exe`. Store executables are copied into an account-protected, content-addressed plugin cache before execution. If no bundled executable is available, it checks the desktop-managed workspace Node at `%USERPROFILE%/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node.exe`; that optional runtime must already have been installed by the host.

Windows launch discovery is implemented but has not yet been accepted on an installed Windows host. Do not mark Windows host support verified based on CI alone. The marketplace command is extensionless: Codex’s Windows MCP program resolver uses PATHEXT to find the sibling `.cmd`; the command delegates to system PowerShell. Platform CI exercises that launcher using an explicit build runtime.

## Runtime contract and operation

The startup check requires Node 24.19+ within the 24.x line and SQLite, worker threads and fetch capabilities. A future Node major is intentionally rejected until validated. A host update can change internal paths even when Node itself remains compatible; keep the verified host matrix current when releasing.

`CHATGPT_USAGE_NODE` can explicitly select a Node executable for development, CI or diagnostics. It is still subject to the runtime check. Ordinary installations leave it unset. CI uses this override because GitHub runners do not contain ChatGPT Desktop; passing artifact checks proves the bundle, not installed-host discovery or UI acceptance.

The launcher enables Node’s environment HTTP proxy support for public price feeds. It passes stdin/stdout to the official MCP transport; diagnostics stay on stderr. Host removal of the managed runtime requires repairing/updating the host or selecting an explicitly verified runtime. No automatic runtime installation is attempted.

Quota continues to use the host’s Codex CLI and its existing login. Windows keeps the CLI’s sibling helpers together in a private cache, as required for launching Store-supplied executables outside their package.
