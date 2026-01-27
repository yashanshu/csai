import datetime

import httpx
import pytest
import respx
from fastapi import HTTPException

from app import core, main


pytestmark = pytest.mark.asyncio


async def _fake_verify_api_key(request):
    return {"api_key": "test-key", "data": {}}


async def _noop_usage(*_args, **_kwargs):
    return None


async def _noop_rate_limits(*_args, **_kwargs):
    return None


@pytest.fixture(autouse=True)
def _patch_common(monkeypatch):
    monkeypatch.setattr(core, "verify_api_key", _fake_verify_api_key)
    monkeypatch.setattr(core, "record_api_key_usage", _noop_usage)
    monkeypatch.setattr(core, "apply_rate_limits", _noop_rate_limits)
    monkeypatch.setattr(core, "OLLAMA_URL", "http://ollama.test")
    monkeypatch.setattr(core, "_models_cache", {"expires_at": 0.0, "data": None})


async def test_request_too_large_returns_error_envelope(monkeypatch):
    async def _limited_key(_request):
        return {"api_key": "test-key", "data": {"max_body_bytes": 10}}

    monkeypatch.setattr(core, "verify_api_key", _limited_key)

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/generate",
            content=b'{"model":"llama3","prompt":"hello"}',
            headers={"content-type": "application/json"},
        )

    assert resp.status_code == 413
    payload = resp.json()
    assert payload["error"]["code"] == "request_too_large"
    assert resp.headers.get("X-Request-Id")


async def test_model_allowlist_enforced(monkeypatch):
    async def _allowlist_key(_request):
        return {"api_key": "test-key", "data": {"allowed_models": ["llama3"]}}

    monkeypatch.setattr(core, "verify_api_key", _allowlist_key)

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/generate",
            json={"model": "other", "prompt": "hi"},
        )

    assert resp.status_code == 403
    payload = resp.json()
    assert payload["error"]["code"] == "model_not_allowed"


async def test_rate_limit_returns_error_envelope(monkeypatch):
    async def _rate_limited(*_args, **_kwargs):
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit exceeded", "code": "rate_limited"},
        )

    monkeypatch.setattr(core, "apply_rate_limits", _rate_limited)

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/models")

    assert resp.status_code == 429
    payload = resp.json()
    assert payload["error"]["code"] == "rate_limited"


@respx.mock
async def test_models_cache(monkeypatch):
    monkeypatch.setattr(core, "MODELS_CACHE_TTL_SECONDS", 60)
    monkeypatch.setattr(core, "_models_cache", {"expires_at": 0.0, "data": None})

    route = respx.get("http://ollama.test/api/tags").mock(
        return_value=httpx.Response(200, json={"models": [{"name": "llama3"}]})
    )

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp1 = await client.get("/models")
        resp2 = await client.get("/models")

    assert resp1.status_code == 200
    assert resp2.status_code == 200
    assert route.call_count == 1


class _FakeDoc:
    def __init__(self, doc_id, data, exists=True):
        self.id = doc_id
        self._data = data
        self.exists = exists

    def to_dict(self):
        return self._data


class _FakeDocRef:
    def __init__(self, collection, doc_id):
        self._collection = collection
        self._doc_id = doc_id

    def get(self):
        doc = self._collection._docs.get(self._doc_id)
        if doc is None:
            return _FakeDoc(self._doc_id, {}, exists=False)
        return doc


class _FakeCollection:
    def __init__(self, docs):
        self._docs = docs
        self._limit = None

    def document(self, doc_id):
        return _FakeDocRef(self, doc_id)

    def limit(self, limit):
        self._limit = limit
        return self

    def stream(self):
        docs = list(self._docs.values())
        if self._limit is not None:
            docs = docs[: self._limit]
        return docs


class _FakeDB:
    def __init__(self, collections):
        self._collections = collections

    def collection(self, name):
        return self._collections[name]


async def test_usage_endpoint_returns_summary(monkeypatch):
    now = datetime.datetime(2024, 1, 1, 12, 0, 0)
    doc = _FakeDoc(
        "key-1",
        {
            "request_count": 2,
            "total_latency_ms": 30,
            "last_latency_ms": 20,
            "error_count": 1,
            "last_used": now,
        },
    )
    fake_db = _FakeDB({core.COLLECTION_NAME: _FakeCollection({"key-1": doc})})
    monkeypatch.setattr(core, "db", fake_db)

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/admin/usage?api_key=key-1",
            headers={"Admin-Secret": core.ADMIN_SECRET},
        )

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["average_latency_ms"] == 15
    assert payload["error_count"] == 1
    assert payload["last_used"] == now.isoformat()
