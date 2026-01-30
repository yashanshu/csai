# deploy.ps1 - Deployment Script for vLLM OpenAI-compatible API on Cloud Run

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
$ImageName = "gcr.io/$PROJECT_ID/vllm-openai"
$QwenServiceName = "vllm-qwen3-14b"
$GptOssServiceName = "vllm-gpt-oss-20b"
$GatewayServiceName = "vllm-gateway"
$ModelBucket = if ($env:MODEL_BUCKET) { $env:MODEL_BUCKET } else { "$PROJECT_ID-vllm-models" }
$ModelMountPath = if ($env:MODEL_MOUNT_PATH) { $env:MODEL_MOUNT_PATH } else { "/mnt/models" }
$QWEN_CPU = if ($env:QWEN_CPU) { $env:QWEN_CPU } else { "8" }
$QWEN_MEMORY = if ($env:QWEN_MEMORY) { $env:QWEN_MEMORY } else { "32Gi" }
$GATEWAY_CPU = if ($env:GATEWAY_CPU) { $env:GATEWAY_CPU } else { "1" }
$GATEWAY_MEMORY = if ($env:GATEWAY_MEMORY) { $env:GATEWAY_MEMORY } else { "512Mi" }

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

# Create model cache bucket if it doesn't exist
Write-Host "Ensuring model cache bucket exists..."
$prevErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& gcloud storage buckets describe "gs://$ModelBucket" 2>$null
$bucketExists = $LASTEXITCODE -eq 0
$ErrorActionPreference = $prevErrorActionPreference
if (-not $bucketExists) {
    Write-Host "Creating bucket gs://$ModelBucket in $RunRegion..."
    & gcloud storage buckets create "gs://$ModelBucket" --location="$RunRegion" --uniform-bucket-level-access
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to create bucket gs://$ModelBucket. Set MODEL_BUCKET to a unique name."
        exit 1
    }
} else {
    Write-Host "Bucket gs://$ModelBucket already exists, skipping creation."
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
$VLLM_MODEL = if ($env:VLLM_MODEL) { $env:VLLM_MODEL } else { "llama3" }
$VLLM_HOST = if ($env:VLLM_HOST) { $env:VLLM_HOST } else { "0.0.0.0" }
$VLLM_PORT = if ($env:VLLM_PORT) { $env:VLLM_PORT } else { "8000" }
$VLLM_ARGS = if ($env:VLLM_ARGS) { $env:VLLM_ARGS } else { "" }
$QWEN_MODEL = if ($env:QWEN_MODEL) { $env:QWEN_MODEL } else { "Qwen/Qwen3-14B" }
$GPT_OSS_MODEL = if ($env:GPT_OSS_MODEL) { $env:GPT_OSS_MODEL } else { "openai/gpt-oss-20b" }
# Qwen3-14B memory profiles (adjust as needed):
# Balanced (default): 4k ctx, moderate concurrency
#   --max-model-len 4096 --max-num-seqs 12 --max-num-batched-tokens 4096
# Long ctx / low concurrency:
#   --max-model-len 8192 --max-num-seqs 6 --max-num-batched-tokens 2048
# Higher concurrency / short ctx:
#   --max-model-len 2048 --max-num-seqs 24 --max-num-batched-tokens 4096
$VLLM_ARGS_QWEN_DEFAULT = "--quantization bitsandbytes --gpu-memory-utilization 0.88 --max-model-len 4096 --max-num-seqs 12 --max-num-batched-tokens 4096 --swap-space 8"
$VLLM_ARGS_QWEN = if ($env:VLLM_ARGS_QWEN) { $env:VLLM_ARGS_QWEN } elseif ($env:VLLM_ARGS) { $env:VLLM_ARGS } else { $VLLM_ARGS_QWEN_DEFAULT }
$VLLM_ARGS_GPT = if ($env:VLLM_ARGS_GPT) { $env:VLLM_ARGS_GPT } else { $VLLM_ARGS }
$VLLM_ROUTING_STRATEGY = if ($env:VLLM_ROUTING_STRATEGY) { $env:VLLM_ROUTING_STRATEGY } else { "round_robin" }

Write-Host "1. Building the container image..." -ForegroundColor Cyan
& gcloud builds submit --tag "$ImageName" .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Exiting."
    exit 1
}

