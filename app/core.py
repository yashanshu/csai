import os
import json
import threading
import random
import time
from datetime import datetime
from typing import Any, Dict, Optional, List

from fastapi import HTTPException, Request
from google.cloud import firestore
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _safe_int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


VLLM_URL = os.environ.get("VLLM_URL", "http://localhost:8000")
VLLM_UPSTREAMS = [
    item.strip()
    for item in os.environ.get("VLLM_UPSTREAMS", "").split(",")
    if item.strip()
]
VLLM_MODEL_ROUTE_MAP = {
    item.split("=", 1)[0].strip().lower(): item.split("=", 1)[1].strip()
    for item in os.environ.get("VLLM_MODEL_ROUTE_MAP", "").split(",")
    if "=" in item and item.split("=", 1)[0].strip() and item.split("=", 1)[1].strip()
}
VLLM_ROUTING_STRATEGY = os.environ.get("VLLM_ROUTING_STRATEGY", "round_robin").strip().lower()
VLLM_STICKY_ENABLED = os.environ.get("VLLM_STICKY_ENABLED", "1") not in {"0", "false", "False"}
VLLM_STICKY_HEADER = os.environ.get("VLLM_STICKY_HEADER", "X-Client-Id")
VLLM_STICKY_TTL_SECONDS = _safe_int_env("VLLM_STICKY_TTL_SECONDS", 900)
VLLM_STICKY_MAX_ENTRIES = _safe_int_env("VLLM_STICKY_MAX_ENTRIES", 5000)
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "change-me-please")
COLLECTION_NAME = "api_keys"
USAGE_COLLECTION = "api_key_usage"
MAX_BODY_BYTES = _safe_int_env("MAX_BODY_BYTES", 5 * 1024 * 1024)
DEFAULT_RATE_LIMIT_PER_MINUTE = _safe_int_env("DEFAULT_RATE_LIMIT_PER_MINUTE", 0)
DEFAULT_QUOTA_PER_DAY = _safe_int_env("DEFAULT_QUOTA_PER_DAY", 0)
MODELS_CACHE_TTL_SECONDS = _safe_int_env("MODELS_CACHE_TTL_SECONDS", 30)
REQUEST_ID_HEADER = "X-Request-Id"
CORS_ALLOW_ORIGINS = os.environ.get("CORS_ALLOW_ORIGINS", "*")
CORS_ALLOW_ORIGIN_REGEX = os.environ.get("CORS_ALLOW_ORIGIN_REGEX", "")
IMAGE_API_URL = os.environ.get("IMAGE_API_URL", "")
IMAGE_API_KEY = os.environ.get("IMAGE_API_KEY", "")
IMAGE_API_KEY_HEADER = os.environ.get("IMAGE_API_KEY_HEADER", "Authorization")
IMAGE_API_KEY_PREFIX = os.environ.get("IMAGE_API_KEY_PREFIX", "Bearer ")
IMAGE_TIMEOUT_SECONDS = _safe_int_env("IMAGE_TIMEOUT_SECONDS", 60)


try:
    db = firestore.Client()
    logger.info("Firestore client initialized")
except Exception as e:
    logger.error(f"Failed to initialize Firestore: {e}")
    db = None


_models_cache: Dict[str, Any] = {"expires_at": 0.0, "data": None}
_upstream_index = 0
_upstream_lock = threading.Lock()
_sticky_cache: Dict[str, Dict[str, Any]] = {}
_sticky_lock = threading.Lock()


def _split_cors_origins(value: str) -> List[str]:
    if value is None:
        return []
    value = value.strip()
    if not value:
        return []
    if value == "*":
        return ["*"]
    return [item.strip() for item in value.split(",") if item.strip()]


def _is_admin_path(path: str) -> bool:
    return path.startswith("/admin")


def _wants_text_response(request: Request) -> bool:
    header_format = request.headers.get("X-Response-Format", "").lower()
    query_format = request.query_params.get("format", "").lower()
    return header_format == "text" or query_format == "text"


