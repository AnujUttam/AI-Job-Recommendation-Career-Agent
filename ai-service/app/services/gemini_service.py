import logging
import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.config import settings
from app.middleware.security import ServiceError
from app.schemas.resume import (
    EducationItem,
    ExperienceItem,
    ParsedResumeProfile,
    ProjectItem,
)

logger = logging.getLogger("careerai.gemini")


class _SkillCategory(BaseModel):
    category: str = Field(..., description="Category name e.g. Languages, Frameworks, DataAndAI, Tools")
    skills: list[str] = Field(default_factory=list)


class _GeminiResumeSchema(BaseModel):
    """Gemini-friendly structured output schema avoiding dynamic dict properties."""

    summary: str
    atsScore: int = Field(..., ge=0, le=100)
    completionPercentage: int = Field(..., ge=0, le=100)
    skillCategories: list[_SkillCategory] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)


RESUME_SYSTEM_PROMPT = """
You are an expert technical recruiter and ATS resume parser.
Extract structured candidate information strictly from the provided resume text.
Rules:
1. Never invent companies, degrees, dates, or skills not supported by the text.
2. Group skills cleanly under categories such as Languages, Frameworks, DataAndAI, CloudAndTools.
3. Score atsScore (0-100) and completionPercentage (0-100) realistically based on clarity, measurable impact, and section completeness.
4. Provide concise, actionable strengths and improvements.
""".strip()


def _map_to_parsed_profile(raw: _GeminiResumeSchema) -> ParsedResumeProfile:
    extracted_skills: dict[str, list[str]] = {}
    for group in raw.skillCategories:
        key = group.category.strip() or "General"
        cleaned = [skill.strip() for skill in group.skills if skill and skill.strip()]
        if cleaned:
            extracted_skills[key] = list(dict.fromkeys(cleaned))

    return ParsedResumeProfile(
        summary=raw.summary.strip(),
        atsScore=raw.atsScore,
        completionPercentage=raw.completionPercentage,
        extractedSkills=extracted_skills,
        education=raw.education,
        experience=raw.experience,
        projects=raw.projects,
        strengths=raw.strengths,
        improvements=raw.improvements,
    )


def extract_resume_profile(
    resume_text: str,
    client: genai.Client | None = None,
) -> ParsedResumeProfile:
    """Parse extracted resume text into a validated ParsedResumeProfile using Google Gemini."""
    api_key = settings.gemini_api_key.strip()
    if client is None and not api_key:
        raise ServiceError(
            status_code=503,
            code="GEMINI_NOT_CONFIGURED",
            message="GEMINI_API_KEY is not configured on the AI service.",
        )

    gemini_client = client or genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=settings.gemini_timeout_ms),
    )
    model_name = settings.gemini_model

    try:
        response = gemini_client.models.generate_content(
            model=model_name,
            contents=f"Parse the following resume text:\n\n{resume_text[:20000]}",
            config=types.GenerateContentConfig(
                system_instruction=RESUME_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=_GeminiResumeSchema,
                temperature=0.1,
            ),
        )
    except (TimeoutError, httpx.TimeoutException) as exc:
        logger.error("Gemini API request timed out for model=%s", model_name)
        raise ServiceError(
            status_code=504,
            code="GEMINI_TIMEOUT",
            message="Gemini API request timed out while parsing resume.",
        ) from exc
    except Exception as exc:
        if "timeout" in type(exc).__name__.lower() or "timed out" in str(exc).lower():
            logger.error("Gemini API request timed out for model=%s", model_name)
            raise ServiceError(
                status_code=504,
                code="GEMINI_TIMEOUT",
                message="Gemini API request timed out while parsing resume.",
            ) from exc
        logger.error("Gemini API call failed for model=%s (%s)", model_name, type(exc).__name__)
        raise ServiceError(
            status_code=502,
            code="GEMINI_API_ERROR",
            message="Failed to analyze resume with Gemini API.",
        ) from exc

    parsed_payload = getattr(response, "parsed", None)
    raw_text = getattr(response, "text", None)

    try:
        if isinstance(parsed_payload, _GeminiResumeSchema):
            schema_obj = parsed_payload
        elif isinstance(parsed_payload, dict):
            schema_obj = _GeminiResumeSchema.model_validate(parsed_payload)
        elif raw_text:
            schema_obj = _GeminiResumeSchema.model_validate_json(raw_text)
        else:
            raise ValueError("Empty response returned by Gemini.")
    except Exception as exc:
        logger.error("Gemini structured response validation failed (%s)", type(exc).__name__)
        raise ServiceError(
            status_code=502,
            code="GEMINI_INVALID_OUTPUT",
            message="Gemini returned an unexpected response structure.",
        ) from exc

    return _map_to_parsed_profile(schema_obj)
