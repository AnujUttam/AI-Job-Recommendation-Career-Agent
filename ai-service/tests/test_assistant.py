from types import SimpleNamespace
import httpx
from fastapi.testclient import TestClient

from app.agent import (
    AVAILABLE_TOOL_NAMES,
    DeterministicMockLLMProvider,
    GeminiLLMProvider,
    run_career_assistant,
)
from app.agent import graph as agent_graph
from app.agent import tools as agent_tools
from app.config import settings
from app.main import app

client = TestClient(app)


def _mock_httpx_client(responses: dict[str, tuple[int, dict]]):
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path in responses:
            status, body = responses[path]
            return httpx.Response(status, json=body)
        return httpx.Response(404, json={"success": False, "message": "Not found"})

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_assistant_health_and_security(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "assistant_provider", "auto")
    res_health = client.get("/ai/assistant/health")
    assert res_health.status_code == 200
    body = res_health.json()
    assert body["activeProvider"] == "mock"
    assert body["isMockProvider"] is True
    assert body["availableTools"] == AVAILABLE_TOOL_NAMES

    monkeypatch.setattr(settings, "internal_api_key", "assistant-secret")
    res_missing = client.post("/ai/assistant/chat", json={"message": "hello"})
    assert res_missing.status_code == 401
    res_bad = client.post(
        "/ai/assistant/chat",
        headers={"X-Internal-API-Key": "wrong"},
        json={"message": "hello"},
    )
    assert res_bad.status_code == 403


def test_tools_independently(monkeypatch):
    # 1. search_jobs: Qdrant semantic path
    monkeypatch.setattr(agent_tools.qdrant_service, "collection_exists", lambda: True)
    monkeypatch.setattr(agent_tools.embedding_service, "embed_query", lambda _q: [0.1] * 384)
    monkeypatch.setattr(
        agent_tools.qdrant_service,
        "search_jobs",
        lambda **_kw: [{"jobId": "j1", "title": "AI Engineer", "company": "Veridian", "location": "Bengaluru"}],
    )
    res_sem = agent_tools.search_jobs("AI engineer")
    assert res_sem["success"] is True
    assert res_sem["data"]["source"] == "qdrant_semantic"
    assert res_sem["data"]["jobs"][0]["title"] == "AI Engineer"

    # 1b. search_jobs: fallback to backend search when Qdrant fails
    def fail_qdrant(**_kw):
        raise RuntimeError("Qdrant down")

    monkeypatch.setattr(agent_tools.qdrant_service, "search_jobs", fail_qdrant)
    http_jobs = _mock_httpx_client(
        {
            "/api/jobs/search": (
                200,
                {
                    "searchMode": "keyword_fallback",
                    "jobs": [{"title": "Python Developer", "company": "Kinetix", "location": "Hyderabad"}],
                },
            )
        }
    )
    res_fallback = agent_tools.search_jobs("Python", http_client=http_jobs)
    assert res_fallback["success"] is True
    assert res_fallback["data"]["jobs"][0]["title"] == "Python Developer"

    # 1c. search_jobs: graceful failure when both Qdrant and backend fail
    http_fail = _mock_httpx_client({"/api/jobs/search": (503, {"message": "DB down"})})
    res_search_fail = agent_tools.search_jobs("Python", http_client=http_fail)
    assert res_search_fail["success"] is False

    # 2. get_candidate_profile
    http_prof = _mock_httpx_client(
        {"/api/users/profile": (200, {"user": {"name": "Aarav", "skills": ["Python", "FastAPI"]}})}
    )
    res_prof = agent_tools.get_candidate_profile(auth_token="jwt-123", http_client=http_prof)
    assert res_prof["success"] is True
    assert res_prof["data"]["profile"]["name"] == "Aarav"

    res_prof_ctx = agent_tools.get_candidate_profile(
        auth_token=None, candidate_context={"name": "Fallback User"}
    )
    assert res_prof_ctx["success"] is True
    assert res_prof_ctx["data"]["source"] == "request_context"

    # 3. get_resume_analysis
    http_resume = _mock_httpx_client(
        {
            "/api/resumes": (
                200,
                {
                    "resumes": [
                        {
                            "fileName": "aarav.pdf",
                            "parsedProfile": {
                                "atsScore": 87,
                                "completionPercentage": 90,
                                "extractedSkills": {"Languages": ["Python"]},
                            },
                        }
                    ]
                },
            )
        }
    )
    res_resume = agent_tools.get_resume_analysis(auth_token="jwt-123", http_client=http_resume)
    assert res_resume["success"] is True
    assert res_resume["data"]["hasResume"] is True
    assert res_resume["data"]["resume"]["parsedProfile"]["atsScore"] == 87

    res_resume_unauth = agent_tools.get_resume_analysis(auth_token=None)
    assert res_resume_unauth["success"] is False

    # 4. recommend_jobs
    http_rec = _mock_httpx_client(
        {
            "/api/recommendations": (
                200,
                {
                    "rankingMode": "hybrid_semantic",
                    "recommendations": [
                        {
                            "title": "AI Engineer",
                            "company": "Veridian",
                            "matchPercentage": 91,
                            "requiredSkills": ["Python", "FastAPI", "Qdrant", "Docker"],
                        }
                    ],
                },
            )
        }
    )
    res_rec = agent_tools.recommend_jobs(auth_token="jwt-123", http_client=http_rec)
    assert res_rec["success"] is True
    assert res_rec["data"]["recommendations"][0]["matchPercentage"] == 91

    # 5. analyze_skill_gaps
    gap_res = agent_tools.analyze_skill_gaps(
        candidate_skills=["Python", "FastAPI"],
        target_jobs=res_rec["data"]["recommendations"],
    )
    assert gap_res["success"] is True
    assert gap_res["data"]["topMissingSkills"] == ["Docker", "Qdrant"]

    empty_gap = agent_tools.analyze_skill_gaps(candidate_skills=["Python"], target_jobs=[])
    assert empty_gap["success"] is False

    # 6. generate_career_roadmap
    roadmap = agent_tools.generate_career_roadmap(
        missing_skills=["Docker", "Qdrant"],
        career_goal="AI Engineer",
        experience_level="Entry Level",
    )
    assert roadmap["success"] is True
    assert len(roadmap["data"]["weeks"]) == 4
    assert len(roadmap["data"]["stages"]) == 4
    assert roadmap["data"]["estimatedTimeline"] == "4 Weeks"
    assert len(roadmap["data"]["assumptions"]) >= 1
    assert roadmap["data"]["verifiedMarketRequirements"] == ["Docker", "Qdrant"]
    assert roadmap["data"]["generatedSuggestions"]["isTemplateGenerated"] is True
    assert "Docker" in roadmap["data"]["weeks"][0]["focus"]


