import logging
from typing import Optional

from core.config import settings
from models.groq_client import GroqClient
from models.model_client import ModelClient
from models.ollama_client import OllamaClient

logger = logging.getLogger(__name__)

_PROVIDERS: dict[str, ModelClient] = {
    "groq": GroqClient(),
    "ollama": OllamaClient(),
}


def get_completion(
    prompt: str,
    image_path: Optional[str] = None,
    response_format: str = "json",
) -> str:
    """The ONLY function pipeline code should call — never a provider client
    directly. Tries the primary provider first, falls back to the secondary
    provider on any failure (PDR Section 4.3).
    """
    order = [settings.primary_provider, settings.fallback_provider]
    last_error: Exception | None = None

    for name in order:
        client = _PROVIDERS.get(name)
        if client is None:
            continue
        try:
            logger.info("Calling provider: %s", name)
            return client.complete(prompt, image_path=image_path, response_format=response_format)
        except Exception as exc:  # noqa: BLE001 - deliberately broad, we fall back on anything
            logger.warning("Provider '%s' failed: %s", name, exc)
            last_error = exc

    raise RuntimeError(f"All providers failed. Last error: {last_error}")
