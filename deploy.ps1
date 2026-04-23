# Rideout deploy helper
# Usage:  .\deploy.ps1 "your commit message"
#   or:   .\deploy.ps1              (uses a default message)

param(
    [string]$Message = "Update site"
)

Write-Host ""
Write-Host "Deploying Rideout..." -ForegroundColor Magenta
Write-Host "Message: $Message" -ForegroundColor DarkGray
Write-Host ""

git add .
if ($LASTEXITCODE -ne 0) { Write-Host "git add failed" -ForegroundColor Red; exit 1 }

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Nothing to commit (no changes since last deploy)." -ForegroundColor Yellow
    exit 0
}

git push
if ($LASTEXITCODE -ne 0) { Write-Host "git push failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "Done. Vercel is building now." -ForegroundColor Green
Write-Host "Live in ~40s at: https://rideout-lilac.vercel.app" -ForegroundColor Cyan
Write-Host ""
