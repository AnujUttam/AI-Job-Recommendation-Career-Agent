import math
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient, models

from app.config import settings
from app.main import app
from app.middleware.security import ServiceError
from app.schemas.embedding import (
    CandidateEmbeddingInput,
    JobEmbeddingInput,
    JobIndexRequest,
    JobSearchFilters,
)
from app.services import embedding_service, qdrant_service

client = TestClient(app)


class FakeSentenceTransformer:
    """Deterministic lightweight encoder returning 384-dim vectors without network downloads."""

    load_count = 0

    def __init__(self, model_name: str) -> None:
        FakeSentenceTransformer.load_count += 1
        self.model_name = model_name

    def encode(self, text: str, normalize_embeddings: bool = True, convert_to_numpy: bool = False):
        # Produce deterministic, topic-sensitive unnormalized 384-dim vector to test normalization too
        lower = text.lower()
        vec = [0.05] * settings.embedding_dimension
        if "python" in lower or "fastapi" in lower:
            vec[0] = 5.0
            vec[1] = 2.0
        if "react" in lower or "tailwind" in lower:
            vec[2] = 5.0
            vec[3] = 2.0
        if "qdrant" in lower or "ai" in lower:
            vec[4] = 4.0
        if normalize_embeddings:
            norm = math.sqrt(sum(x * x for x in vec))
            return [x / norm for x in vec]
        return vec


class UnnormalizedFakeEncoder:
    def encode(self, text: str, **_kwargs):
        return [3.0 if i == 0 else 4.0 if i == 1 else 0.0 for i in range(384)]


def _l2_norm(vec: list[float]) -> float:
    return math.sqrt(sum(x * x for x in vec))


def test_embedding_dimensions_and_normalization():
    fake = FakeSentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    unnorm = UnnormalizedFakeEncoder()

    query_vec = embedding_service.embed_query("Python FastAPI AI Engineer", model=fake)
    assert len(query_vec) == 384
    assert math.isclose(_l2_norm(query_vec), 1.0, rel_tol=1e-6)

    job_vec = embedding_service.embed_job(
        JobEmbeddingInput(
            title="AI Engineer",
            company="Veridian AI",
            description="Build FastAPI and Qdrant pipelines.",
            requiredSkills=["Python", "FastAPI", "Qdrant"],
            experienceLevel="Entry Level (0-2 yrs)",
            location="Bengaluru",
            employmentType="Full-time",
            workMode="Hybrid",
        ),
        model=fake,
    )
    assert len(job_vec) == 384
    assert math.isclose(_l2_norm(job_vec), 1.0, rel_tol=1e-6)

    cand_vec = embedding_service.embed_candidate_profile(
        CandidateEmbeddingInput(
            headline="Backend & AI Developer",
            skills=["Python", "FastAPI", "Docker"],
            desiredRoles=["AI Engineer"],
        ),
        model=fake,
    )
    assert len(cand_vec) == 384
    assert math.isclose(_l2_norm(cand_vec), 1.0, rel_tol=1e-6)

    # Even if raw encoder skips normalization, embedding_service enforces unit norm
    enforced_vec = embedding_service.embed_text("normalize me", model=unnorm)
    assert len(enforced_vec) == 384
    assert math.isclose(_l2_norm(enforced_vec), 1.0, rel_tol=1e-6)
    assert math.isclose(enforced_vec[0], 0.6, rel_tol=1e-6)
    assert math.isclose(enforced_vec[1], 0.8, rel_tol=1e-6)


