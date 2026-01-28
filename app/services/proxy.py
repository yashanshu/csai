import httpx
from fastapi import HTTPException, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from starlette.background import BackgroundTask

from app import core


async def proxy_request(path: str, request: Request):
    wants_text = core._wants_text_response(request)
    normalized_path = path if path.startswith("/") else f"/{path}"
    key_data = getattr(request.state, "key_data", {}) or {}
    body_bytes = None
    body_json = None
    if request.method in ["POST", "PUT", "PATCH"]:
        max_body_bytes = core._get_max_body_bytes(key_data)
        body_bytes = await core._read_body_with_limit(request, max_body_bytes)

    if normalized_path in ["/api/generate", "/api/chat"] and request.method in ["POST", "PUT", "PATCH"]:
        body_json = core._parse_body_json(body_bytes or b"{}")
        model = body_json.get("model")
        core._validate_model_access(model, key_data)

    if wants_text:
        filtered_query = [
            (k, v) for k, v in request.query_params.multi_items() if k.lower() != "format"
        ]
        url = httpx.URL(path=normalized_path, params=filtered_query)
    else:
        url = httpx.URL(path=normalized_path, query=request.url.query.encode("utf-8"))

    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in {"x-response-format", "origin", "referer"}
    }
    headers.pop("host", None)
    headers.pop("content-length", None)

    try:
        timeout = httpx.Timeout(300.0, connect=10.0)
        async with httpx.AsyncClient(base_url=core.OLLAMA_URL, timeout=timeout) as client:
            if wants_text:
                if normalized_path not in ["/api/generate", "/api/chat"]:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "message": "format=text only supported for /api/generate or /api/chat",
                            "code": "invalid_format",
                        },
                    )
                if body_json is None:
                    body_json = core._parse_body_json(body_bytes or b"{}")
                model = body_json.get("model")
                core._validate_model_access(model, key_data)

                body_json["stream"] = False
                req = client.build_request(
                    request.method,
                    url,
                    headers=headers,
                    json=body_json,
                )
                response = await client.send(req)
                if response.is_error:
                    detail = response.text
                    raise HTTPException(
                        status_code=response.status_code,
                        detail={"message": detail or "Upstream error", "code": "upstream_error"},
                    )

                try:
                    payload = response.json()
                except ValueError:
                    raise HTTPException(
                        status_code=502,
                        detail={"message": "Upstream returned invalid JSON", "code": "upstream_invalid_json"},
                    )
                text = core._extract_ollama_text(payload)
                return PlainTextResponse(text)

            req = client.build_request(
                request.method,
                url,
                headers=headers,
                content=body_bytes if body_bytes is not None else request.stream(),
            )
            response = await client.send(req, stream=True)
            if response.is_error:
                error_body = await response.aread()
                await response.aclose()
                detail = error_body.decode(errors="ignore").strip()
                raise HTTPException(
                    status_code=response.status_code,
                    detail={"message": detail or "Upstream error", "code": "upstream_error"},
                )
            return StreamingResponse(
                response.aiter_raw(),
                status_code=response.status_code,
                headers=response.headers,
                background=BackgroundTask(response.aclose),
            )
    except HTTPException:
        raise
    except httpx.RequestError as exc:
        core.logger.error(f"Proxy upstream error: {exc}")
        raise HTTPException(
            status_code=503,
            detail={"message": "Ollama service unavailable", "code": "upstream_unavailable"},
        )
    except Exception as exc:
        core.logger.error(f"Proxy error: {exc}")
        raise HTTPException(
            status_code=500,
            detail={"message": "Ollama service connection failed", "code": "proxy_error"},
        )
