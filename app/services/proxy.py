import httpx
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
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

    if normalized_path in ["/v1/completions", "/v1/chat/completions"] and request.method in ["POST", "PUT", "PATCH"]:
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
        upstreams = core.select_vllm_upstreams(request, body_json)
        last_error = None
        for upstream in upstreams:
            async with httpx.AsyncClient(base_url=upstream, timeout=timeout) as client:
                try:
                    if wants_text:
                        if normalized_path not in ["/v1/completions", "/v1/chat/completions"]:
                            raise HTTPException(
                                status_code=400,
                                detail={
                                    "message": "format=text only supported for /v1/completions or /v1/chat/completions",
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
                            if response.status_code in {502, 503, 504} and upstream != upstreams[-1]:
                                last_error = HTTPException(
                                    status_code=response.status_code,
                                    detail={"message": detail or "Upstream error", "code": "upstream_error"},
                                )
                                continue
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
                        usage = payload.get("usage") if isinstance(payload, dict) else None
                        if isinstance(usage, dict):
                            request.state.token_usage = usage
                        text = core._extract_openai_text(payload)
                        return PlainTextResponse(text)

                    if body_json is not None and body_json.get("stream") is False:
                        req = client.build_request(
                            request.method,
                            url,
                            headers=headers,
                            json=body_json,
                        )
                        response = await client.send(req)
                        if response.is_error:
                            detail = response.text
                            if response.status_code in {502, 503, 504} and upstream != upstreams[-1]:
                                last_error = HTTPException(
                                    status_code=response.status_code,
                                    detail={"message": detail or "Upstream error", "code": "upstream_error"},
                                )
                                continue
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
                        usage = payload.get("usage") if isinstance(payload, dict) else None
                        if isinstance(usage, dict):
                            request.state.token_usage = usage
                        return JSONResponse(
                            content=payload,
                            status_code=response.status_code,
                            headers=response.headers,
                        )

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
                        if response.status_code in {502, 503, 504} and upstream != upstreams[-1]:
                            last_error = HTTPException(
                                status_code=response.status_code,
                                detail={"message": detail or "Upstream error", "code": "upstream_error"},
                            )
                            continue
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
                except httpx.RequestError as exc:
                    last_error = exc
                    if upstream != upstreams[-1]:
                        continue
                    raise
        if isinstance(last_error, HTTPException):
            raise last_error
    except HTTPException:
        raise
    except httpx.RequestError as exc:
        core.logger.error(f"Proxy upstream error: {exc}")
        raise HTTPException(
            status_code=503,
            detail={"message": "vLLM service unavailable", "code": "upstream_unavailable"},
        )
    except Exception as exc:
        core.logger.error(f"Proxy error: {exc}")
        raise HTTPException(
            status_code=500,
            detail={"message": "vLLM service connection failed", "code": "proxy_error"},
        )
