import time

import httpx
from fastapi import HTTPException

from app import core


async def list_models() -> dict:
    if core.MODELS_CACHE_TTL_SECONDS > 0:
        now = time.time()
        cached = core._models_cache.get("data")
        if cached is not None and now < core._models_cache.get("expires_at", 0):
            return cached
    try:
        async with httpx.AsyncClient(base_url=core.OLLAMA_URL, timeout=30.0) as client:
            resp = await client.get("/api/tags")
            if resp.is_error:
                core.logger.warning(f"Ollama tags error: {resp.status_code}")
                raise HTTPException(
                    status_code=502,
                    detail={"message": "Upstream error", "code": "upstream_error"},
                )
            try:
                data = resp.json()
            except ValueError:
                raise HTTPException(
                    status_code=502,
                    detail={"message": "Upstream returned invalid JSON", "code": "upstream_invalid_json"},
                )
            if core.MODELS_CACHE_TTL_SECONDS > 0:
                core._models_cache["data"] = data
                core._models_cache["expires_at"] = time.time() + core.MODELS_CACHE_TTL_SECONDS
            return data
    except httpx.RequestError as exc:
        core.logger.error(f"Failed to reach Ollama: {exc}")
        raise HTTPException(
            status_code=503,
            detail={"message": "Ollama service unavailable", "code": "upstream_unavailable"},
        )
