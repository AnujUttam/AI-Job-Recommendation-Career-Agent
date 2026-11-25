from typing import Literal
from pydantic import BaseModel, Field, model_validator


class JobEmbeddingInput(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    company: str = Field(default="", max_length=150)
    description: str = Field(..., min_length=1)
    requiredSkills: list[str] = Field(default_factory=list)
    experienceLevel: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=120)
    employmentType: str = Field(default="", max_length=80)
    workMode: str = Field(default="", max_length=80)


class CandidateEmbeddingInput(BaseModel):
    headline: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=4000)
    skills: list[str] = Field(default_factory=list)
    experienceLevel: str = Field(default="", max_length=80)
    desiredRoles: list[str] = Field(default_factory=list)
    preferredLocations: list[str] = Field(default_factory=list)


class EmbeddingGenerateRequest(BaseModel):
    input_type: Literal["query", "job", "candidate"] = "query"
    text: str | None = None
    job: JobEmbeddingInput | None = None
    candidate: CandidateEmbeddingInput | None = None

    @model_validator(mode="after")
    def validate_matching_payload(self) -> "EmbeddingGenerateRequest":
        if self.input_type == "query" and (not self.text or not self.text.strip()):
            raise ValueError("'text' is required when input_type is 'query'.")
        if self.input_type == "job" and self.job is None:
            raise ValueError("'job' payload is required when input_type is 'job'.")
        if self.input_type == "candidate" and self.candidate is None:
            raise ValueError("'candidate' payload is required when input_type is 'candidate'.")
        return self


class EmbeddingGenerateResponse(BaseModel):
    success: bool = True
    model: str
    dimension: int
    normalized: bool = True
    input_type: str
    vector: list[float]


class JobIndexRequest(JobEmbeddingInput):
    jobId: str = Field(..., min_length=1, max_length=128)


class JobIndexResponse(BaseModel):
    success: bool = True
    collection: str
    jobId: str
    pointId: str
    dimension: int
    indexed: bool = True


class BatchJobIndexRequest(BaseModel):
    jobs: list[JobIndexRequest] = Field(..., min_length=1, max_length=200)


class BatchJobIndexResponse(BaseModel):
    success: bool = True
    collection: str
    indexedCount: int
    pointIds: list[str]


class CandidateSearchRequest(BaseModel):
    candidate: CandidateEmbeddingInput
    limit: int = Field(default=10, ge=1, le=50)
    scoreThreshold: float | None = Field(default=None, ge=0.0, le=1.0)
    filters: "JobSearchFilters | None" = None


class JobSearchFilters(BaseModel):
    location: str | None = None
    experienceLevel: str | None = None
    employmentType: str | None = None
    workMode: str | None = None
    requiredSkills: list[str] = Field(default_factory=list)


class SemanticJobSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)
    scoreThreshold: float | None = Field(default=None, ge=0.0, le=1.0)
    filters: JobSearchFilters | None = None


class SemanticJobHit(BaseModel):
    pointId: str
    jobId: str
    score: float
    title: str = ""
    company: str = ""
    location: str = ""
    requiredSkills: list[str] = Field(default_factory=list)
    experienceLevel: str = ""
    employmentType: str = ""
    workMode: str = ""


class SemanticJobSearchResponse(BaseModel):
    success: bool = True
    collection: str
    count: int
    results: list[SemanticJobHit]


class EmbeddingHealthResponse(BaseModel):
    success: bool = True
    status: str
    model: str
    dimension: int
    model_loaded: bool
    qdrant: str
    qdrant_url: str
    collection: str
    collection_exists: bool
