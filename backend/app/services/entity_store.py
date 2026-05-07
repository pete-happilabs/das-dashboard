from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class EntityStore:
    def __init__(self) -> None:
        self._path = Path("backend/data/entities.json")
        self._entities: dict[str, dict] = {}
        self._load()

    def list(self) -> list[dict]:
        return list(deepcopy(self._entities).values())

    def get(self, entity_id: str) -> dict | None:
        entity = self._entities.get(entity_id)
        return deepcopy(entity) if entity else None

    def create(self, payload: dict) -> dict:
        entity_id = payload.get("id") or self._make_id(payload)
        if entity_id in self._entities:
            entity_id = f"{entity_id}-{uuid4().hex[:6]}"
        entity = self._normalize({**payload, "id": entity_id})
        entity["created_at"] = _now()
        entity["updated_at"] = entity["created_at"]
        self._entities[entity_id] = entity
        self._save()
        return deepcopy(entity)

    def update(self, entity_id: str, payload: dict) -> dict | None:
        existing = self._entities.get(entity_id)
        if not existing:
            return None
        updated = self._normalize({**existing, **payload, "id": entity_id})
        updated["created_at"] = existing.get("created_at", _now())
        updated["updated_at"] = _now()
        self._entities[entity_id] = updated
        self._save()
        return deepcopy(updated)

    def delete(self, entity_id: str) -> bool:
        deleted = self._entities.pop(entity_id, None) is not None
        if deleted:
            self._save()
        return deleted

    def _load(self) -> None:
        if self._path.exists():
            with self._path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            self._entities = {item["id"]: self._normalize(item) for item in data}
            return

        self._seed()
        self._save()

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as handle:
            json.dump(self.list(), handle, indent=2)

    def _seed(self) -> None:
        for item in [
            {
                "id": "hum.priya.sharma.1990",
                "title": "Priya Sharma",
                "entity_type": "person",
                "body": "Certified yoga instructor with experience in Hatha and Vinyasa.",
                "tags": ["yoga", "fitness", "wellness"],
                "locations": ["Bangalore", "Koramangala"],
                "reputation": "5",
                "owner": "pete.saldanha",
                "imageUrls": [],
            },
            {
                "id": "com.zen.studio.blr",
                "title": "Zen Studio Bangalore",
                "entity_type": "business",
                "body": "Wellness studio offering yoga, breathwork, and community classes.",
                "tags": ["yoga", "wellness", "studio"],
                "locations": ["Bangalore"],
                "reputation": "4",
                "owner": "joy.team",
                "imageUrls": [],
            },
        ]:
            self._entities[item["id"]] = self._normalize(item)

    def _normalize(self, payload: dict) -> dict:
        return {
            "id": payload.get("id") or self._make_id(payload),
            "title": payload.get("title") or payload.get("name") or "Untitled",
            "entity_type": payload.get("entity_type") or payload.get("type") or "person",
            "body": payload.get("body") or payload.get("bio") or "",
            "tags": payload.get("tags") or [],
            "locations": payload.get("locations") or [],
            "reputation": str(payload.get("reputation") or ""),
            "owner": payload.get("owner") or "",
            "imageUrls": payload.get("imageUrls") or [],
            "videoUrls": payload.get("videoUrls") or [],
            "audioUrls": payload.get("audioUrls") or [],
            "documentUrls": payload.get("documentUrls") or [],
            "created_at": payload.get("created_at"),
            "updated_at": payload.get("updated_at"),
        }

    def _make_id(self, payload: dict) -> str:
        title = (payload.get("title") or payload.get("name") or "entity").lower()
        slug = "".join(ch if ch.isalnum() else "." for ch in title).strip(".")
        return f"das.{slug or uuid4().hex[:8]}"


store = EntityStore()
