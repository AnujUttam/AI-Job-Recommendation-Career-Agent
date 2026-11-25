import hmac
from typing import Any
from fastapi import Header

from app.config import settings


class ServiceError(Exception):
    """Structured domain exception converted to JSON error responses."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def verify_internal_api_key(
    x_internal_api_key: str | None = Header(default=None, alias="X-Internal-API-Key"),
) -> None:
    """Verify the shared internal API key for protected service-to-service routes."""
    configured_key = settings.internal_api_key.strip()
    if not configured_key:
        raise ServiceError(
            status_code=503,
            code="INTERNAL_AUTH_NOT_CONFIGURED",
            message="Internal API key authentication is not configured on the AI service.",
        )

    if not x_internal_api_key:
        raise ServiceError(
            status_code=401,
            code="MISSING_INTERNAL_API_KEY",
            message="Missing X-Internal-API-Key header.",
        )

    if not hmac.compare_digest(x_internal_api_key.strip(), configured_key):
        raise ServiceError(
            status_code=403,
            code="INVALID_INTERNAL_API_KEY",
            message="Invalid internal API key.",
        )


def verify_optional_internal_api_key(
    x_internal_api_key: str | None = Header(default=None, alias="X-Internal-API-Key"),
) -> None:
    """Verify X-Internal-API-Key only when INTERNAL_API_KEY is configured."""
    configured_key = settings.internal_api_key.strip()
    if not configured_key:
        return
    if not x_internal_api_key:
        raise ServiceError(
            status_code=401,
            code="MISSING_INTERNAL_API_KEY",
            message="Missing X-Internal-API-Key header.",
        )
    if not hmac.compare_digest(x_internal_api_key.strip(), configured_key):
        raise ServiceError(
            status_code=403,
            code="INVALID_INTERNAL_API_KEY",
            message="Invalid internal API key.",
        )
