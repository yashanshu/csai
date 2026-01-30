#!/bin/bash

# Start vLLM in the background (OpenAI-compatible server) unless disabled.
: "${VLLM_MODEL:=llama3}"
: "${VLLM_HOST:=0.0.0.0}"
: "${VLLM_PORT:=8000}"
: "${VLLM_ARGS:=}"
: "${VLLM_DISABLE_LOCAL:=}"
: "${PYTORCH_CUDA_ALLOC_CONF:=expandable_segments:True}"
export PYTORCH_CUDA_ALLOC_CONF

# Persistent model cache (mounted volume recommended).
: "${MODEL_CACHE_DIR:=/mnt/models}"
: "${HF_HOME:=$MODEL_CACHE_DIR/hf}"
: "${HF_HUB_CACHE:=$HF_HOME/hub}"
: "${TRANSFORMERS_CACHE:=$HF_HOME/transformers}"
export HF_HOME HF_HUB_CACHE TRANSFORMERS_CACHE

START_TS=$(date +%s)

mkdir -p "$HF_HUB_CACHE" "$TRANSFORMERS_CACHE" 2>/dev/null || true
if ! (touch "$HF_HOME/.write-test" 2>/dev/null && rm -f "$HF_HOME/.write-test" 2>/dev/null); then
  echo "Warning: model cache is not writable at $HF_HOME"
fi

: "${PREFETCH_BLOCKING:=0}"

prefetch_model() {
  if [ -z "$VLLM_MODEL" ]; then
    echo "No VLLM_MODEL set; skipping prefetch."
    return 0
  fi

  if [ -d "$VLLM_MODEL" ] || [ -f "$VLLM_MODEL" ]; then
    echo "VLLM_MODEL looks like a local path; skipping prefetch: $VLLM_MODEL"
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not found; skipping prefetch."
    return 0
  fi

  echo "Prefetching model to cache: $VLLM_MODEL"
  prefetch_start=$(date +%s)
  if python3 - <<'PY'
import os
import time

model_id = os.environ.get("VLLM_MODEL")
if not model_id:
    raise SystemExit(0)

start = time.time()
try:
    from huggingface_hub import snapshot_download

    # Try local-only first to avoid network calls on warm starts.
    try:
        snapshot_download(repo_id=model_id, local_files_only=True)
        print(f"Model cache hit for {model_id}")
    except Exception:
        print(f"Model cache miss for {model_id}; downloading...")
        snapshot_download(repo_id=model_id, local_files_only=False)
        print(f"Model download complete for {model_id}")
except Exception as e:
    print(f"Prefetch skipped (error: {e})")

elapsed = time.time() - start
print(f"Prefetch step finished in {elapsed:.2f}s")
PY
  then
    prefetch_rc=0
  else
    prefetch_rc=$?
  fi
  prefetch_end=$(date +%s)
  if [ $prefetch_rc -ne 0 ]; then
    echo "Prefetch failed (rc=$prefetch_rc); vLLM will try to download during startup."
  fi
  echo "Prefetch wall time: $((prefetch_end - prefetch_start))s"
}

if [ -z "$VLLM_DISABLE_LOCAL" ]; then
  if [ "$PREFETCH_BLOCKING" = "1" ]; then
    prefetch_model
  else
    prefetch_model &
  fi
  python3 -m vllm.entrypoints.openai.api_server \
    --model "$VLLM_MODEL" \
    --host "$VLLM_HOST" \
    --port "$VLLM_PORT" \
    $VLLM_ARGS &

  # Log vLLM readiness without blocking API startup
  (
    echo "Waiting for vLLM to start..."
    vllm_start=$(date +%s)
    for _ in {1..120}; do
      if nc -z localhost "$VLLM_PORT"; then
        vllm_ready=$(date +%s)
        echo "vLLM is ready in $((vllm_ready - vllm_start))s"
        echo "Total startup time: $((vllm_ready - START_TS))s"
        exit 0
      fi
      sleep 1
    done
    echo "vLLM did not become ready within 120s"
  ) &
else
  echo "VLLM_DISABLE_LOCAL is set; skipping local vLLM startup."
fi

# Start FastAPI
# Cloud Run provides $PORT (defaults to 8080)
echo "Starting FastAPI app..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"