def test_langgraph_workflow_and_tool_failure_resilience(monkeypatch):
    monkeypatch.setattr(
        agent_graph,
        "get_candidate_profile",
        lambda **_kw: {
            "tool": "get_candidate_profile",
            "success": True,
            "data": {
                "profile": {
                    "name": "Aarav",
                    "skills": ["Python", "FastAPI"],
                    "preferences": {
                        "desiredRoles": ["AI Engineer"],
                        "experienceLevel": "Entry Level (0-2 yrs)",
                    },
                }
            },
            "error": None,
        },
    )
    monkeypatch.setattr(
        agent_graph,
        "get_resume_analysis",
        lambda **_kw: {"tool": "get_resume_analysis", "success": True, "data": {"hasResume": False, "resume": None}, "error": None},
    )
    monkeypatch.setattr(
        agent_graph,
        "recommend_jobs",
        lambda **_kw: {
            "tool": "recommend_jobs",
            "success": True,
            "data": {
                "rankingMode": "hybrid_semantic",
                "recommendations": [
                    {
                        "title": "AI Engineer",
                        "company": "Veridian",
                        "matchPercentage": 89,
                        "requiredSkills": ["Python", "FastAPI", "Qdrant"],
                    }
                ],
            },
            "error": None,
        },
    )

    state = run_career_assistant(
        user_message="Create a 4-week roadmap for my missing skills",
        history=[{"role": "user", "content": "Hi"}],
        auth_token="jwt-123",
        provider=DeterministicMockLLMProvider(),
    )
    assert state["intent"] == "career_roadmap"
    assert state["is_mock_response"] is True
    assert state["provider"] == "mock"
    assert "generate_career_roadmap" in state["tools_used"]
    assert "Qdrant" in state["final_response"]

    # Tool failures do not crash the graph
    monkeypatch.setattr(
        agent_graph,
        "recommend_jobs",
        lambda **_kw: {
            "tool": "recommend_jobs",
            "success": False,
            "data": {"recommendations": []},
            "error": "Backend offline",
        },
    )
    monkeypatch.setattr(
        agent_graph,
        "search_jobs",
        lambda **_kw: {
            "tool": "search_jobs",
            "success": False,
            "data": {"jobs": []},
            "error": "Qdrant offline",
        },
    )
    failed_state = run_career_assistant(
        user_message="What skills am I missing?",
        provider=DeterministicMockLLMProvider(),
    )
    assert failed_state["intent"] == "skill_gap"
    assert "unavailable" in failed_state["final_response"].lower()


def test_assistant_route_and_gemini_provider_with_mocked_sdk(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "assistant-secret")
    monkeypatch.setattr(settings, "gemini_api_key", "mock-gemini-key")
    monkeypatch.setattr(settings, "gemini_model", "gemini-2.5-flash")
    monkeypatch.setattr(settings, "assistant_provider", "gemini")

    class FakeGeminiModels:
        def generate_content(self, *, model, contents, config):
            if getattr(config, "response_schema", None) is not None:
                from app.agent.llm_provider import _IntentPlan

                return SimpleNamespace(
                    parsed=_IntentPlan(
                        intent="resume_review",
                        tools=["get_candidate_profile", "get_resume_analysis"],
                    )
                )
            return SimpleNamespace(
                text="Your resume is structured well; add latency metrics to your FastAPI project."
            )

    fake_client = SimpleNamespace(models=FakeGeminiModels())
    provider = GeminiLLMProvider(
        api_key="mock-key", model_name="gemini-2.5-flash", client=fake_client
    )

    monkeypatch.setattr("app.routes.assistant.get_llm_provider", lambda: provider)
    monkeypatch.setattr(
        agent_graph,
        "get_candidate_profile",
        lambda **_kw: {"tool": "get_candidate_profile", "success": True, "data": {"profile": {"name": "Aarav"}}, "error": None},
    )
    monkeypatch.setattr(
        agent_graph,
        "get_resume_analysis",
        lambda **_kw: {"tool": "get_resume_analysis", "success": True, "data": {"hasResume": False, "resume": None}, "error": None},
    )

    res = client.post(
        "/ai/assistant/chat",
        headers={"X-Internal-API-Key": "assistant-secret"},
        json={"message": "Review my resume", "history": []},
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["provider"] == "gemini"
    assert payload["isMockResponse"] is False
    assert payload["intent"] == "resume_review"
    assert "latency metrics" in payload["content"]
