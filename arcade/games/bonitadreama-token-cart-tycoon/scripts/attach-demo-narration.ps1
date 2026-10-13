param(
    [Parameter(Mandatory = $true)]
    [string]$Narration,

    [string]$Video = (Join-Path $PSScriptRoot "..\output\token-cart-tycoon-demo-ready-for-voice.mp4"),

    [string]$Output = (Join-Path $PSScriptRoot "..\output\token-cart-tycoon-demo-final.mp4")
)

$ErrorActionPreference = "Stop"

$bundledFfmpeg = "C:\Program Files\Streamlabs OBS\resources\node_modules\ffmpeg-ffprobe-static\ffmpeg.exe"
$pathFfmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty Source -First 1
$ffmpeg = @($bundledFfmpeg, $pathFfmpeg) |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
    Select-Object -First 1

if (-not $ffmpeg) {
    throw "FFmpeg was not found. Streamlabs OBS or FFmpeg must be installed."
}

$videoPath = (Resolve-Path -LiteralPath $Video).Path
$narrationPath = (Resolve-Path -LiteralPath $Narration).Path
$outputDirectory = Split-Path -Parent $Output
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$arguments = @(
    "-y",
    "-i", $videoPath,
    "-i", $narrationPath,
    "-filter_complex", "[1:a]apad[a]",
    "-map", "0:v:0",
    "-map", "[a]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    "-movflags", "+faststart",
    $Output
)

& $ffmpeg @arguments
Write-Host "Created narrated demo: $Output"
