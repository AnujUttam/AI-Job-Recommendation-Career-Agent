import logging
import time
from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware.security import ServiceError
from app.routes.assistant import router as assistant_router
from app.routes.embeddings import router as embeddings_router
from app.routes.health import router as health_router
from app.routes.resume import router as resume_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("careerai.http")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="FastAPI AI microservice for PDF resume validation, extraction, and Gemini structured parsing.",
)

# Mount CORS only when explicit origins are configured in the environment.
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-Internal-API-Key"],
    )


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log minimal request metadata without exposing headers, bodies, or resume text."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    client_host = request.client.host if request.client else "unknown"

    logger.info(
        "%s %s status=%d duration_ms=%.2f client=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        client_host,
    )
    return response


@app.exception_handler(ServiceError)
async def service_error_handler(_request: Request, exc: ServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    safe_details = jsonable_encoder(exc.errors(), custom_encoder={Exception: str})
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "REQUEST_VALIDATION_ERROR",
                "message": "Invalid request payload.",
                "details": safe_details,
            },
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": "HTTP_ERROR",
                "message": str(exc.detail),
                "details": None,
            },
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error in AI service (%s)", type(exc).__name__)
    message = (
        f"Internal server error: {type(exc).__name__}"
        if settings.environment == "development"
        else "Internal server error"
    )
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": message,
                "details": None,
            },
        },
    )


app.include_router(health_router)
app.include_router(resume_router)
app.include_router(embeddings_router)
app.include_router(assistant_router)