def test_embedding_empty_input_validation_and_model_caching(monkeypatch):
    embedding_service.reset_model_cache()
    FakeSentenceTransformer.load_count = 0

    try:
        embedding_service.embed_query("   ", model=FakeSentenceTransformer("test"))
        assert False, "Expected ServiceError for empty query"
    except ServiceError as exc:
        assert exc.status_code == 400
        assert exc.code == "EMPTY_EMBEDDING_INPUT"

    try:
        embedding_service.embed_candidate_profile(
            CandidateEmbeddingInput(), model=FakeSentenceTransformer("test")
        )
        assert False, "Expected ServiceError for empty candidate profile"
    except ServiceError as exc:
        assert exc.status_code == 400
        assert exc.code == "EMPTY_EMBEDDING_INPUT"

    import sentence_transformers

    monkeypatch.setattr(sentence_transformers, "SentenceTransformer", FakeSentenceTransformer)
    FakeSentenceTransformer.load_count = 0

    embedding_service.embed_query("first call")
    embedding_service.embed_query("second call")
    assert FakeSentenceTransformer.load_count == 1
    assert embedding_service.is_model_loaded() is True

    # Model loading failure test
    embedding_service.reset_model_cache()

    def failing_loader(_name):
        raise RuntimeError("Model download disabled")

    monkeypatch.setattr(sentence_transformers, "SentenceTransformer", failing_loader)
    try:
        embedding_service.embed_query("should fail")
        assert False, "Expected ServiceError when model load fails"
    except ServiceError as exc:
        assert exc.status_code == 503
        assert exc.code == "EMBEDDING_MODEL_LOAD_FAILED"


def test_qdrant_collection_config_upsert_delete_and_metadata_filtering():
    mem_qdrant = QdrantClient(location=":memory:")
    fake_encoder = FakeSentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    assert qdrant_service.collection_exists(client=mem_qdrant) is False
    created = qdrant_service.ensure_collection(client=mem_qdrant)
    assert created is True
    assert qdrant_service.collection_exists(client=mem_qdrant) is True

    # Verify collection vector config = 384 and COSINE
    info = mem_qdrant.get_collection(settings.qdrant_collection)
    assert info.config.params.vectors.size == 384
    assert info.config.params.vectors.distance == models.Distance.COSINE

    job1 = JobIndexRequest(
        jobId="mongo-job-101",
        title="Applied AI Engineer",
        company="Veridian AI",
        description="Python FastAPI Qdrant semantic search pipelines",
        requiredSkills=["Python", "FastAPI", "Qdrant"],
        experienceLevel="Entry Level (0-2 yrs)",
        location="Bengaluru",
        employmentType="Full-time",
        workMode="Hybrid",
    )
    job2 = JobIndexRequest(
        jobId="mongo-job-102",
        title="React Frontend Engineer",
        company="OrbitFlow",
        description="React Tailwind CSS dashboard engineering",
        requiredSkills=["React", "Tailwind CSS"],
        experienceLevel="Entry Level (0-2 yrs)",
        location="Remote",
        employmentType="Full-time",
        workMode="Remote",
    )

    p1 = qdrant_service.upsert_job(job1, embedding_service.embed_job(job1, model=fake_encoder), client=mem_qdrant)
    p1_dup = qdrant_service.upsert_job(job1, embedding_service.embed_job(job1, model=fake_encoder), client=mem_qdrant)
    p2 = qdrant_service.upsert_job(job2, embedding_service.embed_job(job2, model=fake_encoder), client=mem_qdrant)

    # Duplicate-safe deterministic UUID point IDs
    assert p1 == p1_dup
    assert p1 != p2
    assert mem_qdrant.count(settings.qdrant_collection).count == 2

    # Unfiltered similarity search ranks AI Engineer first for Python/Qdrant query
    q_vec = embedding_service.embed_query("Python FastAPI Qdrant AI", model=fake_encoder)
    hits = qdrant_service.search_jobs(q_vec, limit=5, client=mem_qdrant)
    assert len(hits) == 2
    assert hits[0]["jobId"] == "mongo-job-101"

    # Metadata filter by workMode + requiredSkills
    filtered_hits = qdrant_service.search_jobs(
        q_vec,
        limit=5,
        filters=JobSearchFilters(workMode="Remote", requiredSkills=["React"]),
        client=mem_qdrant,
    )
    assert len(filtered_hits) == 1
    assert filtered_hits[0]["jobId"] == "mongo-job-102"
    assert filtered_hits[0]["company"] == "OrbitFlow"

    # Delete job point
    qdrant_service.delete_job("mongo-job-102", client=mem_qdrant)
    assert mem_qdrant.count(settings.qdrant_collection).count == 1


