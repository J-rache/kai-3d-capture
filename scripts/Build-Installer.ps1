$ErrorActionPreference = "Stop"
$Root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Test-Path -LiteralPath (Join-Path $Root "node_modules"))) {
  npm install
}

npm run verify
npm run build:installer
npm run build:portable

$InstallerDir = Join-Path $Root "dist\installer"
$Outputs = Get-ChildItem -LiteralPath $InstallerDir -Filter "*.exe" -ErrorAction SilentlyContinue |
  Select-Object FullName, Length, LastWriteTime

if (-not ($Outputs | Where-Object { $_.FullName -like "*Setup*.exe" })) {
  throw "NSIS setup installer was not produced under $InstallerDir"
}
if (-not ($Outputs | Where-Object { $_.FullName -like "*0.1.0.exe" -and $_.FullName -notlike "*Setup*.exe" })) {
  throw "Portable executable was not produced under $InstallerDir"
}

[pscustomobject]@{
  ok = $true
  installer_dir = $InstallerDir
  outputs = $Outputs
} | ConvertTo-Json -Depth 5
