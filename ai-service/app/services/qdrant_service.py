import logging
import threading
import uuid
from typing import Any
from qdrant_client import QdrantClient, models

from app.config import settings
from app.middleware.security import ServiceError
from app.schemas.embedding import JobIndexRequest, JobSearchFilters

logger = logging.getLogger("careerai.qdrant")

_client_lock = threading.Lock()
_cached_client: QdrantClient | None = None
_cached_client_key: tuple[str, str] | None = None


def reset_qdrant_client_cache() -> None:
    """Reset cached Qdrant client (intended for unit tests)."""
    global _cached_client, _cached_client_key
    with _client_lock:
        _cached_client = None
        _cached_client_key = None


def get_qdrant_client() -> QdrantClient:
    """Create or reuse a QdrantClient configured from environment variables."""
    global _cached_client, _cached_client_key

    key = (settings.qdrant_url, settings.qdrant_api_key)
    if _cached_client is not None and _cached_client_key == key:
        return _cached_client

    with _client_lock:
        if _cached_client is not None and _cached_client_key == key:
            return _cached_client

        _cached_client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            timeout=settings.qdrant_timeout_sec,
        )
        _cached_client_key = key
        return _cached_client


def job_id_to_point_id(job_id: str) -> str:
    """Deterministically map an arbitrary job ID string to a valid UUIDv5 for idempotent upserts."""
    cleaned = (job_id or "").strip()
    if not cleaned:
        raise ServiceError(
            status_code=400,
            code="INVALID_JOB_ID",
            message="jobId cannot be empty.",
        )
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"careerai-job:{cleaned}"))


def collection_exists(client: Any = None) -> bool:
    """Check whether the configured Qdrant jobs collection exists."""
    qdrant = client if client is not None else get_qdrant_client()
    collection_name = settings.qdrant_collection
    try:
        if hasattr(qdrant, "collection_exists"):
            return bool(qdrant.collection_exists(collection_name=collection_name))
        collections = qdrant.get_collections().collections
        return any(col.name == collection_name for col in collections)
    except Exception as exc:
        logger.error("Failed to check Qdrant collection (%s)", type(exc).__name__)
        raise ServiceError(
            status_code=503,
            code="QDRANT_UNAVAILABLE",
            message="Unable to connect to Qdrant vector database.",
        ) from exc


def ensure_collection(client: Any = None) -> bool:
    """Create the Qdrant collection with COSINE distance and 384 dims if missing."""
    qdrant = client if client is not None else get_qdrant_client()
    collection_name = settings.qdrant_collection

    if collection_exists(client=qdrant):
        return False

    try:
        qdrant.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=settings.embedding_dimension,
                distance=models.Distance.COSINE,
            ),
        )
        for field in (
            "location",
            "experienceLevel",
            "employmentType",
            "workMode",
            "requiredSkills",
        ):
            try:
                qdrant.create_payload_index(
                    collection_name=collection_name,
                    field_name=field,
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
            except Exception:
                # Non-fatal if client/version ignores payload index hints
                pass
        logger.info(
            "Created Qdrant collection '%s' (dim=%d, metric=COSINE)",
            collection_name,
            settings.embedding_dimension,
        )
        return True
    except Exception as exc:
        logger.error("Failed to create Qdrant collection (%s)", type(exc).__name__)
        raise ServiceError(
            status_code=503,
            code="QDRANT_COLLECTION_INIT_FAILED",
            message="Failed to initialize Qdrant jobs collection.",
        ) from exc


def _validate_vector_dimension(vector: list[float]) -> None:
    expected = settings.embedding_dimension
    if len(vector) != expected:
        raise ServiceError(
            status_code=400,
            code="INVALID_VECTOR_DIMENSION",
            message=f"Expected {expected}-dimensional vector, received {len(vector)}.",
        )


def upsert_job(
    job: JobIndexRequest,
    vector: list[float],
    client: Any = None,
) -> str:
    """Upsert a job embedding and metadata payload idempotently into Qdrant."""
    _validate_vector_dimension(vector)
    qdrant = client if client is not None else get_qdrant_client()
    ensure_collection(client=qdrant)

    point_id = job_id_to_point_id(job.jobId)
    payload = {
        "job_id": job.jobId.strip(),
        "title": job.title.strip(),
        "company": job.company.strip(),
        "location": job.location.strip(),
        "requiredSkills": [s.strip() for s in job.requiredSkills if s and s.strip()],
        "experienceLevel": job.experienceLevel.strip(),
        "employmentType": job.employmentType.strip(),
        "workMode": job.workMode.strip(),
    }

    try:
        qdrant.upsert(
            collection_name=settings.qdrant_collection,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            ],
            wait=True,
        )
        return point_id
    except Exception as exc:
        logger.error("Failed to upsert job_id=%s (%s)", job.jobId, type(exc).__name__)
        raise ServiceError(
            status_code=503,
            code="QDRANT_UPSERT_FAILED",
            message="Failed to store job embedding in Qdrant.",
        ) from exc


