import httpx

from app import core


async def check_health(deep: bool) -> dict:
    if not deep:
        return {"status": "ok"}

    try:
        async with httpx.AsyncClient(base_url=core.OLLAMA_URL, timeout=5.0) as client:
            resp = await client.get("/api/tags")
            if resp.is_error:
                core.logger.warning(f"Ollama health check failed: {resp.status_code}")
                return {"status": "degraded", "ollama": "error", "upstream_status": resp.status_code}
            return {"status": "ok", "ollama": "ready"}
    except httpx.RequestError as exc:
        core.logger.error(f"Ollama health check error: {exc}")
        return {"status": "degraded", "ollama": "unavailable"}
