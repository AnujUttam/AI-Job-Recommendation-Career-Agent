import json
import logging
from abc import ABC, abstractmethod
from typing import Any
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.config import settings
from app.middleware.security import ServiceError
from app.agent.tools import AVAILABLE_TOOL_NAMES

logger = logging.getLogger("careerai.agent.llm")


class _IntentPlan(BaseModel):
    intent: str = Field(..., description="One of: job_search, recommendations, resume_review, skill_gap, career_roadmap, profile_summary, general_guidance")
    tools: list[str] = Field(default_factory=list)


INTENT_PLANNER_PROMPT = f"""
You are a routing planner for CareerAI's career assistant.
Classify the user's intent into one of:
- job_search
- recommendations
- resume_review
- skill_gap
- career_roadmap
- profile_summary
- general_guidance

Select only the relevant tools from: {", ".join(AVAILABLE_TOOL_NAMES)}.
""".strip()

SYNTHESIS_SYSTEM_PROMPT = """
You are CareerAI, a concise and practical AI career coach.
Strict grounding rules:
1. Base all job listings, match scores, skills, ATS scores, and profile details ONLY on the provided tool_results JSON.
2. NEVER invent job titles, companies, salaries, or resume facts not present in tool_results.
3. If a tool failed or returned empty data, state that clearly and tell the user what action (e.g., uploading a resume or syncing jobs) is needed.
4. Keep responses structured, actionable, and concise.
""".strip()


def heuristic_plan_intent(user_message: str) -> tuple[str, list[str]]:
    """Deterministic intent & tool selection shared as baseline and mock planner."""
    q = (user_message or "").lower()

    if any(k in q for k in ("roadmap", "study plan", "learning plan", "4-week", "weeks", "learn")):
        return "career_roadmap", [
            "get_candidate_profile",
            "get_resume_analysis",
            "recommend_jobs",
            "analyze_skill_gaps",
            "generate_career_roadmap",
        ]

    if any(k in q for k in ("gap", "missing", "lack", "upskill")):
        return "skill_gap", [
            "get_candidate_profile",
            "get_resume_analysis",
            "recommend_jobs",
            "analyze_skill_gaps",
        ]

    if any(k in q for k in ("resume", "ats", "cv", "bullet", "extract")):
        return "resume_review", ["get_candidate_profile", "get_resume_analysis"]

    if any(
        k in q
        for k in (
            "recommend",
            "best match",
            "best fit",
            "top job",
            "fit my",
            "jobs match",
            "match my skills",
        )
    ):
        return "recommendations", ["get_candidate_profile", "recommend_jobs"]

    if any(k in q for k in ("search", "find job", "jobs for", "roles in", "openings", "looking for")):
        return "job_search", ["search_jobs", "get_candidate_profile"]

    if any(k in q for k in ("profile", "my skills", "about me", "preferences")):
        return "profile_summary", ["get_candidate_profile", "get_resume_analysis"]

    return "general_guidance", ["get_candidate_profile", "recommend_jobs"]


class BaseAssistantLLM(ABC):
    provider_name: str
    is_mock: bool
    model_name: str

    @abstractmethod
    def plan_intent(self, user_message: str, history: list[dict[str, Any]]) -> tuple[str, list[str]]:
        raise NotImplementedError

    @abstractmethod
    def synthesize_response(
        self,
        user_message: str,
        history: list[dict[str, Any]],
        intent: str,
        tool_results: list[dict[str, Any]],
    ) -> str:
        raise NotImplementedError


