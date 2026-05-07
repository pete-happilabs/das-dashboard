from __future__ import annotations

from urllib.parse import urljoin

import httpx
from fastapi import HTTPException

from app.core.config import get_settings


def upstream_enabled() -> bool:
    return bool(get_settings().das_upstream_base_url)


def normalize_document(doc: dict) -> dict:
    entity_id = doc.get("id") or doc.get("doc_id") or ""
    entity_type = doc.get("entity_type") or _type_from_id(entity_id) or doc.get("type") or "other"
    return {
        **doc,
        "id": entity_id,
        "title": doc.get("title") or doc.get("name") or entity_id or "Untitled",
        "entity_type": entity_type,
        "body": doc.get("body") or doc.get("bio") or doc.get("description") or "",
        "tags": doc.get("tags") or [],
        "locations": doc.get("locations") or doc.get("location") or [],
        "reputation": str(doc.get("reputation") or doc.get("reputation_label") or ""),
        "owner": doc.get("owner") or doc.get("introduced_by") or "",
        "imageUrls": doc.get("imageUrls") or doc.get("image_urls") or [],
        "videoUrls": doc.get("videoUrls") or doc.get("video_urls") or [],
        "audioUrls": doc.get("audioUrls") or doc.get("audio_urls") or [],
        "documentUrls": doc.get("documentUrls") or doc.get("document_urls") or [],
    }


def document_payload(payload: dict, doc_id: str | None = None) -> dict:
    entity_id = doc_id or payload.get("id")
    if not entity_id:
        entity_id = _make_id(payload)
    return {
        **payload,
        "id": entity_id,
        "title": payload.get("title") or payload.get("name") or entity_id,
        "entity_type": payload.get("entity_type") or _type_from_id(entity_id) or "other",
        "body": payload.get("body") or payload.get("bio") or "",
        "tags": payload.get("tags") or [],
        "locations": payload.get("locations") or [],
        "reputation": str(payload.get("reputation") or ""),
        "owner": payload.get("owner") or "",
        "imageUrls": payload.get("imageUrls") or [],
        "videoUrls": payload.get("videoUrls") or [],
        "audioUrls": payload.get("audioUrls") or [],
        "documentUrls": payload.get("documentUrls") or [],
    }


async def get_analytics() -> dict:
    data = await _request("GET", "analytics")
    if isinstance(data, dict) and isinstance(data.get("documents"), list):
        data["documents"] = [normalize_document(item) for item in data["documents"]]
    return data


async def list_documents(limit: int = 400, offset: int = 0) -> dict:
    data = await _request("GET", "documents", params={"limit": limit, "offset": offset})
    items = [normalize_document(item) for item in data.get("items", [])]
    return {**data, "items": items}


async def get_document(doc_id: str) -> dict:
    return normalize_document(await _request("GET", f"documents/{doc_id}"))


async def create_document(payload: dict) -> dict:
    doc = document_payload(payload)
    await _request("POST", "documents", json=doc)
    return doc


async def update_document(doc_id: str, payload: dict) -> dict:
    doc = document_payload(payload, doc_id)
    await _request("PUT", f"documents/{doc_id}", json=doc)
    return doc


async def delete_document(doc_id: str) -> None:
    await _request("DELETE", f"documents/{doc_id}")


async def _request(method: str, path: str, **kwargs) -> dict:
    settings = get_settings()
    if not settings.das_upstream_base_url:
        raise RuntimeError("DAS_UPSTREAM_BASE_URL is not configured")

    base = settings.das_upstream_base_url.rstrip("/") + "/"
    headers = kwargs.pop("headers", {})
    if settings.das_upstream_token:
        headers["Authorization"] = f"Bearer {settings.das_upstream_token}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            response = await client.request(method, urljoin(base, path), headers=headers, **kwargs)
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"DAS upstream unavailable: {exc}") from exc

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Document not found")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"DAS upstream returned HTTP {response.status_code}")
    if response.status_code == 204:
        return {}
    return response.json()


def _type_from_id(entity_id: str) -> str | None:
    if entity_id.startswith("hum."):
        return "person"
    if entity_id.startswith("com."):
        return "business"
    if entity_id:
        return "other"
    return None


def _make_id(payload: dict) -> str:
    prefix = "com" if payload.get("entity_type") == "business" else "hum"
    title = (payload.get("title") or payload.get("name") or "entity").lower()
    slug = "".join(ch if ch.isalnum() else "." for ch in title).strip(".")
    return f"{prefix}.{slug or 'entity'}"
