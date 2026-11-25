from datetime import datetime
from pydantic import BaseModel, Field


class HealthDependencies(BaseModel):
    gemini_configured: bool
    gemini_model: str
    internal_auth_configured: bool


class HealthResponse(BaseModel):
    success: bool
    service: str
    status: str
    version: str
    environment: str
    timestamp: datetime
    dependencies: HealthDependencies


class EducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    duration: str = ""
    grade: str = ""
    highlights: str = ""


class ExperienceItem(BaseModel):
    role: str = ""
    company: str = ""
    location: str = ""
    duration: str = ""
    highlights: list[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str = ""
    techStack: list[str] = Field(default_factory=list)
    description: str = ""


class ParsedResumeProfile(BaseModel):
    summary: str = Field(..., description="Concise candidate career summary")
    atsScore: int = Field(..., ge=0, le=100, description="Estimated ATS readiness score")
    completionPercentage: int = Field(
        ..., ge=0, le=100, description="Resume section completeness percentage"
    )
    extractedSkills: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Categorized technical skills (e.g., Languages, Frameworks, Tools)",
    )
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)


class ResumeParseResponse(BaseModel):
    success: bool = True
    fileName: str
    fileSizeKb: int
    pageCount: int
    extractedText: str
    parsedProfile: ParsedResumeProfile


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: object | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
