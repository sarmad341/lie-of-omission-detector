from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Provider order ---
    # First provider in the chain that succeeds is used. Change these two
    # values (or the .env equivalents) to reorder providers without touching
    # any pipeline code.
    primary_provider: str = "groq"
    fallback_provider: str = "ollama"

    # --- Groq (hosted, free tier, no credit card) ---
    # Get a key at https://console.groq.com/keys
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_text_model: str = "openai/gpt-oss-120b"
    groq_vision_model: str = "qwen/qwen3.6-27b"

    # --- Ollama (local, free, last-resort fallback only) ---
    # Install from https://ollama.com if you want this fallback available.
    ollama_base_url: str = "http://localhost:11434"
    ollama_text_model: str = "llama3.1"
    ollama_vision_model: str = "qwen2.5vl"
    clerk_secret_key: str = ""
    clerk_jwks_url: str = "https://suitable-goldfish-48.clerk.accounts.dev/.well-known/jwks.json"

    request_timeout_seconds: int = 30

    mongodb_uri: str = ""


settings = Settings()