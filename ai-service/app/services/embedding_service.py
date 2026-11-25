import logging
import math
import threading
from typing import Any

from app.config import settings
from app.middleware.security import ServiceError
from app.schemas.embedding import CandidateEmbeddingInput, JobEmbeddingInput

logger = logging.getLogger("careerai.embeddings")

_model_lock = threading.Lock()
_cached_model: Any = None
_cached_model_name: str | None = None


def is_model_loaded() -> bool:
    """Return whether the embedding model singleton is currently initialized in memory."""
    return _cached_model is not None


def reset_model_cache() -> None:
    """Reset the cached model instance (intended for unit tests)."""
    global _cached_model, _cached_model_name
    with _model_lock:
        _cached_model = None
        _cached_model_name = None


def get_embedding_model() -> Any:
    """Lazily load and cache the SentenceTransformer model once per process."""
    global _cached_model, _cached_model_name

    target_model = settings.embedding_model
    if _cached_model is not None and _cached_model_name == target_model:
        return _cached_model

    with _model_lock:
        if _cached_model is not None and _cached_model_name == target_model:
            return _cached_model

        try:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model: %s", target_model)
            model = SentenceTransformer(target_model)
            _cached_model = model
            _cached_model_name = target_model
            return _cached_model
        except Exception as exc:
            logger.error(
                "Failed to load embedding model=%s (%s)",
                target_model,
                type(exc).__name__,
            )
            raise ServiceError(
                status_code=503,
                code="EMBEDDING_MODEL_LOAD_FAILED",
                message="Unable to load configured embedding model.",
            ) from exc


def l2_normalize(vector: list[float]) -> list[float]:
    """Return a unit-length L2-normalized copy of the input vector."""
    floats = [float(x) for x in vector]
    norm = math.sqrt(sum(x * x for x in floats))
    if norm <= 1e-12:
        raise ServiceError(
            status_code=422,
            code="ZERO_NORM_EMBEDDING",
            message="Embedding model produced a zero-norm vector.",
        )
    return [x / norm for x in floats]


def _validate_non_empty_text(text: str, field_name: str = "text") -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        raise ServiceError(
            status_code=400,
            code="EMPTY_EMBEDDING_INPUT",
            message=f"Input '{field_name}' cannot be empty.",
        )
    return cleaned


def format_job_text(job: JobEmbeddingInput) -> str:
    """Build a structured semantic representation of a job posting."""
    parts = [f"Job Title: {job.title.strip()}"]
    if job.company.strip():
        parts.append(f"Company: {job.company.strip()}")
    if job.experienceLevel.strip():
        parts.append(f"Experience Level: {job.experienceLevel.strip()}")
    if job.location.strip() or job.workMode.strip():
        loc_info = " | ".join(p for p in [job.location.strip(), job.workMode.strip()] if p)
        parts.append(f"Location: {loc_info}")
    if job.employmentType.strip():
        parts.append(f"Employment Type: {job.employmentType.strip()}")
    if job.requiredSkills:
        skills = ", ".join(s.strip() for s in job.requiredSkills if s and s.strip())
        if skills:
            parts.append(f"Required Skills: {skills}")
    parts.append(f"Description: {job.description.strip()}")
    return "\n".join(parts)


def format_candidate_text(candidate: CandidateEmbeddingInput) -> str:
    """Build a structured semantic representation of a candidate profile."""
    parts: list[str] = []
    if candidate.headline.strip():
        parts.append(f"Headline: {candidate.headline.strip()}")
    if candidate.experienceLevel.strip():
        parts.append(f"Experience Level: {candidate.experienceLevel.strip()}")
    if candidate.desiredRoles:
        roles = ", ".join(r.strip() for r in candidate.desiredRoles if r and r.strip())
        if roles:
            parts.append(f"Desired Roles: {roles}")
    if candidate.skills:
        skills = ", ".join(s.strip() for s in candidate.skills if s and s.strip())
        if skills:
            parts.append(f"Skills: {skills}")
    if candidate.preferredLocations:
        locs = ", ".join(l.strip() for l in candidate.preferredLocations if l and l.strip())
        if locs:
            parts.append(f"Preferred Locations: {locs}")
    if candidate.summary.strip():
        parts.append(f"Summary: {candidate.summary.strip()}")

    combined = "\n".join(parts).strip()
    if not combined:
        raise ServiceError(
            status_code=400,
            code="EMPTY_EMBEDDING_INPUT",
            message="Candidate profile must include at least one non-empty field (skills, headline, roles, or summary).",
        )
    return combined


def embed_text(text: str, model: Any = None) -> list[float]:
    """Generate an L2-normalized 384-dimensional embedding vector for input text."""
    cleaned = _validate_non_empty_text(text, "text")
    encoder = model if model is not None else get_embedding_model()

    try:
        raw_vector = encoder.encode(
            cleaned,
            normalize_embeddings=True,
            convert_to_numpy=False,
        )
    except TypeError:
        raw_vector = encoder.encode(cleaned)
    except Exception as exc:
        logger.error("Embedding generation failed (%s)", type(exc).__name__)
        raise ServiceError(
            status_code=500,
            code="EMBEDDING_GENERATION_FAILED",
            message="Failed to generate embedding vector.",
        ) from exc

    if hasattr(raw_vector, "tolist"):
        raw_list = raw_vector.tolist()
    else:
        raw_list = list(raw_vector)

    normalized = l2_normalize(raw_list)
    expected_dim = settings.embedding_dimension
    if len(normalized) != expected_dim:
        raise ServiceError(
            status_code=500,
            code="EMBEDDING_DIMENSION_MISMATCH",
            message=f"Expected {expected_dim}-dimensional embedding, got {len(normalized)}.",
        )
    return normalized


def embed_query(query: str, model: Any = None) -> list[float]:
    """Generate a normalized embedding for a natural-language job search query."""
    cleaned = _validate_non_empty_text(query, "query")
    return embed_text(cleaned, model=model)


def embed_job(job: JobEmbeddingInput, model: Any = None) -> list[float]:
    """Generate a normalized embedding for a structured job description."""
    _validate_non_empty_text(job.title, "title")
    _validate_non_empty_text(job.description, "description")
    formatted = format_job_text(job)
    return embed_text(formatted, model=model)


def embed_candidate_profile(
    candidate: CandidateEmbeddingInput, model: Any = None
) -> list[float]:
    """Generate a normalized embedding for a candidate profile."""
    formatted = format_candidate_text(candidate)
    return embed_text(formatted, model=model)