def _serialize_firestore_value(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _extract_openai_text(payload: Dict[str, Any]) -> str:
    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0] or {}
        if isinstance(choice, dict):
            message = choice.get("message")
            if isinstance(message, dict):
                content = message.get("content")
                if content is not None:
                    return str(content)
            text = choice.get("text")
            if text is not None:
                return str(text)
    message = payload.get("message") or {}
    if isinstance(message, dict) and "content" in message:
        return message.get("content") or ""
    return ""


def _get_vllm_upstreams() -> List[str]:
    if VLLM_UPSTREAMS:
        return VLLM_UPSTREAMS
    return [VLLM_URL]


def _next_upstream(upstreams: List[str]) -> str:
    if not upstreams:
        return VLLM_URL
    if len(upstreams) == 1:
        return upstreams[0]
    if VLLM_ROUTING_STRATEGY == "random":
        return random.choice(upstreams)
    global _upstream_index
    with _upstream_lock:
        choice = upstreams[_upstream_index % len(upstreams)]
        _upstream_index += 1
        return choice


def _resolve_preference(preference: Optional[str], model: Optional[str], upstreams: List[str]) -> Optional[str]:
    if preference:
        pref = preference.strip()
        pref_lower = pref.lower()
        if pref.startswith("http://") or pref.startswith("https://"):
            return pref
        mapped = VLLM_MODEL_ROUTE_MAP.get(pref_lower)
        if mapped:
            return mapped
        for key, url in VLLM_MODEL_ROUTE_MAP.items():
            if pref_lower == key or pref_lower.startswith(key):
                return url
    if model:
        model_lower = model.lower()
        mapped = VLLM_MODEL_ROUTE_MAP.get(model_lower)
        if mapped:
            return mapped
        for key, url in VLLM_MODEL_ROUTE_MAP.items():
            if model_lower == key or model_lower.startswith(key):
                return url
    return None


def select_vllm_upstreams(request: Request, body_json: Optional[Dict[str, Any]] = None) -> List[str]:
    upstreams = _get_vllm_upstreams()
    if not upstreams:
        return [VLLM_URL]
    if len(upstreams) == 1:
        return upstreams

    preference = request.headers.get("X-Model-Preference") or request.query_params.get("preference")
    model = None
    if isinstance(body_json, dict):
        model = body_json.get("model")
    preferred = _resolve_preference(preference, model, upstreams)

    sticky_key = None
    if VLLM_STICKY_ENABLED:
        sticky_key = request.headers.get(VLLM_STICKY_HEADER)
        if sticky_key:
            now = time.time()
            with _sticky_lock:
                entry = _sticky_cache.get(sticky_key)
                if entry and entry.get("expires_at", 0) > now:
                    sticky_upstream = entry.get("upstream")
                    if sticky_upstream in upstreams:
                        return [sticky_upstream] + [
                            item for item in upstreams if item != sticky_upstream
                        ]
                elif entry:
                    _sticky_cache.pop(sticky_key, None)

    if preferred and preferred in upstreams:
        ordered = [preferred] + [item for item in upstreams if item != preferred]
        if VLLM_STICKY_ENABLED and sticky_key:
            _store_sticky_mapping(sticky_key, preferred)
        return ordered

    primary = _next_upstream(upstreams)
    if VLLM_STICKY_ENABLED and sticky_key:
        _store_sticky_mapping(sticky_key, primary)
    return [primary] + [item for item in upstreams if item != primary]


def _store_sticky_mapping(sticky_key: str, upstream: str) -> None:
    if not sticky_key:
        return
    ttl = VLLM_STICKY_TTL_SECONDS
    if ttl <= 0:
        return
    now = time.time()
    with _sticky_lock:
        if len(_sticky_cache) >= max(1, VLLM_STICKY_MAX_ENTRIES):
            expired_keys = [
                key for key, entry in _sticky_cache.items() if entry.get("expires_at", 0) <= now
            ]
            for key in expired_keys:
                _sticky_cache.pop(key, None)
            if len(_sticky_cache) >= VLLM_STICKY_MAX_ENTRIES:
                _sticky_cache.pop(next(iter(_sticky_cache)), None)
        _sticky_cache[sticky_key] = {"upstream": upstream, "expires_at": now + ttl}


