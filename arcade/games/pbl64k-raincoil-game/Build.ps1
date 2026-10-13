param(
    [ValidateSet('All', 'Web', 'Windows', 'Source')][string]$Target = 'All',
    [switch]$Install,
    [string]$NodePath = '',
    [string]$ToolsPath = ''
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not $ToolsPath) { $ToolsPath = Join-Path $PSScriptRoot '.cache/build' }
New-Item -ItemType Directory -Force $ToolsPath | Out-Null
if (-not $NodePath) {
    $NodePath = (Get-Command node -ErrorAction Stop).Source
}
$nodeSupported = & $NodePath -p 'Number(process.versions.node.split(".")[0]) > 22 || (Number(process.versions.node.split(".")[0]) === 22 && Number(process.versions.node.split(".")[1]) >= 12)'
if ($nodeSupported -ne 'true') { throw 'Node.js 22.12 or newer is required. Pass -NodePath with the full path to a modern node.exe.' }
$env:PATH = (Split-Path $NodePath) + [IO.Path]::PathSeparator + $env:PATH
$env:npm_config_cache = Join-Path $ToolsPath 'npm-cache'
$env:ELECTRON_CACHE = Join-Path $ToolsPath 'electron-cache'
$env:electron_config_cache = $env:ELECTRON_CACHE
$env:ELECTRON_BUILDER_CACHE = Join-Path $ToolsPath 'electron-builder-cache'
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
if ($Install) {
    $npmCli = Join-Path $ToolsPath 'node_modules/npm/bin/npm-cli.js'
    if (-not (Test-Path -LiteralPath $npmCli)) {
        $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
        $bootstrapCli = Join-Path (Split-Path $npmCommand) 'node_modules/npm/bin/npm-cli.js'
        & $NodePath $bootstrapCli install --prefix $ToolsPath --ignore-scripts --no-audit --no-fund npm@11.6.0
        if ($LASTEXITCODE -ne 0) { throw 'Local npm bootstrap failed.' }
    }
    if (Test-Path -LiteralPath 'package-lock.json') { & $NodePath $npmCli ci --no-audit --no-fund }
    else { & $NodePath $npmCli install --no-audit --no-fund }
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & $NodePath (Join-Path $PSScriptRoot 'node_modules/electron/install.js')
    if ($LASTEXITCODE -ne 0) { throw 'Electron runtime download failed.' }
}
if ($Target -in @('All', 'Web', 'Source')) {
    & $NodePath tools/package.mjs $Target
    if ($LASTEXITCODE -ne 0) { throw 'Web/source packaging failed.' }
}
if ($Target -in @('All', 'Windows')) {
    & $NodePath tools/make-icon.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }
    $builderCli = Join-Path $PSScriptRoot 'node_modules/electron-builder/cli.js'
    if (-not (Test-Path -LiteralPath $builderCli)) { throw 'Dependencies missing. Re-run with -Install.' }
    & $NodePath $builderCli --win portable --x64
    if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed.' }
    $version = (Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json).version
    $executable = Join-Path $PSScriptRoot "dist/windows/Raincoil-$version-Windows-x64.exe"
    $digest = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath ($executable + '.sha256') -Value ($digest + '  ' + [IO.Path]::GetFileName($executable)) -Encoding utf8
}
