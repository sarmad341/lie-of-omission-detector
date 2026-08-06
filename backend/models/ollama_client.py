import base64
from typing import Optional

import requests

from core.config import settings
from models.model_client import ModelClient


class OllamaClient(ModelClient):
    """Fallback provider only. Local and free but uses the person's own
    compute — only invoked if Groq is unavailable or rate-limited, so the
    local machine takes the hit as a backup path, not on every call.

    Requires Ollama installed locally (https://ollama.com) with the
    configured model already pulled, e.g.:
        ollama pull qwen2.5vl
        ollama pull llama3.1
    """

    @staticmethod
    def _encode_image(image_path: str) -> str:
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def complete(
        self,
        prompt: str,
        image_path: Optional[str] = None,
        response_format: str = "json",
    ) -> str:
        model = settings.ollama_vision_model if image_path else settings.ollama_text_model
        payload = {"model": model, "prompt": prompt, "stream": False}
        if image_path:
            payload["images"] = [self._encode_image(image_path)]

        resp = requests.post(
            f"{settings.ollama_base_url}/api/generate",
            json=payload,
            timeout=settings.request_timeout_seconds,
        )
        resp.raise_for_status()
        return resp.json()["response"]
