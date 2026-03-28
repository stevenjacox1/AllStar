param(
    [string]$ApiBase = "http://localhost:7071/api"
)

Write-Host "Starting gallery content migration..." -ForegroundColor Green
Write-Host "API Base URL: $ApiBase" -ForegroundColor Cyan
Write-Host ""

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
    $body = @{ markdown = $markdown } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$ApiBase/gallery/$day" `
            -Method Put `
            -Body $body `
            -ContentType "application/json" `
            -UseBasicParsing `
            -ErrorAction Stop
        
        Write-Host "OK  $day" -ForegroundColor Green
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
