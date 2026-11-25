from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "CareerAI AI Service"
    app_version: str = "0.3.0"
    environment: str = "development"
    ai_port: int = 8000

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_ms: int = 20000
    internal_api_key: str = ""
    max_resume_file_size_mb: int = 5
    cors_origins: str = ""

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "careerai_jobs"
    qdrant_timeout_sec: float = 1.5

    backend_url: str = "http://localhost:5000"
    backend_timeout_sec: float = 5.0
    assistant_provider: str = "auto"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("gemini_model", mode="before")
    @classmethod
    def default_model_if_empty(cls, value: str | None) -> str:
        if not value or not str(value).strip():
            return "gemini-2.5-flash"
        return str(value).strip()

    @field_validator("embedding_model", mode="before")
    @classmethod
    def default_embedding_model_if_empty(cls, value: str | None) -> str:
        if not value or not str(value).strip():
            return "sentence-transformers/all-MiniLM-L6-v2"
        return str(value).strip()

    @field_validator("qdrant_collection", mode="before")
    @classmethod
    def default_qdrant_collection_if_empty(cls, value: str | None) -> str:
        if not value or not str(value).strip():
            return "careerai_jobs"
        return str(value).strip()

    @property
    def max_resume_file_size_bytes(self) -> int:
        mb = self.max_resume_file_size_mb if self.max_resume_file_size_mb > 0 else 5
        return mb * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
