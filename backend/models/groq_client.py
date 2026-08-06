import base64
from typing import Optional

from openai import OpenAI

from core.config import settings
from models.model_client import ModelClient


class GroqClient(ModelClient):
    """Primary provider. Hosted and free (no credit card) — the person's
    machine does no inference work when this path is used.

    Groq exposes an OpenAI-compatible endpoint, so we reuse the `openai`
    package and just point it at Groq's base_url.
    """

    def __init__(self):
        self.client = OpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        )

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
        model = settings.groq_vision_model if image_path else settings.groq_text_model

        content = [{"type": "text", "text": prompt}]
        if image_path:
            b64 = self._encode_image(image_path)
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                }
            )

        extra_body = {}
        # qwen3-family models (currently our vision model) support
        # reasoning_effort — "none" fully disables the <think> reasoning
        # block that otherwise gets embedded directly in message content
        # and breaks downstream JSON parsing. gpt-oss models already
        # return reasoning in their own separate field, so they don't
        # need this.
        if "qwen" in model:
            extra_body["reasoning_effort"] = "none"

        response = self.client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": content}],
            temperature=0,
            timeout=settings.request_timeout_seconds,
            extra_body=extra_body,
        )
        return response.choices[0].message.content