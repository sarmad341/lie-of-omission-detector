"""
MongoDB Atlas connection (free M0 tier). Uses pymongo, the standard
synchronous MongoDB driver — matches the rest of the pipeline, which is
synchronous throughout.

Install:
    pip install pymongo
"""
from pymongo import MongoClient
from pymongo.database import Database
import certifi

from core.config import settings

_client: MongoClient | None = None


def get_db() -> Database:
    """Returns the database handle, creating the connection on first use.
    Reuses the same client across calls rather than reconnecting each time.

    Explicitly uses certifi's CA bundle (tlsCAFile) rather than relying on
    the OS certificate store — on Windows, pymongo's TLS handshake to
    Atlas sometimes fails with TLSV1_ALERT_INTERNAL_ERROR when relying on
    the system store; pointing at certifi's bundle directly avoids that.
    """
    global _client
    if _client is None:
        if not settings.mongodb_uri:
            raise RuntimeError(
                "MONGODB_URI is not set in .env — add your MongoDB Atlas "
                "connection string before using persistence features."
            )
        _client = MongoClient(settings.mongodb_uri, tls=True, tlsCAFile=certifi.where())
    return _client["lie_of_omission_detector"]
