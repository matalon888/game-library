# deploy.ps1 - Time Echo deployment packager
# Usage: in project dir, run `.\deploy.ps1` from PowerShell.
# Output: echo-game-v<version>.zip in same directory, ready to upload to hosting.

$ErrorActionPreference = "Stop"

# Move to script dir (also works on double-click)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# ----- Read version from version.js -----
$verContent = Get-Content "version.js" -Raw -ErrorAction SilentlyContinue
if (-not $verContent) {
    Write-Host "ERROR: version.js not found." -ForegroundColor Red
    exit 1
}
$verMatch = [regex]::Match($verContent, 'number:\s*"([^"]+)"')
$version  = if ($verMatch.Success) { $verMatch.Groups[1].Value } else { "unknown" }

$zipName = "echo-game-v$version.zip"
$zipPath = Join-Path $here $zipName

# ----- Files to deploy -----
$files = @(
    "index.html",
    "style.css",
    "audio.js",
    "editor.js",
    "game.js",
    "generator.js",
    "i18n.js",
    "levels.js",
    "music.js",
    "sprite.js",
    "effects.js",
    "bark.js",
    "story.js",
    "version.js",
    "webgl.js"
)
# Klasörler (recurse kopyala)
$folders = @(
    "music",
    "char",
    "effects"
)

# ----- Remove previous zip -----
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
    Write-Host "Removed previous: $zipName"
}

# ----- Staging folder in temp -----
$staging = Join-Path $env:TEMP "echo-game-deploy-$([guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
    # Copy files
    foreach ($f in $files) {
        if (Test-Path $f) {
            Copy-Item $f -Destination $staging
        } else {
            Write-Warning "Missing, skipped: $f"
        }
    }
    # Copy folders (recursive)
    foreach ($d in $folders) {
        if (Test-Path $d) {
            Copy-Item $d -Destination $staging -Recurse
        } else {
            Write-Warning "Missing folder, skipped: $d"
        }
    }

    # ----- Content summary -----
    Write-Host ""
    Write-Host "Files in package:" -ForegroundColor Cyan
    Get-ChildItem $staging -Recurse -File | ForEach-Object {
        $rel  = [IO.Path]::GetRelativePath($staging, $_.FullName)
        $size = [math]::Round($_.Length / 1024, 1)
        $line = "  {0,-40} {1,8} KB" -f $rel, $size
        Write-Host $line
    }

    # ----- Compress -----
    Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -Force

    $totalBytes = (Get-Item $zipPath).Length
    $totalKB    = [math]::Round($totalBytes / 1024, 1)
    $totalMB    = [math]::Round($totalBytes / 1048576, 2)

    Write-Host ""
    Write-Host "DONE: $zipName" -ForegroundColor Green
    $sizeLine = "  Size: {0} KB ({1} MB)" -f $totalKB, $totalMB
    Write-Host $sizeLine
    Write-Host "  Path: $zipPath"
    Write-Host ""
    Write-Host "Hosting upload steps:"
    Write-Host "  1. In your hosting control panel, open public_html (or web root)."
    Write-Host "  2. Upload $zipName, then use Extract from the file manager."
    Write-Host "  3. index.html should be at the site root (not in a subdirectory)."
    Write-Host ""
}
finally {
    if (Test-Path $staging) {
        Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
    }
}
