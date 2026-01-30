import pytest
from starlette.requests import Request

from app import core


def _make_request(headers=None, query_string=""):
    headers = headers or {}
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/v1/chat/completions",
        "headers": raw_headers,
        "query_string": query_string.encode(),
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def _reset_routing(monkeypatch):
    monkeypatch.setattr(core, "VLLM_UPSTREAMS", ["http://qwen", "http://gpt"])
    monkeypatch.setattr(
        core,
        "VLLM_MODEL_ROUTE_MAP",
        {"qwen/qwen3-14b": "http://qwen", "openai/gpt-oss-20b": "http://gpt"},
    )
    monkeypatch.setattr(core, "VLLM_ROUTING_STRATEGY", "round_robin")
    monkeypatch.setattr(core, "VLLM_STICKY_ENABLED", True)
    monkeypatch.setattr(core, "VLLM_STICKY_HEADER", "X-Client-Id")
    monkeypatch.setattr(core, "VLLM_STICKY_TTL_SECONDS", 300)
    monkeypatch.setattr(core, "VLLM_STICKY_MAX_ENTRIES", 100)
    monkeypatch.setattr(core, "_upstream_index", 0)
    monkeypatch.setattr(core, "_sticky_cache", {})


def test_sticky_prefers_mapped_model_then_sticks():
    request = _make_request(headers={"X-Client-Id": "client-1"})
    upstreams = core.select_vllm_upstreams(
        request, body_json={"model": "Qwen/Qwen3-14B"}
    )
    assert upstreams[0] == "http://qwen"

    followup = _make_request(headers={"X-Client-Id": "client-1"})
    upstreams_followup = core.select_vllm_upstreams(followup, body_json={})
    assert upstreams_followup[0] == "http://qwen"


def test_preference_header_routes_and_sets_sticky():
    request = _make_request(
        headers={"X-Client-Id": "client-2", "X-Model-Preference": "openai/gpt-oss-20b"}
    )
    upstreams = core.select_vllm_upstreams(request, body_json={"model": "ignored"})
    assert upstreams[0] == "http://gpt"

    followup = _make_request(headers={"X-Client-Id": "client-2"})
    upstreams_followup = core.select_vllm_upstreams(followup, body_json={})
    assert upstreams_followup[0] == "http://gpt"
