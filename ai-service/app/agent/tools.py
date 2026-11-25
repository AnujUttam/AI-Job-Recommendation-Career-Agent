import logging
from typing import Any
import httpx

from app.config import settings
from app.schemas.embedding import JobSearchFilters
from app.services import embedding_service, qdrant_service

logger = logging.getLogger("careerai.agent.tools")

AVAILABLE_TOOL_NAMES = [
    "search_jobs",
    "get_candidate_profile",
    "get_resume_analysis",
    "recommend_jobs",
    "analyze_skill_gaps",
    "generate_career_roadmap",
]


def _normalize_bearer(auth_token: str | None) -> str | None:
    if not auth_token or not auth_token.strip():
        return None
    token = auth_token.strip()
    return token if token.lower().startswith("bearer ") else f"Bearer {token}"


def _backend_get(
    path: str,
    *,
    auth_token: str | None = None,
    params: dict[str, Any] | None = None,
    http_client: httpx.Client | None = None,
) -> dict[str, Any]:
    headers: dict[str, str] = {}
    bearer = _normalize_bearer(auth_token)
    if bearer:
        headers["Authorization"] = bearer

    url = f"{settings.backend_url.rstrip('/')}{path}"
    if http_client is not None:
        response = http_client.get(
            url, params=params, headers=headers, timeout=settings.backend_timeout_sec
        )
        response.raise_for_status()
        return response.json()

    with httpx.Client(timeout=settings.backend_timeout_sec) as client:
        response = client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()


def search_jobs(
    query: str,
    limit: int = 5,
    filters: JobSearchFilters | None = None,
    http_client: httpx.Client | None = None,
) -> dict[str, Any]:
    """Search jobs using semantic Qdrant search, falling back to backend search API."""
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return {
            "tool": "search_jobs",
            "success": False,
            "data": {"jobs": []},
            "error": "Search query cannot be empty.",
        }

    # 1. Try semantic search via local embedding model + Qdrant (fast-check Qdrant first)
    try:
        if qdrant_service.collection_exists():
            query_vec = embedding_service.embed_query(cleaned_query)
            hits = qdrant_service.search_jobs(
                query_vector=query_vec,
                limit=limit,
                filters=filters,
            )
            if hits:
                return {
                    "tool": "search_jobs",
                    "success": True,
                    "data": {"source": "qdrant_semantic", "jobs": hits},
                    "error": None,
                }
    except Exception as exc:
        logger.info("Semantic search unavailable (%s); trying backend search.", type(exc).__name__)

    # 2. Fall back to backend MongoDB search API
    try:
        params: dict[str, Any] = {"q": cleaned_query, "limit": limit}
        if filters:
            if filters.location:
                params["location"] = filters.location
            if filters.experienceLevel:
                params["experienceLevel"] = filters.experienceLevel
            if filters.workMode:
                params["workMode"] = filters.workMode
        payload = _backend_get("/api/jobs/search", params=params, http_client=http_client)
        jobs = payload.get("jobs", [])
        return {
            "tool": "search_jobs",
            "success": True,
            "data": {"source": payload.get("searchMode", "backend_search"), "jobs": jobs},
            "error": None,
        }
    except Exception as exc:
        return {
            "tool": "search_jobs",
            "success": False,
            "data": {"jobs": []},
            "error": f"Job search services unavailable ({type(exc).__name__}).",
        }


def get_candidate_profile(
    auth_token: str | None = None,
    candidate_context: dict[str, Any] | None = None,
    http_client: httpx.Client | None = None,
) -> dict[str, Any]:
    """Retrieve authenticated candidate profile from backend or passed request context."""
    if _normalize_bearer(auth_token):
        try:
            payload = _backend_get(
                "/api/users/profile", auth_token=auth_token, http_client=http_client
            )
            user = payload.get("user")
            if isinstance(user, dict):
                return {
                    "tool": "get_candidate_profile",
                    "success": True,
                    "data": {"source": "backend_api", "profile": user},
                    "error": None,
                }
        except Exception as exc:
            logger.info("Backend profile fetch failed (%s)", type(exc).__name__)

    if isinstance(candidate_context, dict) and candidate_context:
        return {
            "tool": "get_candidate_profile",
            "success": True,
            "data": {"source": "request_context", "profile": candidate_context},
            "error": None,
        }

    return {
        "tool": "get_candidate_profile",
        "success": False,
        "data": {"profile": None},
        "error": "Candidate profile unavailable (no active session or backend reachable).",
    }


