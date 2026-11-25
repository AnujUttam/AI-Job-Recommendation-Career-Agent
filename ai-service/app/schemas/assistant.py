from typing import Any, Literal
from pydantic import BaseModel, Field


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=8000)


class AssistantChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    userProfile: dict[str, Any] | None = None
    conversationId: str | None = None


class ToolTraceItem(BaseModel):
    tool: str
    success: bool
    error: str | None = None


class AssistantChatResponse(BaseModel):
    success: bool = True
    intent: str
    content: str
    toolsUsed: list[str] = Field(default_factory=list)
    toolTrace: list[ToolTraceItem] = Field(default_factory=list)
    provider: str
    isMockResponse: bool
    model: str


class AssistantHealthResponse(BaseModel):
    success: bool = True
    status: str
    activeProvider: str
    isMockProvider: bool
    geminiConfigured: bool
    geminiModel: str
    availableTools: list[str]
    backendUrl: str
