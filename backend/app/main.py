from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api import auth, entities, profile
from app.core.config import get_settings


settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(entities.router)
app.include_router(profile.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "environment": settings.environment}


frontend_dist = Path("frontend/dist")
app.mount("/assets", StaticFiles(directory=frontend_dist / "assets", check_dir=False), name="assets")


@app.get("/")
def frontend_index() -> FileResponse:
    return FileResponse(frontend_dist / "index.html")


@app.get("/{path:path}")
def frontend_fallback(path: str) -> FileResponse:
    asset = frontend_dist / path
    if asset.is_file():
        return FileResponse(asset)
    return FileResponse(frontend_dist / "index.html")
