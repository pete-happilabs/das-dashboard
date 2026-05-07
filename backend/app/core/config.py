import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    app_name: str
    environment: str
    cors_origins: str
    admin_username: str
    admin_password: str
    admin_password_hash: str | None
    jwt_secret_key: str
    jwt_algorithm: str
    jwt_expire_minutes: int
    das_upstream_base_url: str | None
    das_upstream_token: str | None

    def cors_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "DAS Dashboard API"),
        environment=os.getenv("ENVIRONMENT", "local"),
        cors_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
        admin_username=os.getenv("ADMIN_USERNAME", "admin"),
        admin_password=os.getenv("ADMIN_PASSWORD", "admin123"),
        admin_password_hash=os.getenv("ADMIN_PASSWORD_HASH"),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me-in-production"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_expire_minutes=int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24))),
        das_upstream_base_url=os.getenv("DAS_UPSTREAM_BASE_URL"),
        das_upstream_token=os.getenv("DAS_UPSTREAM_TOKEN"),
    )