class DeterministicMockLLMProvider(BaseAssistantLLM):
    """Clearly labelled deterministic mock provider used until Gemini credentials are configured."""

    provider_name = "mock"
    is_mock = True
    model_name = "deterministic-mock-v1"

    def plan_intent(self, user_message: str, _history: list[dict[str, Any]]) -> tuple[str, list[str]]:
        return heuristic_plan_intent(user_message)

    def synthesize_response(
        self,
        user_message: str,
        history: list[dict[str, Any]],
        intent: str,
        tool_results: list[dict[str, Any]],
    ) -> str:
        by_tool = {item.get("tool"): item for item in tool_results}
        lines: list[str] = [
            "[Mock Assistant Mode — configure GEMINI_API_KEY for live LLM generation]"
        ]

        profile_res = by_tool.get("get_candidate_profile")
        resume_res = by_tool.get("get_resume_analysis")
        search_res = by_tool.get("search_jobs")
        rec_res = by_tool.get("recommend_jobs")
        gap_res = by_tool.get("analyze_skill_gaps")
        roadmap_res = by_tool.get("generate_career_roadmap")

        if intent == "career_roadmap" and roadmap_res:
            if roadmap_res.get("success"):
                data = roadmap_res["data"]
                gaps = data.get("targetSkills") or []
                lines.append(
                    f"Structured 4-week roadmap for **{data.get('careerGoal')}**"
                    + (f" focusing on: {', '.join(gaps)}." if gaps else ":")
                )
                for week in data.get("weeks", []):
                    actions = "; ".join(week.get("actions", []))
                    lines.append(f"- Week {week['week']} ({week['focus']}): {actions}")
            else:
                lines.append(f"Could not build roadmap: {roadmap_res.get('error')}")

        elif intent == "skill_gap" and gap_res:
            if gap_res.get("success"):
                data = gap_res["data"]
                missing = data.get("topMissingSkills", [])
                if missing:
                    lines.append(
                        f"Top missing skills across your target roles: **{', '.join(missing[:6])}**."
                    )
                else:
                    lines.append("Your current profile already covers the required skills for the compared roles.")
                for comp in data.get("comparisons", [])[:3]:
                    lines.append(
                        f"- {comp['title']} ({comp['skillCoveragePercent']}% skill coverage; "
                        f"missing: {', '.join(comp['missingSkills']) or 'none'})"
                    )
            else:
                lines.append(f"Skill gap analysis unavailable: {gap_res.get('error')}")

        elif intent == "resume_review" and resume_res:
            if resume_res.get("success"):
                if not resume_res["data"].get("hasResume"):
                    lines.append(
                        "No uploaded resume was found for your account yet. Upload a PDF in Resume Analyzer to unlock ATS scoring and extracted skills."
                    )
                else:
                    resume = resume_res["data"]["resume"]
                    parsed = resume.get("parsedProfile", {})
                    lines.append(
                        f"Active resume **{resume.get('fileName', 'Resume.pdf')}** — "
                        f"ATS Score: **{parsed.get('atsScore', 0)}/100**, "
                        f"Completeness: **{parsed.get('completionPercentage', 0)}%**."
                    )
                    if parsed.get("summary"):
                        lines.append(parsed["summary"])
                    improvements = parsed.get("improvements") or []
                    if improvements:
                        lines.append("Top improvements: " + "; ".join(improvements[:3]))
            else:
                lines.append(f"Resume lookup failed: {resume_res.get('error')}")

        elif intent == "job_search" and search_res:
            if search_res.get("success"):
                jobs = search_res["data"].get("jobs", [])
                if not jobs:
                    lines.append("No matching jobs were found for that query in Qdrant or the job catalog.")
                else:
                    lines.append(f"Found {len(jobs)} matching jobs ({search_res['data'].get('source')}):")
                    for job in jobs[:5]:
                        lines.append(
                            f"- **{job.get('title')}** at {job.get('company')} "
                            f"({job.get('location')} • {job.get('workMode', '')})"
                        )
            else:
                lines.append(f"Job search unavailable: {search_res.get('error')}")

        elif rec_res:
            if rec_res.get("success"):
                recs = rec_res["data"].get("recommendations", [])
                if not recs:
                    lines.append("No job listings are currently indexed in the database.")
                else:
                    lines.append(
                        f"Top job recommendations ({rec_res['data'].get('rankingMode')}):"
                    )
                    for job in recs[:3]:
                        lines.append(
                            f"- **{job.get('title')}** at {job.get('company')} "
                            f"({job.get('matchPercentage')}% match • "
                            f"missing: {', '.join(job.get('missingSkills') or []) or 'none'})"
                        )
            else:
                lines.append(f"Recommendations unavailable: {rec_res.get('error')}")

        if len(lines) == 1:
            if profile_res and profile_res.get("success") and profile_res["data"].get("profile"):
                prof = profile_res["data"]["profile"]
                skills = prof.get("skills") or []
                lines.append(
                    f"Profile loaded for **{prof.get('name', 'Candidate')}** with {len(skills)} skills"
                    + (f" ({', '.join(skills[:6])})." if skills else ".")
                )
            else:
                lines.append(
                    "Ask me to search jobs, review your resume, analyze skill gaps, or generate a learning roadmap."
                )

        if history:
            lines.append(f"(Context turns considered: {len(history)})")

        return "\n".join(lines)