def upsert_jobs_batch(
    items: list[tuple[JobIndexRequest, list[float]]],
    client: Any = None,
) -> list[str]:
    """Batch upsert multiple job embeddings and payloads idempotently into Qdrant."""
    if not items:
        return []

    qdrant = client if client is not None else get_qdrant_client()
    ensure_collection(client=qdrant)

    points: list[models.PointStruct] = []
    point_ids: list[str] = []

    for job, vector in items:
        _validate_vector_dimension(vector)
        point_id = job_id_to_point_id(job.jobId)
        point_ids.append(point_id)
        points.append(
            models.PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "job_id": job.jobId.strip(),
                    "title": job.title.strip(),
                    "company": job.company.strip(),
                    "location": job.location.strip(),
                    "requiredSkills": [
                        s.strip() for s in job.requiredSkills if s and s.strip()
                    ],
                    "experienceLevel": job.experienceLevel.strip(),
                    "employmentType": job.employmentType.strip(),
                    "workMode": job.workMode.strip(),
                },
            )
        )

    try:
        qdrant.upsert(
            collection_name=settings.qdrant_collection,
            points=points,
            wait=True,
        )
        return point_ids
    except Exception as exc:
        logger.error("Failed to batch upsert %d jobs (%s)", len(points), type(exc).__name__)
        raise ServiceError(
            status_code=503,
            code="QDRANT_BATCH_UPSERT_FAILED",
            message="Failed to batch store job embeddings in Qdrant.",
        ) from exc


def delete_job(job_id: str, client: Any = None) -> str:
    """Delete a job point from Qdrant by its canonical job ID."""
    point_id = job_id_to_point_id(job_id)
    qdrant = client if client is not None else get_qdrant_client()

    if not collection_exists(client=qdrant):
        return point_id

    try:
        qdrant.delete(
            collection_name=settings.qdrant_collection,
            points_selector=models.PointIdsList(points=[point_id]),
            wait=True,
        )
        return point_id
    except Exception as exc:
        logger.error("Failed to delete job_id=%s (%s)", job_id, type(exc).__name__)
        raise ServiceError(
            status_code=503,
            code="QDRANT_DELETE_FAILED",
            message="Failed to delete job embedding from Qdrant.",
        ) from exc


def build_metadata_filter(filters: JobSearchFilters | None) -> models.Filter | None:
    """Translate JobSearchFilters into a Qdrant metadata Filter."""
    if filters is None:
        return None

    conditions: list[models.FieldCondition] = []

    exact_fields = {
        "location": filters.location,
        "experienceLevel": filters.experienceLevel,
        "employmentType": filters.employmentType,
        "workMode": filters.workMode,
    }
    for field_name, value in exact_fields.items():
        if value and value.strip() and value.strip().lower() != "all":
            conditions.append(
                models.FieldCondition(
                    key=field_name,
                    match=models.MatchValue(value=value.strip()),
                )
            )

    cleaned_skills = [s.strip() for s in filters.requiredSkills if s and s.strip()]
    if cleaned_skills:
        conditions.append(
            models.FieldCondition(
                key="requiredSkills",
                match=models.MatchAny(any=cleaned_skills),
            )
        )

    return models.Filter(must=conditions) if conditions else None


def search_jobs(
    query_vector: list[float],
    limit: int = 10,
    filters: JobSearchFilters | None = None,
    score_threshold: float | None = None,
    client: Any = None,
) -> list[dict[str, Any]]:
    """Perform vector similarity search with optional metadata filtering."""
    _validate_vector_dimension(query_vector)
    qdrant = client if client is not None else get_qdrant_client()

    if not collection_exists(client=qdrant):
        return []

    qdrant_filter = build_metadata_filter(filters)

    try:
        response = qdrant.query_points(
            collection_name=settings.qdrant_collection,
            query=query_vector,
            query_filter=qdrant_filter,
            limit=limit,
            with_payload=True,
            score_threshold=score_threshold,
        )
    except Exception as exc:
        logger.error("Qdrant similarity search failed (%s)", type(exc).__name__)
        raise ServiceError(
            status_code=503,
            code="QDRANT_SEARCH_FAILED",
            message="Failed to query Qdrant for matching jobs.",
        ) from exc

    points = getattr(response, "points", response) or []
    results: list[dict[str, Any]] = []
    for hit in points:
        payload = getattr(hit, "payload", None) or {}
        results.append(
            {
                "pointId": str(getattr(hit, "id", "")),
                "jobId": str(payload.get("job_id", "")),
                "score": float(getattr(hit, "score", 0.0)),
                "title": payload.get("title", ""),
                "company": payload.get("company", ""),
                "location": payload.get("location", ""),
                "requiredSkills": payload.get("requiredSkills", []),
                "experienceLevel": payload.get("experienceLevel", ""),
                "employmentType": payload.get("employmentType", ""),
                "workMode": payload.get("workMode", ""),
            }
        )
    return results


def get_qdrant_status(client: Any = None) -> dict[str, Any]:
    """Return non-throwing Qdrant connectivity and collection status."""
    collection_name = settings.qdrant_collection
    try:
        exists = collection_exists(client=client)
        return {
            "qdrant": "connected",
            "collection": collection_name,
            "collection_exists": exists,
        }
    except Exception:
        return {
            "qdrant": "unreachable",
            "collection": collection_name,
            "collection_exists": False,
        }
