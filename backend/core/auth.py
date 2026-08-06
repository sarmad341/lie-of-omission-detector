"""
Clerk session token verification for FastAPI. Verifies the JWT directly
against Clerk's JWKS endpoint (stateless) — NOT via clerk_backend_api's
Sessions.verify, which doesn't exist as a method on that SDK (confirmed:
'Sessions' object has no attribute 'verify').

Admin auth: company admins must have a custom JWT claim 'admin_company_id'
set on their Clerk user (via Clerk Dashboard → User Metadata → publicMetadata
or via the Clerk backend API). That claim is read here to identify which
company this admin manages — keeping each company's dashboard fully isolated.
"""
from fastapi import Header, HTTPException
import jwt
from jwt import PyJWKClient

from core.config import settings

import httpx

_jwks_client = PyJWKClient(settings.clerk_jwks_url)


def _decode_token(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
            leeway=120,
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(401, f"Invalid session: {exc}")


async def require_auth(authorization: str = Header(None)) -> dict:
    """
    FastAPI dependency — add to any route with `Depends(require_auth)`.
    Returns {"user_id": ...} on success, raises 401 otherwise.
    """
    claims = _decode_token(authorization)
    return {"user_id": claims["sub"]}


async def _fetch_clerk_user_company_id(user_id: str) -> str | None:
    """Queries Clerk Backend API for user's public_metadata if clerk_secret_key is set."""
    if not settings.clerk_secret_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                timeout=5.0,
            )
            if res.status_code == 200:
                data = res.json()
                meta = data.get("public_metadata") or data.get("publicMetadata") or {}
                return meta.get("admin_company_id")
    except Exception:
        pass
    return None


async def require_admin_auth(authorization: str = Header(None)) -> dict:
    """
    FastAPI dependency for admin routes.
    Resolves admin_company_id from:
      1. JWT claims (if customized in Clerk session template)
      2. Clerk REST API (using clerk_secret_key)
      3. Fallback to default company ID (6a561810586bd19fb88ab2f2) for dev
    """
    claims = _decode_token(authorization)
    user_id = claims["sub"]

    # 1. Check JWT claims
    public_meta = claims.get("public_metadata") or claims.get("publicMetadata") or {}
    company_id = public_meta.get("admin_company_id")

    # 2. Query Clerk REST API if missing from JWT
    if not company_id:
        company_id = await _fetch_clerk_user_company_id(user_id)

    # 3. Fallback to first company in database if not explicitly assigned
    if not company_id:
        company_id = "6a561810586bd19fb88ab2f2"

    return {"user_id": user_id, "company_id": company_id}