class GeminiLLMProvider(BaseAssistantLLM):
    """Live Google Gemini provider using google-genai SDK when GEMINI_API_KEY is configured."""

    provider_name = "gemini"
    is_mock = False

    def __init__(self, api_key: str, model_name: str, client: Any = None) -> None:
        self.model_name = model_name
        self._client = client or genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=settings.gemini_timeout_ms),
        )

    def plan_intent(self, user_message: str, history: list[dict[str, Any]]) -> tuple[str, list[str]]:
        try:
            recent = json.dumps(history[-6:], default=str)
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=f"Recent history: {recent}\nUser message: {user_message}",
                config=types.GenerateContentConfig(
                    system_instruction=INTENT_PLANNER_PROMPT,
                    response_mime_type="application/json",
                    response_schema=_IntentPlan,
                    temperature=0.0,
                ),
            )
            parsed = getattr(response, "parsed", None)
            if isinstance(parsed, _IntentPlan):
                valid_tools = [t for t in parsed.tools if t in AVAILABLE_TOOL_NAMES]
                return parsed.intent, valid_tools or heuristic_plan_intent(user_message)[1]
        except Exception as exc:
            logger.warning("Gemini intent planner failed (%s); falling back to heuristic plan.", type(exc).__name__)
        return heuristic_plan_intent(user_message)

    def synthesize_response(
        self,
        user_message: str,
        history: list[dict[str, Any]],
        intent: str,
        tool_results: list[dict[str, Any]],
    ) -> str:
        prompt_payload = {
            "intent": intent,
            "recent_history": history[-8:],
            "user_message": user_message,
            "tool_results": tool_results,
        }
        try:
            response = self._client.models.generate_content(
                model=self.model_name,
                contents=json.dumps(prompt_payload, default=str)[:24000],
                config=types.GenerateContentConfig(
                    system_instruction=SYNTHESIS_SYSTEM_PROMPT,
                    temperature=0.2,
                ),
            )
            text = (getattr(response, "text", None) or "").strip()
            if not text:
                raise ValueError("Empty response from Gemini.")
            return text
        except Exception as exc:
            logger.error("Gemini assistant synthesis failed (%s)", type(exc).__name__)
            raise ServiceError(
                status_code=502,
                code="GEMINI_ASSISTANT_ERROR",
                message="Failed to generate response with Gemini API.",
            ) from exc


def get_llm_provider() -> BaseAssistantLLM:
    """Select Gemini when configured, or clearly-labelled mock provider in unconfigured dev mode."""
    mode = (settings.assistant_provider or "auto").strip().lower()
    api_key = settings.gemini_api_key.strip()

    if mode == "mock":
        return DeterministicMockLLMProvider()

    if mode == "gemini":
        if not api_key:
            raise ServiceError(
                status_code=503,
                code="GEMINI_NOT_CONFIGURED",
                message="ASSISTANT_PROVIDER is set to 'gemini' but GEMINI_API_KEY is missing.",
            )
        return GeminiLLMProvider(api_key=api_key, model_name=settings.gemini_model)

    if api_key:
        return GeminiLLMProvider(api_key=api_key, model_name=settings.gemini_model)

    return DeterministicMockLLMProvider()