Write-Host "2. Deploying Qwen3-14B service..." -ForegroundColor Cyan
& gcloud run deploy "$QwenServiceName" `
  --image "$ImageName" `
  --region "asia-southeast1" `
  --platform managed `
  --allow-unauthenticated `
  --execution-environment gen2 `
  --no-cpu-throttling `
  --cpu $QWEN_CPU `
  --memory $QWEN_MEMORY `
  --gpu 1 `
  --gpu-type nvidia-l4 `
  --no-gpu-zonal-redundancy `
  --max-instances 1 `
  --concurrency 100 `
  --timeout 3600 `
  --add-volume "name=model-cache,type=cloud-storage,bucket=$ModelBucket" `
  --add-volume-mount "volume=model-cache,mount-path=$ModelMountPath" `
  --set-env-vars "ADMIN_SECRET=$ADMIN_SECRET,DEFAULT_RATE_LIMIT_PER_MINUTE=$DEFAULT_RATE_LIMIT_PER_MINUTE,DEFAULT_QUOTA_PER_DAY=$DEFAULT_QUOTA_PER_DAY,MAX_BODY_BYTES=$MAX_BODY_BYTES,MODELS_CACHE_TTL_SECONDS=$MODELS_CACHE_TTL_SECONDS,IMAGE_API_URL=$IMAGE_API_URL,IMAGE_API_KEY=$IMAGE_API_KEY,IMAGE_API_KEY_HEADER=$IMAGE_API_KEY_HEADER,IMAGE_API_KEY_PREFIX=$IMAGE_API_KEY_PREFIX,IMAGE_TIMEOUT_SECONDS=$IMAGE_TIMEOUT_SECONDS,MODEL_CACHE_DIR=$ModelMountPath,VLLM_MODEL=$QWEN_MODEL,VLLM_HOST=$VLLM_HOST,VLLM_PORT=$VLLM_PORT,VLLM_ARGS=$VLLM_ARGS_QWEN"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Qwen deploy failed; skipping URL lookup."
    $QWEN_URL = ""
} else {
    $QWEN_URL = & gcloud run services describe "$QwenServiceName" --region="$RunRegion" --format="value(status.url)"
}

$Upstreams = @()
$RouteMapPairs = @()
if ($QWEN_URL) {
    $Upstreams += $QWEN_URL
    $RouteMapPairs += "$($QWEN_MODEL.ToLower())=$QWEN_URL"
}

if ($Upstreams.Count -gt 0) {
    $VLLM_MODEL_ROUTE_MAP = $RouteMapPairs -join ","
    $VLLM_UPSTREAMS = $Upstreams -join ","
} else {
    $VLLM_MODEL_ROUTE_MAP = ""
    $VLLM_UPSTREAMS = ""
}

Write-Host "4. Deploying gateway service..." -ForegroundColor Cyan
if (-not $VLLM_UPSTREAMS) {
    Write-Host "No upstream services available. Skipping gateway deploy."
} else {
    & gcloud run deploy "$GatewayServiceName" `
      --image "$ImageName" `
      --region "asia-southeast1" `
      --platform managed `
      --allow-unauthenticated `
      --execution-environment gen2 `
      --no-cpu-throttling `
      --cpu $GATEWAY_CPU `
      --memory $GATEWAY_MEMORY `
      --max-instances 2 `
      --concurrency 200 `
      --timeout 3600 `
      --set-env-vars "ADMIN_SECRET=$ADMIN_SECRET,DEFAULT_RATE_LIMIT_PER_MINUTE=$DEFAULT_RATE_LIMIT_PER_MINUTE,DEFAULT_QUOTA_PER_DAY=$DEFAULT_QUOTA_PER_DAY,MAX_BODY_BYTES=$MAX_BODY_BYTES,MODELS_CACHE_TTL_SECONDS=$MODELS_CACHE_TTL_SECONDS,IMAGE_API_URL=$IMAGE_API_URL,IMAGE_API_KEY=$IMAGE_API_KEY,IMAGE_API_KEY_HEADER=$IMAGE_API_KEY_HEADER,IMAGE_API_KEY_PREFIX=$IMAGE_API_KEY_PREFIX,IMAGE_TIMEOUT_SECONDS=$IMAGE_TIMEOUT_SECONDS,VLLM_DISABLE_LOCAL=1,VLLM_UPSTREAMS=$VLLM_UPSTREAMS,VLLM_MODEL_ROUTE_MAP=$VLLM_MODEL_ROUTE_MAP,VLLM_ROUTING_STRATEGY=$VLLM_ROUTING_STRATEGY"
}

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Admin Secret: $ADMIN_SECRET" -ForegroundColor Yellow
Write-Host "Qwen3-14B URL: $QWEN_URL"
if ($VLLM_UPSTREAMS) {
    $gatewayUrl = & gcloud run services describe "$GatewayServiceName" --region="$RunRegion" --format="value(status.url)"
    Write-Host "Gateway URL: $gatewayUrl"
} else {
    Write-Host "Gateway URL: (not deployed)"
}
