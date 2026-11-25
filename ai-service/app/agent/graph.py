import logging
from typing import Any
from langgraph.graph import END, START, StateGraph

from app.agent.llm_provider import BaseAssistantLLM, get_llm_provider
from app.agent.state import AgentState
from app.agent.tools import (
    AVAILABLE_TOOL_NAMES,
    analyze_skill_gaps,
    generate_career_roadmap,
    get_candidate_profile,
    get_resume_analysis,
    recommend_jobs,
    search_jobs,
)

logger = logging.getLogger("careerai.agent.graph")


def _collect_skills(profile_result: dict[str, Any] | None, resume_result: dict[str, Any] | None) -> list[str]:
    skills: list[str] = []
    if profile_result and profile_result.get("success"):
        prof = profile_result["data"].get("profile") or {}
        skills.extend(prof.get("skills") or [])

    if resume_result and resume_result.get("success"):
        resume = resume_result["data"].get("resume") or {}
        extracted = (resume.get("parsedProfile") or {}).get("extractedSkills") or {}
        if isinstance(extracted, dict):
            for group in extracted.values():
                if isinstance(group, list):
                    skills.extend(group)

    seen: set[str] = set()
    unique: list[str] = []
    for item in skills:
        if isinstance(item, str) and item.strip():
            norm = item.strip().lower()
            if norm not in seen:
                seen.add(norm)
                unique.append(item.strip())
    return unique


def build_career_assistant_graph(provider: BaseAssistantLLM | None = None):
    """Compile the LangGraph StateGraph for the CareerAI Career Assistant."""
    llm = provider or get_llm_provider()

    def understand_intent_node(state: AgentState) -> dict[str, Any]:
        intent, selected_tools = llm.plan_intent(
            state.get("user_message", ""),
            state.get("history", []),
        )
        ordered = [t for t in selected_tools if t in AVAILABLE_TOOL_NAMES]
        return {
            "intent": intent,
            "selected_tools": ordered,
        }

    def execute_tools_node(state: AgentState) -> dict[str, Any]:
        selected = state.get("selected_tools", [])
        auth_token = state.get("auth_token")
        candidate_context = state.get("candidate_context")
        user_message = state.get("user_message", "")

        results: list[dict[str, Any]] = []
        used: list[str] = []
        profile_res: dict[str, Any] | None = None
        resume_res: dict[str, Any] | None = None
        jobs_list: list[dict[str, Any]] = []
        gap_res: dict[str, Any] | None = None

        if "get_candidate_profile" in selected:
            profile_res = get_candidate_profile(
                auth_token=auth_token,
                candidate_context=candidate_context,
            )
            results.append(profile_res)
            used.append("get_candidate_profile")

        if "get_resume_analysis" in selected:
            resume_res = get_resume_analysis(auth_token=auth_token)
            results.append(resume_res)
            used.append("get_resume_analysis")

        if "recommend_jobs" in selected:
            rec_res = recommend_jobs(auth_token=auth_token, limit=5)
            results.append(rec_res)
            used.append("recommend_jobs")
            if rec_res.get("success"):
                jobs_list.extend(rec_res["data"].get("recommendations") or [])

        if "search_jobs" in selected:
            search_res = search_jobs(query=user_message, limit=5)
            results.append(search_res)
            used.append("search_jobs")
            if search_res.get("success"):
                jobs_list.extend(search_res["data"].get("jobs") or [])

        if "analyze_skill_gaps" in selected:
            if not jobs_list and "search_jobs" not in selected:
                fallback_search = search_jobs(query=user_message, limit=5)
                if fallback_search.get("success"):
                    jobs_list.extend(fallback_search["data"].get("jobs") or [])

            candidate_skills = _collect_skills(profile_res, resume_res)
            gap_res = analyze_skill_gaps(
                candidate_skills=candidate_skills,
                target_jobs=jobs_list,
            )
            results.append(gap_res)
            used.append("analyze_skill_gaps")

        if "generate_career_roadmap" in selected:
            missing_skills: list[str] = []
            if gap_res and gap_res.get("success"):
                missing_skills = gap_res["data"].get("topMissingSkills") or []
            prof = (profile_res or {}).get("data", {}).get("profile") or {}
            prefs = prof.get("preferences") or {}
            desired = prefs.get("desiredRoles") or []
            career_goal = desired[0] if desired else ""
            experience_level = prefs.get("experienceLevel") or ""

            roadmap_res = generate_career_roadmap(
                missing_skills=missing_skills,
                career_goal=career_goal,
                experience_level=experience_level,
            )
            results.append(roadmap_res)
            used.append("generate_career_roadmap")

        return {
            "tool_results": results,
            "tools_used": used,
        }

    def synthesize_response_node(state: AgentState) -> dict[str, Any]:
        reply = llm.synthesize_response(
            user_message=state.get("user_message", ""),
            history=state.get("history", []),
            intent=state.get("intent", "general_guidance"),
            tool_results=state.get("tool_results", []),
        )
        return {
            "final_response": reply,
            "provider": llm.provider_name,
            "is_mock_response": llm.is_mock,
            "model": llm.model_name,
        }

    def route_after_intent(state: AgentState) -> str:
        if state.get("selected_tools"):
            return "execute_tools"
        return "synthesize_response"

    graph = StateGraph(AgentState)
    graph.add_node("understand_intent", understand_intent_node)
    graph.add_node("execute_tools", execute_tools_node)
    graph.add_node("synthesize_response", synthesize_response_node)

    graph.add_edge(START, "understand_intent")
    graph.add_conditional_edges(
        "understand_intent",
        route_after_intent,
        {
            "execute_tools": "execute_tools",
            "synthesize_response": "synthesize_response",
        },
    )
    graph.add_edge("execute_tools", "synthesize_response")
    graph.add_edge("synthesize_response", END)

    return graph.compile()


def run_career_assistant(
    *,
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    auth_token: str | None = None,
    candidate_context: dict[str, Any] | None = None,
    provider: BaseAssistantLLM | None = None,
) -> AgentState:
    """Invoke the compiled CareerAI LangGraph assistant workflow."""
    compiled = build_career_assistant_graph(provider=provider)
    initial_state: AgentState = {
        "user_message": user_message,
        "history": history or [],
        "auth_token": auth_token,
        "candidate_context": candidate_context,
        "tool_results": [],
        "tools_used": [],
    }
    return compiled.invoke(initial_state)
