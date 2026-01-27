# Host Llama 3 (8B) on Google Cloud Run

This project deploys a serverless Llama 3 model using Ollama on Google Cloud Run with NVIDIA L4 GPU support.

## Prerequisites

1.  **Google Cloud Project**: You need an active GCP project.
2.  **Billing Enabled**: GPU usage requires billing.
3.  **Quotas**: Ensure you have quota for `NVIDIA L4 GPUs` in `us-central1`.
    *   *Note: New projects often have 0 GPU quota. You may need to request an increase for "Committed L4 GPUs" or "Preemptible L4 GPUs" in the scaling area.*
4.  **CLI Tools**: Installed `gcloud` CLI.

## Files

*   `Dockerfile`: Bakes the `llama3` model into the container so there are no download times at startup.
*   `deploy.ps1`: Automates the build and deploy process.

## How to Deploy

1.  **Open Terminal** (PowerShell or Command Prompt).
2.  **Login to Google Cloud**:
    ```powershell
    gcloud auth login
    gcloud config set project [YOUR_PROJECT_ID]
    ```
3.  **Run the script**:
    ```powershell
    ./deploy.ps1
    ```

## Testing

Once deployed, the script will output your Service URL (e.g., `https://ollama-llama3-xyz.run.app`).

**Test using curl:**

```bash
curl -X POST https://YOUR_SERVICE_URL/api/generate -d '{
  "model": "llama3",
  "prompt": "Explain specific impulse in one sentence.",
  "stream": false
}'
```

## API Features

### API key management (admin)

Generate a key (no request body required):

```bash
curl -X POST https://YOUR_SERVICE_URL/admin/generate-key \
  -H "Admin-Secret: YOUR_ADMIN_SECRET"
```

You can also use GET if your client does not send bodies:

```bash
curl https://YOUR_SERVICE_URL/admin/generate-key \
  -H "Admin-Secret: YOUR_ADMIN_SECRET"
```

Revoke a key:

```bash
curl -X POST https://YOUR_SERVICE_URL/admin/revoke-key \
  -H "Admin-Secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"YOUR_API_KEY"}'
```

Reactivate a key:

```bash
curl -X POST https://YOUR_SERVICE_URL/admin/activate-key \
  -H "Admin-Secret: YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"YOUR_API_KEY"}'
```

List keys:

```bash
curl https://YOUR_SERVICE_URL/admin/keys?limit=100 \
  -H "Admin-Secret: YOUR_ADMIN_SECRET"
```

Usage metrics:

```bash
curl "https://YOUR_SERVICE_URL/admin/usage?api_key=YOUR_API_KEY" \
  -H "Admin-Secret: YOUR_ADMIN_SECRET"
```

### Rate limits, quotas, allowlists

Configure per-key settings in the `api_keys` Firestore document:

```json
{
  "rate_limit_per_minute": 60,
  "quota_per_day": 10000,
  "allowed_models": ["llama3"],
  "max_body_bytes": 5242880
}
```

If not set, defaults come from env vars: `DEFAULT_RATE_LIMIT_PER_MINUTE`, `DEFAULT_QUOTA_PER_DAY`, `MAX_BODY_BYTES`.

### Error format and request IDs

All errors return a consistent envelope and include `X-Request-Id`:

```json
{
  "error": {
    "message": "Missing API Key",
    "code": "missing_api_key",
    "request_id": "..."
  }
}
```

Provide your own request ID by sending `X-Request-Id` in the request.

### Model discovery

```bash
curl https://YOUR_SERVICE_URL/models \
  -H "X-API-Key: YOUR_API_KEY"
```

Responses are cached in-memory for `MODELS_CACHE_TTL_SECONDS` (default 30s).

### Health (deep check)

```bash
curl "https://YOUR_SERVICE_URL/health?deep=true"
```

### Text-only responses

For `/api/generate` or `/api/chat`, request plain text output with `format=text`:

```bash
curl -X POST "https://YOUR_SERVICE_URL/api/generate?format=text" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","prompt":"One sentence please.","stream":true}'
```

You can also send `X-Response-Format: text` instead of the query string.

## Local tests

```bash
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

## Cost Note

*   **Active**: ~$1.65/hour (only when processing requests).
*   **Idle**: $0 (if scaled to 0).
*   **Cold Start**: Approx 20-30 seconds for the first request after being idle.

