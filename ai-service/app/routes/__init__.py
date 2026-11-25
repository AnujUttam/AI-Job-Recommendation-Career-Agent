from app.routes.assistant import router as assistant_router
from app.routes.embeddings import router as embeddings_router
from app.routes.health import router as health_router
from app.routes.resume import router as resume_router

__all__ = ["assistant_router", "embeddings_router", "health_router", "resume_router"]