def get_resume_analysis(
    auth_token: str | None = None,
    http_client: httpx.Client | None = None,
) -> dict[str, Any]:
    """Retrieve latest parsed resume and ATS analysis from backend."""
    if not _normalize_bearer(auth_token):
        return {
            "tool": "get_resume_analysis",
            "success": False,
            "data": {"hasResume": False, "resume": None},
            "error": "Authentication token required to retrieve private resume analysis.",
        }

    try:
        payload = _backend_get(
            "/api/resumes", auth_token=auth_token, http_client=http_client
        )
        resumes = payload.get("resumes", [])
        if not resumes:
            return {
                "tool": "get_resume_analysis",
                "success": True,
                "data": {"hasResume": False, "resume": None},
                "error": None,
            }
        latest = resumes[0]
        return {
            "tool": "get_resume_analysis",
            "success": True,
            "data": {"hasResume": True, "resume": latest},
            "error": None,
        }
    except Exception as exc:
        return {
            "tool": "get_resume_analysis",
            "success": False,
            "data": {"hasResume": False, "resume": None},
            "error": f"Failed to retrieve resume analysis ({type(exc).__name__}).",
        }


def recommend_jobs(
    auth_token: str | None = None,
    limit: int = 5,
    http_client: httpx.Client | None = None,
) -> dict[str, Any]:
    """Retrieve personalized hybrid job recommendations from backend."""
    if not _normalize_bearer(auth_token):
        return {
            "tool": "recommend_jobs",
            "success": False,
            "data": {"recommendations": []},
            "error": "Authentication token required for personalized job recommendations.",
        }

    try:
        payload = _backend_get(
            "/api/recommendations",
            auth_token=auth_token,
            params={"limit": limit},
            http_client=http_client,
        )
        recs = payload.get("recommendations", [])
        return {
            "tool": "recommend_jobs",
            "success": True,
            "data": {
                "rankingMode": payload.get("rankingMode", "backend_recommendations"),
                "recommendations": recs,
            },
            "error": None,
        }
    except Exception as exc:
        return {
            "tool": "recommend_jobs",
            "success": False,
            "data": {"recommendations": []},
            "error": f"Recommendation service unavailable ({type(exc).__name__}).",
        }


def analyze_skill_gaps(
    candidate_skills: list[str],
    target_jobs: list[dict[str, Any]],
    target_role: str | None = None,
) -> dict[str, Any]:
    """Compare candidate skills strictly against retrieved target job requirements."""
    if not target_jobs:
        return {
            "tool": "analyze_skill_gaps",
            "success": False,
            "data": {"comparisons": [], "topMissingSkills": []},
            "error": "No target job listings available to compare skills against.",
        }

    filtered_jobs = target_jobs
    if target_role and target_role.strip():
        token_matches = [
            job
            for job in target_jobs
            if target_role.strip().lower() in (job.get("title") or "").lower()
        ]
        if token_matches:
            filtered_jobs = token_matches

    normalized_candidate = {
        s.strip().lower() for s in (candidate_skills or []) if isinstance(s, str) and s.strip()
    }

    comparisons: list[dict[str, Any]] = []
    missing_counts: dict[str, int] = {}

    for job in filtered_jobs[:5]:
        req_skills = [
            s.strip()
            for s in (job.get("requiredSkills") or [])
            if isinstance(s, str) and s.strip()
        ]
        matched = [s for s in req_skills if s.lower() in normalized_candidate]
        missing = [s for s in req_skills if s.lower() not in normalized_candidate]

        for skill in missing:
            missing_counts[skill] = missing_counts.get(skill, 0) + 1

        coverage = round((len(matched) / len(req_skills)) * 100) if req_skills else 100
        comparisons.append(
            {
                "title": job.get("title", "Unknown Role"),
                "company": job.get("company", ""),
                "matchedSkills": matched,
                "missingSkills": missing,
                "skillCoveragePercent": coverage,
            }
        )

    ranked_missing = [
        skill for skill, _count in sorted(missing_counts.items(), key=lambda x: (-x[1], x[0]))
    ]

    return {
        "tool": "analyze_skill_gaps",
        "success": True,
        "data": {
            "candidateSkillCount": len(normalized_candidate),
            "comparisons": comparisons,
            "topMissingSkills": ranked_missing,
        },
        "error": None,
    }


