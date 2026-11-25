from typing import Any, TypedDict
from pydantic import BaseModel, Field


class ToolExecutionResult(BaseModel):
    tool: str
    success: bool
    data: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class AgentState(TypedDict, total=False):
    user_message: str
    history: list[dict[str, Any]]
    auth_token: str | None
    candidate_context: dict[str, Any] | None
    intent: str
    selected_tools: list[str]
    tool_results: list[dict[str, Any]]
    tools_used: list[str]
    final_response: str
    provider: str
    is_mock_response: bool
    model: str
