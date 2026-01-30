#!/bin/bash
# deploy.sh - Deployment Script for vLLM OpenAI-compatible API on Cloud Run

set -e
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "$PROJECT_ID" ]; then
    echo "ERROR: GCP project is not set."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    echo "Or set: PROJECT_ID=YOUR_PROJECT_ID"
    exit 1
fi
ACTIVE_ACCOUNT=$(gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "ERROR: No active gcloud account."
    echo "Run: gcloud auth login"
    exit 1
fi
echo "Using gcloud account: $ACTIVE_ACCOUNT"
RunRegion="asia-southeast1"
ImageName="gcr.io/$PROJECT_ID/vllm-openai"
QwenServiceName="vllm-qwen3-14b"
GptOssServiceName="vllm-gpt-oss-20b"
GatewayServiceName="vllm-gateway"
ModelBucket="${MODEL_BUCKET:-$PROJECT_ID-vllm-models}"
ModelMountPath="${MODEL_MOUNT_PATH:-/mnt/models}"

# Enable Storage API (required for Cloud Build staging bucket).
echo "Enabling Storage API..."
gcloud services enable storage.googleapis.com

# Enable Firestore API
echo "Enabling Firestore API..."
gcloud services enable firestore.googleapis.com

# Create Firestore database if it doesn't exist
echo "Setting up Firestore database..."
if ! gcloud firestore databases list --project="$PROJECT_ID" 2>/dev/null | grep -q "(default)"; then
    echo "Creating Firestore database in Native mode..."
    gcloud firestore databases create \
        --location="$RunRegion" \
        --type=firestore-native \
        --project="$PROJECT_ID"
    echo "Firestore database created successfully!"
else
    echo "Firestore database already exists, skipping creation."
fi

# Create model cache bucket if it doesn't exist
echo "Ensuring model cache bucket exists..."
if ! gcloud storage buckets describe "gs://$ModelBucket" >/dev/null 2>&1; then
    echo "Creating bucket gs://$ModelBucket in $RunRegion..."
    gcloud storage buckets create "gs://$ModelBucket" --location="$RunRegion" --uniform-bucket-level-access
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create bucket gs://$ModelBucket. Set MODEL_BUCKET to a unique name."
        exit 1
    fi
else
    echo "Bucket gs://$ModelBucket already exists, skipping creation."
fi

# Create Admin Secret
ADMIN_SECRET=${ADMIN_SECRET:-"super-secret-admin-key-$(date +%s)"}
echo "Using Admin Secret: $ADMIN_SECRET"

# Defaults for new API features (can be overridden via env vars)
DEFAULT_RATE_LIMIT_PER_MINUTE=${DEFAULT_RATE_LIMIT_PER_MINUTE:-0}
DEFAULT_QUOTA_PER_DAY=${DEFAULT_QUOTA_PER_DAY:-0}
MAX_BODY_BYTES=${MAX_BODY_BYTES:-5242880}
MODELS_CACHE_TTL_SECONDS=${MODELS_CACHE_TTL_SECONDS:-30}
IMAGE_API_URL=${IMAGE_API_URL:-}
IMAGE_API_KEY=${IMAGE_API_KEY:-}
IMAGE_API_KEY_HEADER=${IMAGE_API_KEY_HEADER:-}
IMAGE_API_KEY_PREFIX=${IMAGE_API_KEY_PREFIX:-}
IMAGE_TIMEOUT_SECONDS=${IMAGE_TIMEOUT_SECONDS:-}
VLLM_MODEL=${VLLM_MODEL:-"llama3"}
VLLM_HOST=${VLLM_HOST:-"0.0.0.0"}
VLLM_PORT=${VLLM_PORT:-8000}
VLLM_ARGS=${VLLM_ARGS:-}
QWEN_MODEL=${QWEN_MODEL:-"Qwen/Qwen3-14B"}
GPT_OSS_MODEL=${GPT_OSS_MODEL:-"openai/gpt-oss-20b"}
VLLM_ARGS_QWEN=${VLLM_ARGS_QWEN:-$VLLM_ARGS}
VLLM_ARGS_GPT=${VLLM_ARGS_GPT:-$VLLM_ARGS}
VLLM_ROUTING_STRATEGY=${VLLM_ROUTING_STRATEGY:-"round_robin"}

echo -e "\033[0;36m1. Building the container image...\033[0m"
gcloud builds submit --tag "$ImageName" .

if [ $? -ne 0 ]; then
    echo "Build failed. Exiting."
    exit 1
fi

echo -e "\033[0;36m2. Deploying Qwen3-14B service...\033[0m"
gcloud run deploy "$QwenServiceName" \
  --image "$ImageName" \
  --region "$RunRegion" \
  --platform managed \
  --allow-unauthenticated \
  --execution-environment gen2 \
  --no-cpu-throttling \
  --cpu 8 \
  --memory 32Gi \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --no-gpu-zonal-redundancy \
  --max-instances 1 \
  --concurrency 100 \
  --timeout 3600 \
  --add-volume "name=model-cache,type=cloud-storage,bucket=$ModelBucket" \
  --add-volume-mount "volume=model-cache,mount-path=$ModelMountPath" \
  --set-env-vars "ADMIN_SECRET=$ADMIN_SECRET,DEFAULT_RATE_LIMIT_PER_MINUTE=$DEFAULT_RATE_LIMIT_PER_MINUTE,DEFAULT_QUOTA_PER_DAY=$DEFAULT_QUOTA_PER_DAY,MAX_BODY_BYTES=$MAX_BODY_BYTES,MODELS_CACHE_TTL_SECONDS=$MODELS_CACHE_TTL_SECONDS,IMAGE_API_URL=$IMAGE_API_URL,IMAGE_API_KEY=$IMAGE_API_KEY,IMAGE_API_KEY_HEADER=$IMAGE_API_KEY_HEADER,IMAGE_API_KEY_PREFIX=$IMAGE_API_KEY_PREFIX,IMAGE_TIMEOUT_SECONDS=$IMAGE_TIMEOUT_SECONDS,MODEL_CACHE_DIR=$ModelMountPath,VLLM_MODEL=$QWEN_MODEL,VLLM_HOST=$VLLM_HOST,VLLM_PORT=$VLLM_PORT,VLLM_ARGS=$VLLM_ARGS_QWEN"

echo -e "\033[0;36m3. Deploying GPT OSS 20B service...\033[0m"
gcloud run deploy "$GptOssServiceName" \
  --image "$ImageName" \
  --region "$RunRegion" \
  --platform managed \
  --allow-unauthenticated \
  --execution-environment gen2 \
  --no-cpu-throttling \
  --cpu 8 \
  --memory 32Gi \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --no-gpu-zonal-redundancy \
  --max-instances 1 \
  --concurrency 100 \
  --timeout 3600 \
  --add-volume "name=model-cache,type=cloud-storage,bucket=$ModelBucket" \
  --add-volume-mount "volume=model-cache,mount-path=$ModelMountPath" \
  --set-env-vars "ADMIN_SECRET=$ADMIN_SECRET,DEFAULT_RATE_LIMIT_PER_MINUTE=$DEFAULT_RATE_LIMIT_PER_MINUTE,DEFAULT_QUOTA_PER_DAY=$DEFAULT_QUOTA_PER_DAY,MAX_BODY_BYTES=$MAX_BODY_BYTES,MODELS_CACHE_TTL_SECONDS=$MODELS_CACHE_TTL_SECONDS,IMAGE_API_URL=$IMAGE_API_URL,IMAGE_API_KEY=$IMAGE_API_KEY,IMAGE_API_KEY_HEADER=$IMAGE_API_KEY_HEADER,IMAGE_API_KEY_PREFIX=$IMAGE_API_KEY_PREFIX,IMAGE_TIMEOUT_SECONDS=$IMAGE_TIMEOUT_SECONDS,MODEL_CACHE_DIR=$ModelMountPath,VLLM_MODEL=$GPT_OSS_MODEL,VLLM_HOST=$VLLM_HOST,VLLM_PORT=$VLLM_PORT,VLLM_ARGS=$VLLM_ARGS_GPT"

QWEN_URL=$(gcloud run services describe "$QwenServiceName" --region="$RunRegion" --format='value(status.url)')
GPT_URL=$(gcloud run services describe "$GptOssServiceName" --region="$RunRegion" --format='value(status.url)')

echo -e "\033[0;36m4. Deploying gateway service...\033[0m"
VLLM_MODEL_ROUTE_MAP="${QWEN_MODEL,,}=$QWEN_URL,${GPT_OSS_MODEL,,}=$GPT_URL"
VLLM_UPSTREAMS="$QWEN_URL,$GPT_URL"
gcloud run deploy "$GatewayServiceName" \
  --image "$ImageName" \
  --region "$RunRegion" \
  --platform managed \
  --allow-unauthenticated \
  --execution-environment gen2 \
  --no-cpu-throttling \
  --cpu 2 \
  --memory 4Gi \
  --max-instances 2 \
  --concurrency 200 \
  --timeout 3600 \
  --set-env-vars "ADMIN_SECRET=$ADMIN_SECRET,DEFAULT_RATE_LIMIT_PER_MINUTE=$DEFAULT_RATE_LIMIT_PER_MINUTE,DEFAULT_QUOTA_PER_DAY=$DEFAULT_QUOTA_PER_DAY,MAX_BODY_BYTES=$MAX_BODY_BYTES,MODELS_CACHE_TTL_SECONDS=$MODELS_CACHE_TTL_SECONDS,IMAGE_API_URL=$IMAGE_API_URL,IMAGE_API_KEY=$IMAGE_API_KEY,IMAGE_API_KEY_HEADER=$IMAGE_API_KEY_HEADER,IMAGE_API_KEY_PREFIX=$IMAGE_API_KEY_PREFIX,IMAGE_TIMEOUT_SECONDS=$IMAGE_TIMEOUT_SECONDS,VLLM_DISABLE_LOCAL=1,VLLM_UPSTREAMS=$VLLM_UPSTREAMS,VLLM_MODEL_ROUTE_MAP=$VLLM_MODEL_ROUTE_MAP,VLLM_ROUTING_STRATEGY=$VLLM_ROUTING_STRATEGY"

echo -e "\033[0;32mDeployment complete!\033[0m"
echo -e "\033[0;33mAdmin Secret: $ADMIN_SECRET\033[0m"
echo "Qwen3-14B URL: $QWEN_URL"
echo "GPT OSS 20B URL: $GPT_URL"
echo "Gateway URL: $(gcloud run services describe $GatewayServiceName --region=$RunRegion --format='value(status.url)')"
