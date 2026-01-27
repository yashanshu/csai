#!/bin/bash
# teardown.sh - Cleanup script for Llama 3 on Cloud Run

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "$PROJECT_ID" ]; then
    echo "ERROR: GCP project is not set."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    echo "Or set: PROJECT_ID=YOUR_PROJECT_ID"
    exit 1
fi
RunRegion="asia-southeast1" 
ServiceName="ollama-llama3"
ImageName="gcr.io/$PROJECT_ID/ollama-llama3"

# Confirmation
echo -e "\033[0;31mWARNING: This will PERMANENTLY DELETE the following:\033[0m"
echo "  - Cloud Run Service: $ServiceName (Region: $RunRegion)"
echo "  - Container Image:   $ImageName"
echo ""
read -p "Are you sure you want to proceed? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

echo -e "\033[0;36m1. Deleting Cloud Run Service...\033[0m"
gcloud run services delete "$ServiceName" --region "$RunRegion" --quiet

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

echo -e "\033[0;32mCleanup complete!\033[0m"
# Line in teardown.sh:
echo -e "\033[0;33mNote: Firestore data (api_keys, api_key_usage) was NOT deleted to prevent accidental data loss.\033[0m"
echo "If you want to delete it, run: gcloud firestore databases delete --location=$RunRegion"
