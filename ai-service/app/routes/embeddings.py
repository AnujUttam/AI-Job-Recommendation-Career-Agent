from fastapi import APIRouter, Depends

from app.config import settings
from app.middleware.security import verify_optional_internal_api_key
from app.schemas.embedding import (
    BatchJobIndexRequest,
    BatchJobIndexResponse,
    CandidateSearchRequest,
    EmbeddingGenerateRequest,
    EmbeddingGenerateResponse,
    EmbeddingHealthResponse,
    JobIndexRequest,
    JobIndexResponse,
    SemanticJobHit,
    SemanticJobSearchRequest,
    SemanticJobSearchResponse,
)
from app.services.embedding_service import (
    embed_candidate_profile,
    embed_job,
    embed_query,
    is_model_loaded,
)
from app.services.qdrant_service import (
    collection_exists,
    delete_job,
    get_qdrant_status,
    search_jobs,
    upsert_job,
    upsert_jobs_batch,
)

router = APIRouter(prefix="/ai/embedding", tags=["embeddings"])


@router.get("/health", response_model=EmbeddingHealthResponse)
def embedding_health() -> EmbeddingHealthResponse:
    """Report embedding model configuration and Qdrant collection readiness."""
    qdrant_info = get_qdrant_status()
    model_ready = is_model_loaded()

    return EmbeddingHealthResponse(
        success=True,
        status="ok",
        model=settings.embedding_model,
        dimension=settings.embedding_dimension,
        model_loaded=model_ready,
        qdrant=qdrant_info["qdrant"],
        qdrant_url=settings.qdrant_url,
        collection=qdrant_info["collection"],
        collection_exists=qdrant_info["collection_exists"],
    )


@router.post(
    "/generate",
    response_model=EmbeddingGenerateResponse,
    dependencies=[Depends(verify_optional_internal_api_key)],
)
def generate_embedding(payload: EmbeddingGenerateRequest) -> EmbeddingGenerateResponse:
    """Generate a normalized 384-dim embedding for a query, job, or candidate profile."""
    if payload.input_type == "job" and payload.job is not None:
        vector = embed_job(payload.job)
    elif payload.input_type == "candidate" and payload.candidate is not None:
        vector = embed_candidate_profile(payload.candidate)
    else:
        vector = embed_query(payload.text or "")

    return EmbeddingGenerateResponse(
        success=True,
        model=settings.embedding_model,
        dimension=len(vector),
        normalized=True,
        input_type=payload.input_type,
        vector=vector,
    )


@router.post(
    "/index-job",
    response_model=JobIndexResponse,
    dependencies=[Depends(verify_optional_internal_api_key)],
)
def index_job(payload: JobIndexRequest) -> JobIndexResponse:
    """Generate job embedding and upsert job vector + metadata into Qdrant."""
    vector = embed_job(payload)
    point_id = upsert_job(payload, vector)

    return JobIndexResponse(
        success=True,
        collection=settings.qdrant_collection,
        jobId=payload.jobId.strip(),
        pointId=point_id,
        dimension=len(vector),
        indexed=True,
    )


@router.post(
    "/index-jobs",
    response_model=BatchJobIndexResponse,
    dependencies=[Depends(verify_optional_internal_api_key)],
)
def index_jobs_batch(payload: BatchJobIndexRequest) -> BatchJobIndexResponse:
    """Batch embed and upsert multiple MongoDB jobs into Qdrant."""
    items = [(job, embed_job(job)) for job in payload.jobs]
    point_ids = upsert_jobs_batch(items)

    return BatchJobIndexResponse(
        success=True,
        collection=settings.qdrant_collection,
        indexedCount=len(point_ids),
        pointIds=point_ids,
    )


@router.post(
    "/search",
    response_model=SemanticJobSearchResponse,
    dependencies=[Depends(verify_optional_internal_api_key)],
)
def semantic_search_jobs(payload: SemanticJobSearchRequest) -> SemanticJobSearchResponse:
    """Search Qdrant for semantically similar jobs with optional metadata filtering."""
    if not collection_exists():
        return SemanticJobSearchResponse(
            success=True,
            collection=settings.qdrant_collection,
            count=0,
            results=[],
        )

    query_vector = embed_query(payload.query)
    hits = search_jobs(
        query_vector=query_vector,
        limit=payload.limit,
        filters=payload.filters,
        score_threshold=payload.scoreThreshold,
    )

    return SemanticJobSearchResponse(
        success=True,
        collection=settings.qdrant_collection,
        count=len(hits),
        results=[SemanticJobHit(**hit) for hit in hits],
    )


@router.post(
    "/search-candidate",
    response_model=SemanticJobSearchResponse,
    dependencies=[Depends(verify_optional_internal_api_key)],
)
def semantic_search_by_candidate(
    payload: CandidateSearchRequest,
) -> SemanticJobSearchResponse:
    """Embed a candidate profile and retrieve semantically matching jobs from Qdrant."""
    if not collection_exists():
        return SemanticJobSearchResponse(
            success=True,
            collection=settings.qdrant_collection,
            count=0,
            results=[],
        )

    candidate_vector = embed_candidate_profile(payload.candidate)
    hits = search_jobs(
        query_vector=candidate_vector,
        limit=payload.limit,
        filters=payload.filters,
        score_threshold=payload.scoreThreshold,
    )

    return SemanticJobSearchResponse(
        success=True,
        collection=settings.qdrant_collection,
        count=len(hits),
        results=[SemanticJobHit(**hit) for hit in hits],
    )


@router.delete(
    "/jobs/{job_id}",
    dependencies=[Depends(verify_optional_internal_api_key)],
)
def delete_indexed_job(job_id: str) -> dict[str, object]:
    """Remove a job vector from Qdrant by job ID."""
    point_id = delete_job(job_id)
    return {
        "success": True,
        "collection": settings.qdrant_collection,
        "jobId": job_id,
        "pointId": point_id,
        "deleted": True,
    }
