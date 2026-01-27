from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from app.services import admin as admin_service
from app.services import health as health_service
from app.services import images as images_service
from app.services import models as models_service
from app.services import proxy as proxy_service


router = APIRouter()


@router.api_route("/admin/generate-key", methods=["GET", "POST"])
async def generate_key(request: Request):
    admin_service.require_admin_secret(request)
    return admin_service.generate_api_key()


@router.post("/admin/revoke-key")
async def revoke_key(request: Request):
    admin_service.require_admin_secret(request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"message": "Request body must be valid JSON", "code": "invalid_json"},
        )
    api_key = payload.get("api_key")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail={"message": "Missing api_key", "code": "missing_api_key"},
        )
    return admin_service.revoke_api_key(api_key)


@router.post("/admin/activate-key")
async def activate_key(request: Request):
    admin_service.require_admin_secret(request)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"message": "Request body must be valid JSON", "code": "invalid_json"},
        )
    api_key = payload.get("api_key")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail={"message": "Missing api_key", "code": "missing_api_key"},
        )
    return admin_service.activate_api_key(api_key)


@router.get("/admin/keys")
async def list_keys(request: Request, limit: int = 100):
    admin_service.require_admin_secret(request)
    return admin_service.list_keys(limit)


@router.get("/admin/usage")
async def usage(request: Request, api_key: Optional[str] = None, limit: int = 100):
    admin_service.require_admin_secret(request)
    return admin_service.get_usage_summary(api_key, limit)


@router.get("/health")
async def health(deep: bool = False):
    return await health_service.check_health(deep)


@router.get("/models")
async def list_models():
    return await models_service.list_models()


@router.post("/api/images")
async def generate_image(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail={"message": "Request body must be valid JSON", "code": "invalid_json"},
        )
    prompt = payload.get("prompt")
    options = {
        "negativePrompt": payload.get("negativePrompt"),
        "width": payload.get("width"),
        "height": payload.get("height"),
        "steps": payload.get("steps"),
        "guidance": payload.get("guidance"),
        "seed": payload.get("seed"),
        "count": payload.get("count"),
    }
    return await images_service.generate_images(prompt, options)


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy(path: str, request: Request):
    return await proxy_service.proxy_request(path, request)
