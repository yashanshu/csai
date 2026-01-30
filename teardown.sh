#!/bin/bash
# teardown.sh - Cleanup script for vLLM OpenAI-compatible API on Cloud Run

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "$PROJECT_ID" ]; then
    echo "ERROR: GCP project is not set."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    echo "Or set: PROJECT_ID=YOUR_PROJECT_ID"
    exit 1
fi
RunRegion="asia-southeast1"
QwenServiceName="vllm-qwen3-14b"
GatewayServiceName="vllm-gateway"
ImageName="gcr.io/$PROJECT_ID/vllm-openai"
ModelBucket="${MODEL_BUCKET:-$PROJECT_ID-vllm-models}"

# Confirmation
echo -e "\033[0;31mWARNING: This will PERMANENTLY DELETE the following:\033[0m"
echo "  - Cloud Run Service: $QwenServiceName (Region: $RunRegion)"
echo "  - Cloud Run Service: $GatewayServiceName (Region: $RunRegion)"
echo "  - Container Image:   $ImageName"
echo "  - Model Cache Bucket: gs://$ModelBucket"
echo "  - Firestore Database: (default)"
echo ""
read -p "Are you sure you want to proceed? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

echo -e "\033[0;36m1. Deleting Cloud Run Service...\033[0m"
gcloud run services delete "$QwenServiceName" --region "$RunRegion" --quiet
gcloud run services delete "$GatewayServiceName" --region "$RunRegion" --quiet

if [ $? -eq 0 ]; then
    echo "Service deleted successfully."
else
    echo "Service deletion failed or service not found."
fi

echo -e "\033[0;36m2. Deleting Container Image...\033[0m"
# Delete the specific image tag (latest) and the image itself if possible
# Alternatively, delete all tags. 
gcloud container images delete "$ImageName" --force-delete-tags --quiet

if [ $? -eq 0 ]; then
    echo "Image deleted successfully."
else
    echo "Image deletion failed or image not found."
fi

echo -e "\033[0;36m3. Deleting Model Cache Bucket...\033[0m"
gcloud storage rm -r "gs://$ModelBucket/**" >/dev/null 2>&1
gcloud storage buckets delete "gs://$ModelBucket" --quiet >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Model cache bucket deleted successfully."
else
    echo "Model cache bucket deletion failed or bucket not found."
fi

echo -e "\033[0;36m4. Deleting Firestore Database...\033[0m"
gcloud firestore databases delete --database="(default)" --project="$PROJECT_ID" --quiet >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "Firestore database deleted successfully."
else
    echo "Firestore database deletion failed or database not found."
fi

echo -e "\033[0;32mCleanup complete!\033[0m"
