#!/bin/bash

# Start Ollama in the background
ollama serve &

# Log Ollama readiness without blocking API startup
(
  echo "Waiting for Ollama to start..."
  for _ in {1..120}; do
    if nc -z localhost 11434; then
      echo "Ollama is ready!"
      exit 0
    fi
    sleep 1
  done
  echo "Ollama did not become ready within 120s"
) &

# Start FastAPI
# Cloud Run provides $PORT (defaults to 8080)
echo "Starting FastAPI app..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8080}"
