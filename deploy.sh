#!/bin/bash
# deploy.sh - Deployment Script for Llama 3 on Cloud Run

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
ServiceName="ollama-llama3"
ImageName="gcr.io/$PROJECT_ID/ollama-llama3"

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

echo -e "\033[0;36m1. Building the container image...\033[0m"
gcloud builds submit --tag "$ImageName" .

if [ $? -ne 0 ]; then
    echo "Build failed. Exiting."
    exit 1
fi

echo -e "\033[0;36m2. Deploying to Cloud Run...\033[0m"
gcloud run deploy "$ServiceName" \
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
  --set-env-vars "ADMIN_SECRET=$ADMIN_SECRET,DEFAULT_RATE_LIMIT_PER_MINUTE=$DEFAULT_RATE_LIMIT_PER_MINUTE,DEFAULT_QUOTA_PER_DAY=$DEFAULT_QUOTA_PER_DAY,MAX_BODY_BYTES=$MAX_BODY_BYTES,MODELS_CACHE_TTL_SECONDS=$MODELS_CACHE_TTL_SECONDS,IMAGE_API_URL=$IMAGE_API_URL,IMAGE_API_KEY=$IMAGE_API_KEY,IMAGE_API_KEY_HEADER=$IMAGE_API_KEY_HEADER,IMAGE_API_KEY_PREFIX=$IMAGE_API_KEY_PREFIX,IMAGE_TIMEOUT_SECONDS=$IMAGE_TIMEOUT_SECONDS"

echo -e "\033[0;32mDeployment complete!\033[0m"
echo -e "\033[0;33mAdmin Secret: $ADMIN_SECRET\033[0m"
echo "Service URL: $(gcloud run services describe $ServiceName --region=$RunRegion --format='value(status.url)')"
