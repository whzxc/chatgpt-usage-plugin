$ErrorActionPreference = 'Stop'
$nodePath = $env:CHATGPT_USAGE_NODE
if (-not $nodePath) {
  $hostPackage = Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  if ($hostPackage) {
    $resources = Join-Path $hostPackage.InstallLocation 'app\resources'
    foreach ($relative in @('cua_node\bin\node.exe', 'cua_node\node.exe', 'node.exe')) {
      $candidate = Join-Path $resources $relative
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        # Store executables need a user-owned copy, just like the bundled Codex CLI.
        $state = $env:CHATGPT_USAGE_STATE_DIR
        if (-not $state) { $state = Join-Path $env:LOCALAPPDATA 'chatgpt-usage-plugin' }
        $digest = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant()
        $cache = Join-Path $state "bin\host-node\$digest"
        New-Item -ItemType Directory -Force -Path $cache | Out-Null
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        & "$env:SystemRoot\System32\icacls.exe" $cache '/inheritance:r' '/grant:r' "*${sid}:(OI)(CI)F" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Cannot protect host runtime cache' }
        $nodePath = Join-Path $cache 'node.exe'
        if (-not (Test-Path -LiteralPath $nodePath) -or (Get-FileHash -LiteralPath $nodePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $digest) {
          $temporary = Join-Path $cache ([guid]::NewGuid().ToString() + '.tmp')
          Copy-Item -LiteralPath $candidate -Destination $temporary
          Move-Item -LiteralPath $temporary -Destination $nodePath -Force
        }
        break
      }
    }
  }
  if (-not $nodePath) {
    # Desktop's managed workspace runtime; present only after the host installs it.
    $candidate = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $nodePath = $candidate }
  }
}
if (-not $nodePath -or -not (Test-Path -LiteralPath $nodePath -PathType Leaf)) { throw 'Usage: supported ChatGPT/Codex host Node is unavailable. See docs/runtime.md.' }
& $nodePath '--disable-warning=ExperimentalWarning' (Join-Path $PSScriptRoot 'check-runtime.cjs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $nodePath '--use-env-proxy' '--disable-warning=ExperimentalWarning' (Join-Path $PSScriptRoot 'main.mjs') @args
exit $LASTEXITCODE
