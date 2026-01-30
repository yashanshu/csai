# Host vLLM OpenAI-Compatible API on Google Cloud Run

This project deploys a serverless vLLM OpenAI-compatible API on Google Cloud Run with NVIDIA L4 GPU support.

## Prerequisites

1.  **Google Cloud Project**: You need an active GCP project.
2.  **Billing Enabled**: GPU usage requires billing.
3.  **Quotas**: Ensure you have quota for `NVIDIA L4 GPUs` in `asia-southeast1`.
    *   *Note: New projects often have 0 GPU quota. You may need to request an increase for "Committed L4 GPUs" or "Preemptible L4 GPUs" in the scaling area.*
4.  **CLI Tools**: Installed `gcloud` CLI.

## Files

*   `Dockerfile`: Builds the API container and runs vLLM alongside the FastAPI gateway.
*   `deploy.ps1` / `deploy.sh`: Automates the build + deploy process.
*   `teardown.ps1` / `teardown.sh`: Cleans up the Cloud Run service and image.

## How to Deploy

1.  **Open Terminal** (PowerShell on Windows or bash on macOS/Linux).
2.  **Login to Google Cloud**:
    ```powershell
    gcloud auth login
    gcloud config set project [YOUR_PROJECT_ID]
    ```
3.  **Run the script**:
    ```powershell
    ./deploy.ps1
    ```
    ```bash
    ./deploy.sh
    ```
    Set `QWEN_MODEL` or `GPT_OSS_MODEL` before running if you want to override the default model names (`Qwen/Qwen3-14B` and `openai/gpt-oss-20b`).

## Testing

Once deployed, the script will output your Service URL (e.g., `https://vllm-openai-xyz.run.app`).

Generate an API key (use the admin secret printed by the deploy script):

```bash
curl -X POST https://YOUR_SERVICE_URL/admin/generate-key \
  -H "Admin-Secret: YOUR_ADMIN_SECRET"
```

**Test using curl:**

```bash
curl -X POST https://YOUR_SERVICE_URL/v1/chat/completions -d '{
  "model": "llama3",
  "messages": [{"role":"user","content":"Explain specific impulse in one sentence."}],
  "stream": false
}' \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY"
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

### Model routing (multi-upstream)

When `VLLM_UPSTREAMS` is set, the gateway will route requests across multiple vLLM services.

Routing preference:
- Header: `X-Model-Preference: qwen3-14b` or `X-Model-Preference: gpt-oss-20b`
- Query param: `?preference=qwen3-14b`
- Body: `model` (matched against `VLLM_MODEL_ROUTE_MAP`)

Load-based routing uses round-robin (default). Override with `VLLM_ROUTING_STRATEGY=random`.
Sticky routing uses `X-Client-Id` by default and can be tuned via `VLLM_STICKY_HEADER`, `VLLM_STICKY_TTL_SECONDS`, and `VLLM_STICKY_MAX_ENTRIES`.

### Health (deep check)

```bash
curl "https://YOUR_SERVICE_URL/health?deep=true"
```

### Text-only responses

For `/v1/completions` or `/v1/chat/completions`, request plain text output with `format=text`:

```bash
curl -X POST "https://YOUR_SERVICE_URL/v1/chat/completions?format=text" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","messages":[{"role":"user","content":"One sentence please."}],"stream":true}'
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

## Troubleshooting

*   **Upstream 4xx/5xx from vLLM**: The proxy strips `Origin` and `Referer` on upstream calls. If you still see 4xx/5xx from vLLM, ensure clients call the Cloud Run service URL (not the internal vLLM port) and that `VLLM_MODEL` is correct.

