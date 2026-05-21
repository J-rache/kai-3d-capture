$ErrorActionPreference = "Stop"
$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$PidPath = Join-Path $Root ".kai-3d-capture\api.pid"

if (-not (Test-Path -LiteralPath $PidPath)) {
  [pscustomobject]@{ ok = $true; stopped = $false; message = "No api.pid found." } | ConvertTo-Json
  exit 0
}

$PidValue = (Get-Content -LiteralPath $PidPath -Raw).Trim()
$Process = if ($PidValue) { Get-Process -Id ([int]$PidValue) -ErrorAction SilentlyContinue } else { $null }
if ($Process) {
  Stop-Process -Id $Process.Id -Force
  Remove-Item -LiteralPath $PidPath -Force
  [pscustomobject]@{ ok = $true; stopped = $true; pid = $Process.Id } | ConvertTo-Json
} else {
  Remove-Item -LiteralPath $PidPath -Force
  [pscustomobject]@{ ok = $true; stopped = $false; message = "Stale pid removed." } | ConvertTo-Json
}

