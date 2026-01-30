import httpx
import pytest
import respx

from app import core, main


pytestmark = pytest.mark.asyncio


async def _fake_verify_api_key(request):
    return {"api_key": "test-key", "data": {}}


async def _noop_usage(*_args, **_kwargs):
    return None


async def _noop_rate_limits(*_args, **_kwargs):
    return None


@pytest.fixture(autouse=True)
def _patch_auth(monkeypatch):
    monkeypatch.setattr(core, "verify_api_key", _fake_verify_api_key)
    monkeypatch.setattr(core, "record_api_key_usage", _noop_usage)
    monkeypatch.setattr(core, "apply_rate_limits", _noop_rate_limits)
    monkeypatch.setattr(core, "VLLM_URL", "http://vllm.test")
    monkeypatch.setattr(core, "VLLM_UPSTREAMS", ["http://vllm.test"])
    monkeypatch.setattr(core, "VLLM_MODEL_ROUTE_MAP", {})
    monkeypatch.setattr(core, "VLLM_ROUTING_STRATEGY", "round_robin")
    monkeypatch.setattr(core, "_upstream_index", 0)
    monkeypatch.setattr(core, "_models_cache", {"expires_at": 0.0, "data": None})


@respx.mock
async def test_text_format_returns_plain_text():
    route = respx.post("http://vllm.test/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": "hello"}}]},
        )
    )

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/chat/completions?format=text",
            json={"model": "llama3", "messages": [{"role": "user", "content": "hi"}], "stream": True},
        )

    assert route.called
    assert resp.status_code == 200
    assert resp.text == "hello"
    assert resp.headers["content-type"].startswith("text/plain")


@respx.mock
async def test_proxy_stream_passthrough():
    route = respx.post("http://vllm.test/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            content=b'{"choices":[{"message":{"content":"ok"}}]}',
            headers={"content-type": "application/json"},
        )
    )

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/chat/completions",
            json={"model": "llama3", "messages": [{"role": "user", "content": "hi"}], "stream": True},
        )

    assert route.called
    assert resp.status_code == 200
    assert resp.text == '{"choices":[{"message":{"content":"ok"}}]}'
    assert resp.headers["content-type"].startswith("application/json")


@respx.mock
async def test_models_proxy():
    route = respx.get("http://vllm.test/v1/models").mock(
        return_value=httpx.Response(
            200,
            json={"object": "list", "data": [{"id": "llama3"}]},
        )
    )

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/models")

    assert route.called
    assert resp.status_code == 200
    assert resp.json() == {"object": "list", "data": [{"id": "llama3"}]}
