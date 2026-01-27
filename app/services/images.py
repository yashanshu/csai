from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

from app import core


def _build_headers() -> Dict[str, str]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if core.IMAGE_API_KEY:
        value = f"{core.IMAGE_API_KEY_PREFIX}{core.IMAGE_API_KEY}".strip()
        headers[core.IMAGE_API_KEY_HEADER] = value
    return headers


def _prefix_data_url(images: List[str]) -> List[str]:
    output = []
    for image in images:
        if not image:
            continue
        if image.startswith("data:image"):
            output.append(image)
        else:
            output.append(f"data:image/png;base64,{image}")
    return output


async def generate_images(prompt: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not core.IMAGE_API_URL:
        raise HTTPException(
            status_code=503,
            detail={"message": "Image service not configured", "code": "image_service_unconfigured"},
        )
    if not prompt:
        raise HTTPException(
            status_code=400,
            detail={"message": "Missing prompt", "code": "missing_prompt"},
        )

    options = options or {}
    payload = {
        "prompt": prompt,
        "negative_prompt": options.get("negativePrompt") or options.get("negative_prompt") or "",
        "width": options.get("width", 768),
        "height": options.get("height", 768),
        "steps": options.get("steps", 30),
        "cfg_scale": options.get("guidance", options.get("cfg_scale", 7.0)),
        "seed": options.get("seed", -1),
        "batch_size": options.get("count", 1),
    }

    try:
        timeout = httpx.Timeout(core.IMAGE_TIMEOUT_SECONDS, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                core.IMAGE_API_URL,
                headers=_build_headers(),
                json=payload,
            )
        if response.is_error:
            raise HTTPException(
                status_code=response.status_code,
                detail={"message": response.text or "Image service error", "code": "image_service_error"},
            )
        data = response.json()
    except HTTPException:
        raise
    except httpx.RequestError as exc:
        core.logger.error(f"Image service request error: {exc}")
        raise HTTPException(
            status_code=503,
            detail={"message": "Image service unavailable", "code": "image_service_unavailable"},
        )
    except Exception as exc:
        core.logger.error(f"Image service error: {exc}")
        raise HTTPException(
            status_code=500,
            detail={"message": "Image generation failed", "code": "image_generation_failed"},
        )

    images = data.get("images") or []
    if not isinstance(images, list):
        images = []
    return {
        "images": _prefix_data_url(images),
        "info": data.get("info"),
        "parameters": data.get("parameters"),
    }
