import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import core
from app.api import router as api_router


app = FastAPI()


_cors_origins = core._split_cors_origins(core.CORS_ALLOW_ORIGINS)
_cors_origin_regex = core.CORS_ALLOW_ORIGIN_REGEX.strip() or None
if not _cors_origins and not _cors_origin_regex:
    _cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or [],
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[core.REQUEST_ID_HEADER],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get(core.REQUEST_ID_HEADER) or str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    response.headers[core.REQUEST_ID_HEADER] = request_id
    core.logger.info(
        f"{request.method} {request.url.path} status={response.status_code} duration_ms={duration_ms} request_id={request_id}"
    )
    return response


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    if request.url.path in ["/", "/health"] or core._is_admin_path(request.url.path):
        return await call_next(request)

    context = None
    try:
        context = await core.verify_api_key(request)
        if context:
            request.state.api_key = context["api_key"]
            request.state.key_data = context["data"]
            await core.apply_rate_limits(context["api_key"], context["data"])
    except HTTPException as exc:
        return await http_exception_handler(request, exc)
    except Exception as exc:
        return await unhandled_exception_handler(request, exc)

    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    if context:
        token_usage = getattr(request.state, "token_usage", None)
        await core.record_api_key_usage(
            context["api_key"],
            request.url.path,
            response.status_code,
            duration_ms,
            token_usage=token_usage,
        )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", None)
    detail = exc.detail
    if isinstance(detail, dict):
        message = detail.get("message") or "Request failed"
        code = detail.get("code") or f"http_{exc.status_code}"
    else:
        message = str(detail) if detail else "Request failed"
        code = f"http_{exc.status_code}"
    response = JSONResponse(
        status_code=exc.status_code,
        content=core._error_payload(message, code, request_id),
    )
    if request_id:
        response.headers[core.REQUEST_ID_HEADER] = request_id
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    core.logger.exception(f"Unhandled error request_id={request_id}: {exc}")
    response = JSONResponse(
        status_code=500,
        content=core._error_payload("Internal server error", "internal_error", request_id),
    )
    if request_id:
        response.headers[core.REQUEST_ID_HEADER] = request_id
    return response


app.include_router(api_router)
