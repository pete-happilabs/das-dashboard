from fastapi import APIRouter, Depends

from app.api.dependencies import require_user


router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("")
def profile(username: str = Depends(require_user)) -> dict:
    return {
        "username": username,
        "role": "admin",
        "display_name": "DAS Administrator",
        "permissions": ["analytics:read", "entities:read", "entities:write", "profile:read"],
    }