def _error_payload(message: str, code: str, request_id: Optional[str]) -> Dict[str, Any]:
    return {"error": {"message": message, "code": code, "request_id": request_id}}


def _coerce_limit(value: Any, default_value: int) -> Optional[int]:
    if value is None:
        value = default_value
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _get_max_body_bytes(key_data: Dict[str, Any]) -> int:
    value = key_data.get("max_body_bytes")
    if value is None:
        return MAX_BODY_BYTES
    try:
        value = int(value)
    except (TypeError, ValueError):
        return MAX_BODY_BYTES
    return value if value > 0 else MAX_BODY_BYTES


def _parse_body_json(body_bytes: bytes) -> Dict[str, Any]:
    try:
        payload = json.loads(body_bytes or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail={"message": "Request body must be valid JSON", "code": "invalid_json"},
        )
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400,
            detail={"message": "Request body must be a JSON object", "code": "invalid_body"},
        )
    return payload


def _validate_model_access(model: Optional[str], key_data: Dict[str, Any]) -> None:
    allowed_models = key_data.get("allowed_models")
    if not allowed_models:
        return
    if not isinstance(allowed_models, list):
        return
    if not model:
        raise HTTPException(
            status_code=400,
            detail={"message": "Missing model in request body", "code": "missing_model"},
        )
    if model not in allowed_models:
        raise HTTPException(
            status_code=403,
            detail={"message": "Model not allowed", "code": "model_not_allowed"},
        )


def _build_usage_summary(api_key: str, data: Dict[str, Any]) -> Dict[str, Any]:
    request_count = int(data.get("request_count") or 0)
    total_latency_ms = int(data.get("total_latency_ms") or 0)
    average_latency_ms = 0
    if request_count:
        average_latency_ms = int(total_latency_ms / request_count)
    return {
        "api_key": api_key,
        "request_count": request_count,
        "error_count": int(data.get("error_count") or 0),
        "average_latency_ms": average_latency_ms,
        "last_latency_ms": int(data.get("last_latency_ms") or 0),
        "last_used": _serialize_firestore_value(data.get("last_used")),
        "last_path": data.get("last_path"),
        "last_status": data.get("last_status"),
        "rate_limit_per_minute": data.get("rate_limit_per_minute"),
        "quota_per_day": data.get("quota_per_day"),
        "max_body_bytes": data.get("max_body_bytes"),
        "allowed_models": data.get("allowed_models"),
        "total_prompt_tokens": int(data.get("total_prompt_tokens") or 0),
        "total_completion_tokens": int(data.get("total_completion_tokens") or 0),
        "total_tokens": int(data.get("total_tokens") or 0),
        "last_prompt_tokens": int(data.get("last_prompt_tokens") or 0),
        "last_completion_tokens": int(data.get("last_completion_tokens") or 0),
        "last_total_tokens": int(data.get("last_total_tokens") or 0),
    }


async def _read_body_with_limit(request: Request, max_bytes: int) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_bytes:
                raise HTTPException(
                    status_code=413,
                    detail={"message": "Request body too large", "code": "request_too_large"},
                )
        except ValueError:
            pass

    body = await request.body()
    if body and len(body) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail={"message": "Request body too large", "code": "request_too_large"},
        )
    return body


async def verify_api_key(request: Request) -> Optional[Dict[str, Any]]:
    if request.url.path == "/" or request.url.path == "/health":
        return None

    if _is_admin_path(request.url.path):
        return None

    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail={"message": "Missing API Key", "code": "missing_api_key"},
        )

    if not db:
        logger.warning("Firestore not initialized, rejecting request")
        raise HTTPException(
            status_code=503,
            detail={"message": "Auth service unavailable", "code": "auth_unavailable"},
        )

    doc_ref = db.collection(COLLECTION_NAME).document(api_key)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=403,
            detail={"message": "Invalid API Key", "code": "invalid_api_key"},
        )

    data = doc.to_dict() or {}
    if data.get("status") == "inactive":
        raise HTTPException(
            status_code=403,
            detail={"message": "API Key inactive", "code": "api_key_inactive"},
        )
    return {"api_key": api_key, "data": data}


