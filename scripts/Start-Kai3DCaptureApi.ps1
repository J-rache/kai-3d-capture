param(
  [int]$Port = 3947,
  [string]$Workspace = "$env:USERPROFILE\Desktop\Kai3DCaptureJobs"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$Runtime = Join-Path $Root ".kai-3d-capture"
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

while (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  $Port += 1
}

$Node = (Get-Command node).Source
$OutLog = Join-Path $Runtime "api.out.log"
$ErrLog = Join-Path $Runtime "api.err.log"
$Process = Start-Process `
  -FilePath $Node `
  -ArgumentList @("src/server/kai-capture-server.mjs", "--port", [string]$Port, "--workspace", $Workspace) `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $OutLog `
  -RedirectStandardError $ErrLog `
  -PassThru

Set-Content -LiteralPath (Join-Path $Runtime "api.pid") -Value $Process.Id -Encoding ASCII
Set-Content -LiteralPath (Join-Path $Runtime "api.url") -Value "http://127.0.0.1:$Port/" -Encoding ASCII
Start-Sleep -Milliseconds 800
$Health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health"

[pscustomobject]@{
  ok = ($Health.StatusCode -eq 200)
  pid = $Process.Id
  url = "http://127.0.0.1:$Port/"
  workspace = $Workspace
  stdout = $OutLog
  stderr = $ErrLog
} | ConvertTo-Json

