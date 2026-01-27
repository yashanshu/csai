# deploy.ps1 - Deployment Script for Llama 3 on Cloud Run

$ErrorActionPreference = "Stop"

$PROJECT_ID = if ($env:PROJECT_ID) { $env:PROJECT_ID } else { & gcloud config get-value project 2>$null }
if (-not $PROJECT_ID) {
    Write-Host "ERROR: GCP project is not set."
    Write-Host "Run: gcloud config set project YOUR_PROJECT_ID"
    Write-Host "Or set: `$env:PROJECT_ID = `"YOUR_PROJECT_ID`""
    exit 1
}
$ACTIVE_ACCOUNT = & gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>$null
if (-not $ACTIVE_ACCOUNT) {
    Write-Host "ERROR: No active gcloud account."
    Write-Host "Run: gcloud auth login"
    exit 1
}
Write-Host "Using gcloud account: $ACTIVE_ACCOUNT"
$RunRegion = "asia-southeast1"
$ServiceName = "ollama-llama3"
$ImageName = "gcr.io/$PROJECT_ID/ollama-llama3"

# Enable Storage API (required for Cloud Build staging bucket).
Write-Host "Enabling Storage API..."
& gcloud services enable storage.googleapis.com

# Enable Firestore API
Write-Host "Enabling Firestore API..."
& gcloud services enable firestore.googleapis.com

# Create Firestore database if it doesn't exist
Write-Host "Setting up Firestore database..."
$prevErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$dbList = & gcloud --verbosity=error firestore databases list --project="$PROJECT_ID" --format="value(name)" 2>$null
$ErrorActionPreference = $prevErrorActionPreference
if (-not ($dbList -match "\(default\)")) {
    Write-Host "Creating Firestore database in Native mode..."
    & gcloud firestore databases create `
        --location="$RunRegion" `
        --type=firestore-native `
        --project="$PROJECT_ID"
    Write-Host "Firestore database created successfully!"
} else {
    Write-Host "Firestore database already exists, skipping creation."
}

# Create Admin Secret
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$ADMIN_SECRET = if ($env:ADMIN_SECRET) { $env:ADMIN_SECRET } else { "super-secret-admin-key-$timestamp" }
Write-Host "Using Admin Secret: $ADMIN_SECRET"

# Defaults for new API features (can be overridden via env vars)
$DEFAULT_RATE_LIMIT_PER_MINUTE = if ($env:DEFAULT_RATE_LIMIT_PER_MINUTE) { $env:DEFAULT_RATE_LIMIT_PER_MINUTE } else { "0" }
$DEFAULT_QUOTA_PER_DAY = if ($env:DEFAULT_QUOTA_PER_DAY) { $env:DEFAULT_QUOTA_PER_DAY } else { "0" }
$MAX_BODY_BYTES = if ($env:MAX_BODY_BYTES) { $env:MAX_BODY_BYTES } else { "5242880" }
$MODELS_CACHE_TTL_SECONDS = if ($env:MODELS_CACHE_TTL_SECONDS) { $env:MODELS_CACHE_TTL_SECONDS } else { "30" }
$IMAGE_API_URL = if ($env:IMAGE_API_URL) { $env:IMAGE_API_URL } else { "" }
$IMAGE_API_KEY = if ($env:IMAGE_API_KEY) { $env:IMAGE_API_KEY } else { "" }
$IMAGE_API_KEY_HEADER = if ($env:IMAGE_API_KEY_HEADER) { $env:IMAGE_API_KEY_HEADER } else { "" }
$IMAGE_API_KEY_PREFIX = if ($env:IMAGE_API_KEY_PREFIX) { $env:IMAGE_API_KEY_PREFIX } else { "" }
$IMAGE_TIMEOUT_SECONDS = if ($env:IMAGE_TIMEOUT_SECONDS) { $env:IMAGE_TIMEOUT_SECONDS } else { "" }

Write-Host "1. Building the container image..." -ForegroundColor Cyan
& gcloud builds submit --tag "$ImageName" .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Exiting."
    exit 1
}

Write-Host "2. Deploying to Cloud Run..." -ForegroundColor Cyan
& gcloud run deploy "$ServiceName" `
  --image "$ImageName" `
  --region "asia-southeast1" `
  --platform managed `
  --allow-unauthenticated `
  --execution-environment gen2 `
  --no-cpu-throttling `
  --cpu 8 `
  --memory 32Gi `
  --gpu 1 `
  --gpu-type nvidia-l4 `
  --no-gpu-zonal-redundancy `
  --max-instances 1 `
  --concurrency 100 `
  --timeout 3600 `
  --set-env-vars "ADMIN_SECRET=$ADMIN_SECRET,DEFAULT_RATE_LIMIT_PER_MINUTE=$DEFAULT_RATE_LIMIT_PER_MINUTE,DEFAULT_QUOTA_PER_DAY=$DEFAULT_QUOTA_PER_DAY,MAX_BODY_BYTES=$MAX_BODY_BYTES,MODELS_CACHE_TTL_SECONDS=$MODELS_CACHE_TTL_SECONDS,IMAGE_API_URL=$IMAGE_API_URL,IMAGE_API_KEY=$IMAGE_API_KEY,IMAGE_API_KEY_HEADER=$IMAGE_API_KEY_HEADER,IMAGE_API_KEY_PREFIX=$IMAGE_API_KEY_PREFIX,IMAGE_TIMEOUT_SECONDS=$IMAGE_TIMEOUT_SECONDS"

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Admin Secret: $ADMIN_SECRET" -ForegroundColor Yellow
$serviceUrl = & gcloud run services describe "$ServiceName" --region="$RunRegion" --format="value(status.url)"
Write-Host "Service URL: $serviceUrl"
