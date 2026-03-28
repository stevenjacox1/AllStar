param(
    [string]$ApiBase = "http://localhost:7071/api"
)

Write-Host "Starting gallery content migration..." -ForegroundColor Green
Write-Host "API Base URL: $ApiBase" -ForegroundColor Cyan
Write-Host ""

$converterScript = Join-Path $PSScriptRoot "scripts/markdown-to-html.mjs"
if (-not (Test-Path $converterScript)) {
    Write-Host "Missing markdown converter script: $converterScript" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is required to convert markdown to HTML for migration." -ForegroundColor Red
    exit 1
}

$success = 0
$failed = 0
$galleryDetailsDir = Join-Path $PSScriptRoot "public/gallery-details"
$days = @('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')

foreach ($day in $days) {
    $markdownPath = Join-Path $galleryDetailsDir "$day.md"

    if (-not (Test-Path $markdownPath)) {
        Write-Host "SKIP $day" -ForegroundColor Yellow
        Write-Host "     Missing file: $markdownPath" -ForegroundColor Yellow
        $failed++
        continue
    }

    $markdown = [System.IO.File]::ReadAllText($markdownPath)
    $htmlResult = $markdown | node $converterScript
    $html = if ($htmlResult -is [array]) { $htmlResult -join "`n" } else { [string]$htmlResult }

    if ([string]::IsNullOrWhiteSpace($html)) {
        Write-Host "FAIL $day" -ForegroundColor Red
        Write-Host "     Markdown to HTML conversion returned empty output" -ForegroundColor Yellow
        $failed++
        continue
    }

    $body = @{ html = $html } | ConvertTo-Json -Depth 4
    
    try {
        Invoke-WebRequest -Uri "$ApiBase/gallery/$day" `
            -Method Put `
            -Body $body `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction Stop | Out-Null
        
        Write-Host "OK  $day (converted markdown to HTML)" -ForegroundColor Green
        $success++
    }
    catch {
        Write-Host "FAIL $day" -ForegroundColor Red
        Write-Host "     $($_.Exception.Message)" -ForegroundColor Yellow
        $failed++
    }
}

Write-Host ""
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "  Successful: $success"
Write-Host "  Failed: $failed"

if ($failed -eq 0) {
    Write-Host "All gallery content migrated to Azure Table Storage." -ForegroundColor Green
}
