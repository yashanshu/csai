# teardown.ps1 - Cleanup script for Llama 3 on Cloud Run

$PROJECT_ID = if ($env:PROJECT_ID) { $env:PROJECT_ID } else { & gcloud config get-value project 2>$null }
if (-not $PROJECT_ID) {
    Write-Host "ERROR: GCP project is not set."
    Write-Host "Run: gcloud config set project YOUR_PROJECT_ID"
    Write-Host "Or set: `$env:PROJECT_ID = `"YOUR_PROJECT_ID`""
    exit 1
}
$RunRegion = "asia-southeast1"
$ServiceName = "ollama-llama3"
$ImageName = "gcr.io/$PROJECT_ID/ollama-llama3"

# Confirmation
Write-Host "WARNING: This will PERMANENTLY DELETE the following:" -ForegroundColor Red
Write-Host "  - Cloud Run Service: $ServiceName (Region: $RunRegion)"
Write-Host "  - Container Image:   $ImageName"
Write-Host ""
$confirm = Read-Host "Are you sure you want to proceed? (y/N)"

if ($confirm -notin @("y", "Y")) {
    Write-Host "Aborted."
    exit 0
}

Write-Host "1. Deleting Cloud Run Service..." -ForegroundColor Cyan
& gcloud run services delete "$ServiceName" --region "$RunRegion" --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "Service deleted successfully."
} else {
    Write-Host "Service deletion failed or service not found."
}

Write-Host "2. Deleting Container Image..." -ForegroundColor Cyan
# Delete the specific image tag (latest) and the image itself if possible
# Alternatively, delete all tags.
& gcloud container images delete "$ImageName" --force-delete-tags --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "Image deleted successfully."
} else {
    Write-Host "Image deletion failed or image not found."
}

Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host "Note: Firestore data (api_keys, api_key_usage) was NOT deleted to prevent accidental data loss." -ForegroundColor Yellow
Write-Host "If you want to delete it, run: gcloud firestore databases delete --location=$RunRegion"
