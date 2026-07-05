$ErrorActionPreference = "Stop"

$root = Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\holo-singer-frames"
$actions = @(
  "idle",
  "groove",
  "sing",
  "chorus",
  "drop",
  "wave",
  "point",
  "clap",
  "transition"
)
$expectedFrames = 16
$hasError = $false

Add-Type -AssemblyName System.Drawing

foreach ($action in $actions) {
  $folder = Join-Path $root $action

  if (-not (Test-Path $folder)) {
    Write-Host "Missing folder: $action" -ForegroundColor Red
    $hasError = $true
    continue
  }

  $sizes = @{}

  for ($index = 1; $index -le $expectedFrames; $index += 1) {
    $fileName = "{0}-{1:D2}.png" -f $action, $index
    $filePath = Join-Path $folder $fileName

    if (-not (Test-Path $filePath)) {
      Write-Host "Missing frame: $action/$fileName" -ForegroundColor Red
      $hasError = $true
      continue
    }

    $image = [System.Drawing.Image]::FromFile($filePath)
    $sizeKey = "{0}x{1}" -f $image.Width, $image.Height
    $image.Dispose()
    $sizes[$sizeKey] = ($sizes[$sizeKey] + 1)
  }

  if ($sizes.Keys.Count -gt 1) {
    Write-Host "Mixed sizes in ${action}: $($sizes.Keys -join ', ')" -ForegroundColor Yellow
    $hasError = $true
  } elseif ($sizes.Keys.Count -eq 1) {
    $sizeKey = @($sizes.Keys)[0]
    Write-Host ("OK {0}: {1} frames, {2}" -f $action, $expectedFrames, $sizeKey) -ForegroundColor Green
  }
}

if ($hasError) {
  exit 1
}

Write-Host "All AI singer frame packs are ready." -ForegroundColor Green
