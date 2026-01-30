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
    upstreams = core._get_vllm_upstreams()
    aggregated = []
    seen_ids = set()
    last_error = None
    for upstream in upstreams:
        try:
            async with httpx.AsyncClient(base_url=upstream, timeout=30.0) as client:
                resp = await client.get("/v1/models")
                if resp.is_error:
                    core.logger.warning(f"vLLM models error: {resp.status_code} upstream={upstream}")
                    last_error = HTTPException(
                        status_code=502,
                        detail={"message": "Upstream error", "code": "upstream_error"},
                    )
                    continue
                try:
                    data = resp.json()
                except ValueError:
                    last_error = HTTPException(
                        status_code=502,
                        detail={"message": "Upstream returned invalid JSON", "code": "upstream_invalid_json"},
                    )
                    continue
                items = data.get("data") if isinstance(data, dict) else None
                if isinstance(items, list):
                    for item in items:
                        model_id = item.get("id") if isinstance(item, dict) else None
                        if model_id and model_id not in seen_ids:
                            seen_ids.add(model_id)
                            aggregated.append(item)
        except httpx.RequestError as exc:
            core.logger.error(f"Failed to reach vLLM: {exc} upstream={upstream}")
            last_error = HTTPException(
                status_code=503,
                detail={"message": "vLLM service unavailable", "code": "upstream_unavailable"},
            )
            continue

    if not aggregated:
        if isinstance(last_error, HTTPException):
            raise last_error
        raise HTTPException(
            status_code=503,
            detail={"message": "vLLM service unavailable", "code": "upstream_unavailable"},
        )

    data = {"object": "list", "data": aggregated}
    if core.MODELS_CACHE_TTL_SECONDS > 0:
        core._models_cache["data"] = data
        core._models_cache["expires_at"] = time.time() + core.MODELS_CACHE_TTL_SECONDS
    return data
