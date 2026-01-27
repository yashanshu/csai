import httpx
import pytest
import respx

from app import core, main


pytestmark = pytest.mark.asyncio


async def _fake_verify_api_key(_request):
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


async def test_images_endpoint_unconfigured(monkeypatch):
    monkeypatch.setattr(core, "IMAGE_API_URL", "")
    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/images", json={"prompt": "cat"})

    assert resp.status_code == 503
    payload = resp.json()
    assert payload["error"]["code"] == "image_service_unconfigured"


@respx.mock
async def test_images_endpoint_returns_data_url(monkeypatch):
    monkeypatch.setattr(core, "IMAGE_API_URL", "http://image.test/sdapi/v1/txt2img")
    respx.post("http://image.test/sdapi/v1/txt2img").mock(
        return_value=httpx.Response(200, json={"images": ["abcd"]})
    )

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/images", json={"prompt": "cat"})

    assert resp.status_code == 200
    payload = resp.json()
    assert payload["images"][0] == "data:image/png;base64,abcd"
