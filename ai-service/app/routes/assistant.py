from fastapi import APIRouter, Depends, Header

from app.agent.graph import run_career_assistant
from app.agent.llm_provider import get_llm_provider
from app.agent.tools import AVAILABLE_TOOL_NAMES
from app.config import settings
from app.middleware.security import verify_internal_api_key
from app.schemas.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    AssistantHealthResponse,
    ToolTraceItem,
)

router = APIRouter(prefix="/ai/assistant", tags=["assistant"])


@router.get("/health", response_model=AssistantHealthResponse)
def assistant_health() -> AssistantHealthResponse:
    """Report LangGraph Career Assistant readiness, active LLM provider, and tools."""
    gemini_configured = bool(settings.gemini_api_key.strip())
    mode = (settings.assistant_provider or "auto").strip().lower()
    uses_gemini = (mode == "gemini" and gemini_configured) or (
        mode == "auto" and gemini_configured
    )

    return AssistantHealthResponse(
        success=True,
        status="ok",
        activeProvider="gemini" if uses_gemini else "mock",
        isMockProvider=not uses_gemini,
        geminiConfigured=gemini_configured,
        geminiModel=settings.gemini_model,
        availableTools=AVAILABLE_TOOL_NAMES,
        backendUrl=settings.backend_url,
    )


@router.post(
    "/chat",
    response_model=AssistantChatResponse,
    dependencies=[Depends(verify_internal_api_key)],
)
def assistant_chat(
    payload: AssistantChatRequest,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> AssistantChatResponse:
    """Run the LangGraph Career Assistant workflow and return a grounded reply."""
    provider = get_llm_provider()
    history_dicts = [msg.model_dump() for msg in payload.history]

    result = run_career_assistant(
        user_message=payload.message.strip(),
        history=history_dicts,
        auth_token=authorization,
        candidate_context=payload.userProfile,
        provider=provider,
    )

    trace = [
        ToolTraceItem(
            tool=item.get("tool", "unknown"),
            success=bool(item.get("success", False)),
            error=item.get("error"),
        )
        for item in result.get("tool_results", [])
    ]

    return AssistantChatResponse(
        success=True,
        intent=result.get("intent", "general_guidance"),
        content=result.get("final_response", ""),
        toolsUsed=result.get("tools_used", []),
        toolTrace=trace,
        provider=result.get("provider", provider.provider_name),
        isMockResponse=bool(result.get("is_mock_response", provider.is_mock)),
        model=result.get("model", provider.model_name),
    )
