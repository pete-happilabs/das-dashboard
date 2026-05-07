from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies import require_user
from app.services.analytics import build_analytics
from app.services.entity_store import store
from app.services import vespa_client


router = APIRouter(prefix="/api/das", tags=["das"], dependencies=[Depends(require_user)])
legacy_router = APIRouter(tags=["legacy"], dependencies=[Depends(require_user)])


class EntityPayload(BaseModel):
    title: str = Field(min_length=1)
    entity_type: str = "person"
    body: str = ""
    tags: list[str] = []
    locations: list[str] = []
    reputation: str = ""
    owner: str = ""
    imageUrls: list[str] = []
    videoUrls: list[str] = []
    audioUrls: list[str] = []
    documentUrls: list[str] = []


@router.get("/entities")
async def list_entities() -> dict:
    if vespa_client.upstream_enabled():
        return await vespa_client.list_documents()
    return {"items": store.list()}


@router.post("/entities", status_code=status.HTTP_201_CREATED)
async def create_entity(payload: EntityPayload) -> dict:
    if vespa_client.upstream_enabled():
        return await vespa_client.create_document(payload.model_dump())
    return store.create(payload.model_dump())


@router.get("/entities/{entity_id}")
async def get_entity(entity_id: str) -> dict:
    if vespa_client.upstream_enabled():
        return await vespa_client.get_document(entity_id)
    entity = store.get(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@router.put("/entities/{entity_id}")
async def update_entity(entity_id: str, payload: EntityPayload) -> dict:
    if vespa_client.upstream_enabled():
        return await vespa_client.update_document(entity_id, payload.model_dump())
    entity = store.update(entity_id, payload.model_dump())
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@router.delete("/entities/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(entity_id: str) -> None:
    if vespa_client.upstream_enabled():
        await vespa_client.delete_document(entity_id)
        return None
    if not store.delete(entity_id):
        raise HTTPException(status_code=404, detail="Entity not found")


@router.get("/analytics")
async def analytics() -> dict:
    if vespa_client.upstream_enabled():
        return await vespa_client.get_analytics()
    return build_analytics(store.list())


@legacy_router.get("/analytics/data")
async def legacy_analytics() -> dict:
    if vespa_client.upstream_enabled():
        return await vespa_client.get_analytics()
    return build_analytics(store.list())


@legacy_router.post("/introduce", status_code=status.HTTP_201_CREATED)
def introduce(payload: dict) -> dict:
    objects = payload.get("dostEvent", {}).get("categories", [{}])[0].get("dostObjects", [])
    created = []
    for obj in objects:
        created.append(store.create({
            "title": obj.get("title"),
            "entity_type": "business" if obj.get("type") == "company" else "person",
            "body": obj.get("body"),
            "tags": obj.get("tags", []),
            "locations": obj.get("locations", []),
            "reputation": obj.get("reputation", ""),
            "owner": obj.get("owner", ""),
            "imageUrls": obj.get("imageUrls", []),
            "videoUrls": obj.get("videoUrls", []),
            "audioUrls": obj.get("audioUrls", []),
            "documentUrls": obj.get("documentUrls", []),
        }))
    return {"created": created}