async def record_api_key_usage(
    api_key: str,
    path: str,
    status_code: int,
    latency_ms: int,
    token_usage: Optional[Dict[str, Any]] = None,
) -> None:
    if not db:
        return
    try:
        doc_ref = db.collection(COLLECTION_NAME).document(api_key)
        update = {
            "last_used": firestore.SERVER_TIMESTAMP,
            "last_path": path,
            "last_status": status_code,
            "request_count": firestore.Increment(1),
            "last_latency_ms": latency_ms,
            "total_latency_ms": firestore.Increment(latency_ms),
        }
        if status_code >= 400:
            update["error_count"] = firestore.Increment(1)
        if token_usage:
            prompt_tokens = int(token_usage.get("prompt_tokens") or 0)
            completion_tokens = int(token_usage.get("completion_tokens") or 0)
            total_tokens = int(token_usage.get("total_tokens") or 0)
            if prompt_tokens:
                update["total_prompt_tokens"] = firestore.Increment(prompt_tokens)
                update["last_prompt_tokens"] = prompt_tokens
            if completion_tokens:
                update["total_completion_tokens"] = firestore.Increment(completion_tokens)
                update["last_completion_tokens"] = completion_tokens
            if total_tokens:
                update["total_tokens"] = firestore.Increment(total_tokens)
                update["last_total_tokens"] = total_tokens
        doc_ref.set(update, merge=True)
    except Exception as e:
        logger.warning(f"Failed to record usage for API key: {e}")


class _RateLimitExceeded(Exception):
    pass


class _QuotaExceeded(Exception):
    pass


async def apply_rate_limits(api_key: str, key_data: Dict[str, Any]) -> None:
    rate_limit = _coerce_limit(key_data.get("rate_limit_per_minute"), DEFAULT_RATE_LIMIT_PER_MINUTE)
    daily_quota = _coerce_limit(key_data.get("quota_per_day"), DEFAULT_QUOTA_PER_DAY)
    if not rate_limit and not daily_quota:
        return
    if not db:
        raise HTTPException(
            status_code=503,
            detail={"message": "Auth service unavailable", "code": "auth_unavailable"},
        )

    now = datetime.utcnow()
    minute_bucket = now.strftime("%Y%m%d%H%M")
    day_bucket = now.strftime("%Y%m%d")
    usage_collection = db.collection(USAGE_COLLECTION)

    @firestore.transactional
    def _apply_limits(transaction):
        if rate_limit:
            minute_ref = usage_collection.document(f"{api_key}:minute:{minute_bucket}")
            minute_doc = minute_ref.get(transaction=transaction)
            minute_count = minute_doc.get("count") if minute_doc.exists else 0
            if minute_count >= rate_limit:
                raise _RateLimitExceeded()
            transaction.set(
                minute_ref,
                {
                    "api_key": api_key,
                    "bucket": minute_bucket,
                    "period": "minute",
                    "limit": rate_limit,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                    "count": firestore.Increment(1),
                },
                merge=True,
            )

        if daily_quota:
            day_ref = usage_collection.document(f"{api_key}:day:{day_bucket}")
            day_doc = day_ref.get(transaction=transaction)
            day_count = day_doc.get("count") if day_doc.exists else 0
            if day_count >= daily_quota:
                raise _QuotaExceeded()
            transaction.set(
                day_ref,
                {
                    "api_key": api_key,
                    "bucket": day_bucket,
                    "period": "day",
                    "limit": daily_quota,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                    "count": firestore.Increment(1),
                },
                merge=True,
            )

    try:
        _apply_limits(db.transaction())
    except _RateLimitExceeded:
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit exceeded", "code": "rate_limited"},
        )
    except _QuotaExceeded:
        raise HTTPException(
            status_code=429,
            detail={"message": "Daily quota exceeded", "code": "quota_exceeded"},
        )
