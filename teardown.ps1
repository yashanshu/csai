# teardown.ps1 - Cleanup script for vLLM OpenAI-compatible API on Cloud Run

$PROJECT_ID = if ($env:PROJECT_ID) { $env:PROJECT_ID } else { & gcloud config get-value project 2>$null }
if (-not $PROJECT_ID) {
    Write-Host "ERROR: GCP project is not set."
    Write-Host "Run: gcloud config set project YOUR_PROJECT_ID"
    Write-Host "Or set: `$env:PROJECT_ID = `"YOUR_PROJECT_ID`""
    exit 1
}
$RunRegion = "asia-southeast1"
$QwenServiceName = "vllm-qwen3-14b"
$GptOssServiceName = "vllm-gpt-oss-20b"
$GatewayServiceName = "vllm-gateway"
$ImageName = "gcr.io/$PROJECT_ID/vllm-openai"
$ModelBucket = if ($env:MODEL_BUCKET) { $env:MODEL_BUCKET } else { "$PROJECT_ID-vllm-models" }

# Confirmation
Write-Host "WARNING: This will PERMANENTLY DELETE the following:" -ForegroundColor Red
Write-Host "  - Cloud Run Service: $QwenServiceName (Region: $RunRegion)"
Write-Host "  - Cloud Run Service: $GptOssServiceName (Region: $RunRegion)"
Write-Host "  - Cloud Run Service: $GatewayServiceName (Region: $RunRegion)"
Write-Host "  - Container Image:   $ImageName"
Write-Host "  - Model Cache Bucket: gs://$ModelBucket"
Write-Host "  - Firestore Database: (default)"
Write-Host ""
$confirm = Read-Host "Are you sure you want to proceed? (y/N)"

if ($confirm -notin @("y", "Y")) {
    Write-Host "Aborted."
    exit 0
}

Write-Host "1. Deleting Cloud Run Service..." -ForegroundColor Cyan
& gcloud run services delete "$QwenServiceName" --region "$RunRegion" --quiet
& gcloud run services delete "$GptOssServiceName" --region "$RunRegion" --quiet
& gcloud run services delete "$GatewayServiceName" --region "$RunRegion" --quiet

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

Write-Host "3. Deleting Model Cache Bucket..." -ForegroundColor Cyan
& gcloud storage rm -r "gs://$ModelBucket/**" 2>$null
& gcloud storage buckets delete "gs://$ModelBucket" --quiet 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Model cache bucket deleted successfully."
} else {
    Write-Host "Model cache bucket deletion failed or bucket not found."
}

Write-Host "4. Deleting Firestore Database..." -ForegroundColor Cyan
& gcloud firestore databases delete --database="(default)" --project="$PROJECT_ID" --quiet 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Firestore database deleted successfully."
} else {
    Write-Host "Firestore database deletion failed or database not found."
}

Write-Host "Cleanup complete!" -ForegroundColor Green