def test_embedding_fastapi_routes(monkeypatch):
    embedding_service.reset_model_cache()
    qdrant_service.reset_qdrant_client_cache()
    monkeypatch.setattr(settings, "internal_api_key", "")

    fake_encoder = FakeSentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    mem_qdrant = QdrantClient(location=":memory:")

    monkeypatch.setattr(embedding_service, "get_embedding_model", lambda: fake_encoder)
    monkeypatch.setattr(qdrant_service, "get_qdrant_client", lambda: mem_qdrant)

    # 1. Health endpoint
    health_res = client.get("/ai/embedding/health")
    assert health_res.status_code == 200
    assert health_res.json()["dimension"] == 384
    assert health_res.json()["collection"] == "careerai_jobs"

    # 2. Generate embedding endpoint (valid + empty validation)
    gen_res = client.post(
        "/ai/embedding/generate",
        json={"input_type": "query", "text": "Python FastAPI engineer"},
    )
    assert gen_res.status_code == 200
    assert len(gen_res.json()["vector"]) == 384

    bad_res = client.post(
        "/ai/embedding/generate",
        json={"input_type": "query", "text": "   "},
    )
    assert bad_res.status_code == 422

    # 3. Index job + semantic search endpoint
    idx_res = client.post(
        "/ai/embedding/index-job",
        json={
            "jobId": "job-abc-1",
            "title": "Python Backend Developer",
            "company": "Kinetix",
            "description": "FastAPI, Qdrant, Docker backend APIs",
            "requiredSkills": ["Python", "FastAPI", "Qdrant"],
            "experienceLevel": "Entry Level (0-2 yrs)",
            "location": "Hyderabad",
            "employmentType": "Full-time",
            "workMode": "Hybrid",
        },
    )
    assert idx_res.status_code == 200
    assert idx_res.json()["indexed"] is True
    assert idx_res.json()["collection"] == "careerai_jobs"

    search_res = client.post(
        "/ai/embedding/search",
        json={
            "query": "Python Qdrant developer",
            "limit": 5,
            "filters": {"location": "Hyderabad"},
        },
    )
    assert search_res.status_code == 200
    assert search_res.json()["count"] == 1
    assert search_res.json()["results"][0]["jobId"] == "job-abc-1"

    # 4. Batch index + candidate semantic search endpoints
    batch_res = client.post(
        "/ai/embedding/index-jobs",
        json={
            "jobs": [
                {
                    "jobId": "job-batch-1",
                    "title": "React Frontend Developer",
                    "company": "OrbitFlow",
                    "description": "React Tailwind CSS UI",
                    "requiredSkills": ["React", "Tailwind CSS"],
                    "experienceLevel": "Entry Level (0-2 yrs)",
                    "location": "Remote",
                    "employmentType": "Full-time",
                    "workMode": "Remote",
                },
                {
                    "jobId": "job-batch-2",
                    "title": "Applied AI Engineer",
                    "company": "Veridian",
                    "description": "Python FastAPI Qdrant embeddings",
                    "requiredSkills": ["Python", "FastAPI", "Qdrant"],
                    "experienceLevel": "Entry Level (0-2 yrs)",
                    "location": "Bengaluru",
                    "employmentType": "Full-time",
                    "workMode": "Hybrid",
                },
            ]
        },
    )
    assert batch_res.status_code == 200
    assert batch_res.json()["indexedCount"] == 2

    cand_search = client.post(
        "/ai/embedding/search-candidate",
        json={
            "candidate": {
                "headline": "Python & Qdrant Engineer",
                "skills": ["Python", "FastAPI", "Qdrant"],
            },
            "limit": 3,
            "filters": {"workMode": "Hybrid"},
        },
    )
    assert cand_search.status_code == 200
    assert cand_search.json()["results"][0]["jobId"] == "job-batch-2"
