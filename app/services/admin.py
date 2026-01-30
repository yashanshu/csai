import secrets
from typing import Optional

from fastapi import HTTPException, Request
from google.cloud import firestore

from app import core


def require_admin_secret(request: Request) -> None:
    secret = request.headers.get("Admin-Secret")
    if secret != core.ADMIN_SECRET:
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid Admin Secret", "code": "invalid_admin_secret"},
        )


def require_firestore(context: str = ""):
    if not core.db:
        if context:
            core.logger.error(f"Firestore not initialized during {context}")
        raise HTTPException(
            status_code=503,
            detail={"message": "Auth service unavailable", "code": "auth_unavailable"},
        )
    return core.db


def generate_api_key() -> dict:
    new_key = secrets.token_urlsafe(32)
    db = require_firestore("key generation")
    db.collection(core.COLLECTION_NAME).document(new_key).set(
        {
            "created_at": firestore.SERVER_TIMESTAMP,
            "status": "active",
            "description": "Generated via API",
        }
    )
    core.logger.info("API key generated via admin endpoint")
    return {"api_key": new_key, "status": "created"}


def revoke_api_key(api_key: str) -> dict:
    db = require_firestore("key revocation")
    db.collection(core.COLLECTION_NAME).document(api_key).set(
        {"status": "inactive", "revoked_at": firestore.SERVER_TIMESTAMP},
        merge=True,
    )
    core.logger.info("API key revoked via admin endpoint")
    return {"api_key": api_key, "status": "inactive"}


def activate_api_key(api_key: str) -> dict:
    db = require_firestore("key activation")
    db.collection(core.COLLECTION_NAME).document(api_key).set(
        {"status": "active", "reactivated_at": firestore.SERVER_TIMESTAMP},
        merge=True,
    )
    core.logger.info("API key activated via admin endpoint")
    return {"api_key": api_key, "status": "active"}


def list_keys(limit: int) -> dict:
    db = require_firestore("key listing")
    safe_limit = max(1, min(limit, 500))
    keys = []
    for doc in db.collection(core.COLLECTION_NAME).limit(safe_limit).stream():
        data = doc.to_dict() or {}
        serialized = {k: core._serialize_firestore_value(v) for k, v in data.items()}
        serialized["api_key"] = doc.id
        keys.append(serialized)
    return {"count": len(keys), "keys": keys}


def update_key(api_key: str, updates: dict) -> dict:
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail={"message": "Missing api_key", "code": "missing_api_key"},
        )
    if not isinstance(updates, dict):
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid updates payload", "code": "invalid_body"},
        )
    allowed_fields = {
        "description",
        "status",
        "rate_limit_per_minute",
        "quota_per_day",
        "max_body_bytes",
        "allowed_models",
    }
    safe_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    if not safe_updates:
        raise HTTPException(
            status_code=400,
            detail={"message": "No valid fields to update", "code": "invalid_update"},
        )
    db = require_firestore("key update")
    db.collection(core.COLLECTION_NAME).document(api_key).set(
        {**safe_updates, "updated_at": firestore.SERVER_TIMESTAMP},
        merge=True,
    )
    return {"api_key": api_key, "status": "updated", "updates": safe_updates}


def get_usage_summary(api_key: Optional[str], limit: int) -> dict:
    db = require_firestore("usage fetch")
    if api_key:
        doc = db.collection(core.COLLECTION_NAME).document(api_key).get()
        if not doc.exists:
            raise HTTPException(
                status_code=404,
                detail={"message": "API key not found", "code": "not_found"},
            )
        data = doc.to_dict() or {}
        return core._build_usage_summary(api_key, data)

    safe_limit = max(1, min(limit, 500))
    items = []
    for doc in db.collection(core.COLLECTION_NAME).limit(safe_limit).stream():
        data = doc.to_dict() or {}
        items.append(core._build_usage_summary(doc.id, data))
    return {"count": len(items), "usage": items}
