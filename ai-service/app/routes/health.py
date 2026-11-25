from datetime import datetime, timezone
from fastapi import APIRouter

from app.config import settings
from app.schemas.resume import HealthDependencies, HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Return service status and dependency configuration readiness."""
    return HealthResponse(
        success=True,
        service="careerai-ai-service",
        status="ok",
        version=settings.app_version,
        environment=settings.environment,
        timestamp=datetime.now(timezone.utc),
        dependencies=HealthDependencies(
            gemini_configured=bool(settings.gemini_api_key.strip()),
            gemini_model=settings.gemini_model,
            internal_auth_configured=bool(settings.internal_api_key.strip()),
        ),
    )
