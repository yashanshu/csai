import httpx

from app import core


async def check_health(deep: bool) -> dict:
    if not deep:
        return {"status": "ok"}

    upstreams = core._get_vllm_upstreams()
    results = []
    overall_ok = False
    for upstream in upstreams:
        try:
            async with httpx.AsyncClient(base_url=upstream, timeout=5.0) as client:
                resp = await client.get("/v1/models")
                if resp.is_error:
                    core.logger.warning(f"vLLM health check failed: {resp.status_code} upstream={upstream}")
                    results.append(
                        {"upstream": upstream, "status": "error", "upstream_status": resp.status_code}
                    )
                else:
                    results.append({"upstream": upstream, "status": "ready"})
                    overall_ok = True
        except httpx.RequestError as exc:
            core.logger.error(f"vLLM health check error: {exc} upstream={upstream}")
            results.append({"upstream": upstream, "status": "unavailable"})

    if overall_ok:
        return {"status": "ok", "vllm": {"upstreams": results}}
    return {"status": "degraded", "vllm": {"upstreams": results}}
