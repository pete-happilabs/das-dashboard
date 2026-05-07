from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.security import decode_access_token


bearer = HTTPBearer(auto_error=False)


def require_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    username = decode_access_token(credentials.credentials)
    if username != get_settings().admin_username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return username
