from __future__ import annotations
from fastapi import APIRouter

from core.db import get_db

router = APIRouter()


@router.get("/health")
async def health():
    """
    GET /health — PDR Section 9.
    Reports Mongo connectivity for now. Extend to report which model
    provider (Groq vs. Ollama) is currently primary/reachable once
    models/router.py exposes a status check — tell me its interface
    and I'll wire it in.
    """
    status = {"mongo": "unknown"}
    try:
        db = get_db()
        db.command("ping")
        status["mongo"] = "ok"
    except Exception as exc:  # noqa: BLE001
        status["mongo"] = f"error: {exc}"

    return status