def generate_career_roadmap(
    missing_skills: list[str],
    career_goal: str = "",
    experience_level: str = "",
    verified_skills: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a structured learning roadmap strictly grounded in identified skill gaps."""
    cleaned_gaps = [s.strip() for s in (missing_skills or []) if isinstance(s, str) and s.strip()]
    goal_label = career_goal.strip() or "your target engineering role"
    level_label = experience_level.strip() or "current experience level"
    verified_market_reqs = [
        s.strip() for s in (verified_skills or cleaned_gaps) if isinstance(s, str) and s.strip()
    ]

    if not cleaned_gaps:
        estimated_timeline = "4 Weeks"
        stages = [
            {
                "stage": 1,
                "title": "Resume & Impact Quantification",
                "timeline": "Week 1",
                "skillsToLearn": [],
                "suggestedProjects": [
                    f"Audit and refine top 2 portfolio READMEs for {goal_label} relevance."
                ],
                "milestones": [
                    "Add measurable latency, scale, or test-coverage metrics to top resume bullets."
                ],
            },
            {
                "stage": 2,
                "title": "Portfolio Depth & Automated Testing",
                "timeline": "Week 2",
                "skillsToLearn": [],
                "suggestedProjects": [
                    "Add integration tests and CI-ready checks to your primary repository."
                ],
                "milestones": ["Achieve clean automated test coverage on core user flows."],
            },
            {
                "stage": 3,
                "title": "System Design & Core Practice",
                "timeline": "Week 3",
                "skillsToLearn": [],
                "suggestedProjects": [
                    "Document architecture trade-offs for API scaling and vector search."
                ],
                "milestones": ["Complete 3 system-design walkthroughs relevant to your target role."],
            },
            {
                "stage": 4,
                "title": "Targeted Applications & Mock Interviews",
                "timeline": "Week 4",
                "skillsToLearn": [],
                "suggestedProjects": [
                    f"Prepare concise project pitch decks for {goal_label} interviews."
                ],
                "milestones": [
                    f"Apply to top matched roles suited for {level_label}.",
                    "Complete 2 timed technical and behavioral mock interviews.",
                ],
            },
        ]
    else:
        primary = cleaned_gaps[0]
        secondary = cleaned_gaps[1] if len(cleaned_gaps) > 1 else primary
        tertiary = cleaned_gaps[2] if len(cleaned_gaps) > 2 else secondary
        estimated_timeline = "4 Weeks" if len(cleaned_gaps) <= 3 else "6 Weeks"

        stages = [
            {
                "stage": 1,
                "title": f"Core Foundations: {primary}",
                "timeline": "Week 1",
                "skillsToLearn": [primary],
                "suggestedProjects": [
                    f"Build a focused mini-module integrating {primary} into an existing repository."
                ],
                "milestones": [
                    f"Complete official {primary} fundamentals and document core usage."
                ],
            },
            {
                "stage": 2,
                "title": f"Applied Practice: {secondary}",
                "timeline": "Week 2",
                "skillsToLearn": [secondary] if secondary != primary else [primary],
                "suggestedProjects": [
                    f"Implement validation, error handling, and unit tests using {secondary}."
                ],
                "milestones": [f"Ship a tested feature using {secondary} with clear README notes."],
            },
            {
                "stage": 3,
                "title": f"Integration & Architecture: {tertiary}",
                "timeline": "Week 3" if estimated_timeline == "4 Weeks" else "Weeks 3-4",
                "skillsToLearn": cleaned_gaps[2:4] if len(cleaned_gaps) > 2 else [tertiary],
                "suggestedProjects": [
                    f"Combine {primary}, {secondary}, and {tertiary} into an end-to-end portfolio demo."
                ],
                "milestones": [
                    "Update resume bullets and skills list with verified project outcomes."
                ],
            },
            {
                "stage": 4,
                "title": "Interview Prep & Job Alignment",
                "timeline": "Week 4" if estimated_timeline == "4 Weeks" else "Weeks 5-6",
                "skillsToLearn": cleaned_gaps[4:6],
                "suggestedProjects": [
                    f"Prepare architecture walkthroughs tailored to {goal_label} interviews."
                ],
                "milestones": [
                    "Re-run CareerAI skill gap analysis to verify improved match percentage.",
                    "Submit tailored applications to top matching roles.",
                ],
            },
        ]

    weeks = [
        {
            "week": s["stage"],
            "focus": s["title"],
            "actions": s["suggestedProjects"] + s["milestones"],
        }
        for s in stages
    ]

    return {
        "tool": "generate_career_roadmap",
        "success": True,
        "data": {
            "careerGoal": goal_label,
            "experienceLevel": level_label,
            "targetSkills": cleaned_gaps,
            "estimatedTimeline": estimated_timeline,
            "assumptions": [
                "Assumes 10-12 hours per week of focused study and hands-on implementation.",
                "Generated from deterministic roadmap templates grounded in your missing skills.",
            ],
            "verifiedMarketRequirements": verified_market_reqs,
            "generatedSuggestions": {
                "stages": stages,
                "isTemplateGenerated": True,
            },
            "stages": stages,
            "weeks": weeks,
        },
        "error": None,
    }
