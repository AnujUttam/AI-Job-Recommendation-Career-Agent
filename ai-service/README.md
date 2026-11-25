# CareerAI — AI Service

Python FastAPI microservice for PDF resume validation/parsing, SentenceTransformer embeddings (`all-MiniLM-L6-v2`), Qdrant semantic job search, and the LangGraph-powered Career Assistant.

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | For live Gemini LLM | Google Gemini API key (never commit `.env`). |
| `GEMINI_MODEL` | Optional | Gemini model name (defaults to `gemini-2.5-flash` in `app/config.py`). |
| `ASSISTANT_PROVIDER` | Optional | `auto` (default: uses Gemini when `GEMINI_API_KEY` is set, otherwise `mock`), `gemini`, or `mock`. |
| `INTERNAL_API_KEY` | For `/ai/parse-resume` & `/ai/assistant/chat` | Shared secret sent in `X-Internal-API-Key` header by Express. |
| `BACKEND_URL` | For Career Assistant tools | Express backend base URL (default `http://localhost:5000`). |
| `MAX_RESUME_FILE_SIZE_MB` | Optional | Maximum PDF upload size in MB (default `5`). |
| `EMBEDDING_MODEL` | Optional | SentenceTransformer model (default `sentence-transformers/all-MiniLM-L6-v2`). |
| `EMBEDDING_DIMENSION` | Optional | Vector dimension (default `384`). |
| `QDRANT_URL` | For live Qdrant | Qdrant endpoint (local `http://localhost:6333` or Qdrant Cloud URL). |
| `QDRANT_API_KEY` | For Qdrant Cloud | Qdrant Cloud API key (leave empty for unauthenticated local Qdrant). |
| `QDRANT_COLLECTION` | Optional | Qdrant collection name (default `careerai_jobs`). |
| `CORS_ORIGINS` | Optional | Comma-separated origins if browser access is needed; empty by default. |
| `AI_PORT` | Optional | Port for Uvicorn (default `8000`). |

## LangGraph Career Assistant Architecture

The Career Assistant is implemented as a modular `StateGraph` (`app/agent/graph.py`):

1. **`understand_intent`**: Classifies user intent (`job_search`, `recommendations`, `resume_review`, `skill_gap`, `career_roadmap`, `profile_summary`, `general_guidance`) and selects the required tools.
2. **`execute_tools`**: Runs only the selected tools safely in dependency order and records structured `tool_results` + `toolTrace`.
3. **`synthesize_response`**: Generates the final grounded response from `tool_results` and conversation `history`.

### Available Tools (`app/agent/tools.py`)
- `search_jobs`: Semantic Qdrant vector search with automatic fallback to backend `GET /api/jobs/search`.
- `get_candidate_profile`: Retrieves authenticated user profile via `GET /api/users/profile` (or request context fallback).
- `get_resume_analysis`: Retrieves parsed resume & ATS metrics via `GET /api/resumes`.
- `recommend_jobs`: Retrieves hybrid ranked recommendations via `GET /api/recommendations`.
- `analyze_skill_gaps`: Compares candidate skills against target job `requiredSkills`.
- `generate_career_roadmap`: Builds a 4-week learning plan grounded in actual missing skills.

### Mock vs. Live Gemini Provider (`app/agent/llm_provider.py`)
- **Without `GEMINI_API_KEY` (`ASSISTANT_PROVIDER=auto` or `mock`):** Runs `DeterministicMockLLMProvider`, explicitly marking responses with `provider: "mock"` and `isMockResponse: true` (never disguised as live Gemini output).
- **With `GEMINI_API_KEY` (`ASSISTANT_PROVIDER=auto` or `gemini`):** Runs `GeminiLLMProvider` via the official `google-genai` SDK using `settings.gemini_model` (`provider: "gemini"`, `isMockResponse: false`).
- **Conversation Memory:** Stored canonically in MongoDB via the Express `/api/conversations` APIs (`conversationController.js`), avoiding duplicate conversation databases.

## Setup & Run

```powershell
# Activate virtual environment
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health` — Service & Gemini configuration readiness.
- `POST /ai/parse-resume` — Protected by `X-Internal-API-Key`. Validates PDF and extracts `parsedProfile`.
- `GET /ai/embedding/health` — Embedding model & Qdrant collection (`careerai_jobs`) readiness.
- `POST /ai/embedding/generate` — L2-normalized 384-dim embeddings (`query`, `job`, `candidate`).
- `POST /ai/embedding/index-job`, `POST /ai/embedding/index-jobs`, `DELETE /ai/embedding/jobs/{job_id}` — Upsert or delete job vectors in Qdrant.
- `POST /ai/embedding/search`, `POST /ai/embedding/search-candidate` — Vector similarity search with metadata filters.
- `GET /ai/assistant/health` — Assistant provider readiness, mock/live indicator, and available tools.
- `POST /ai/assistant/chat` — Protected by `X-Internal-API-Key`. Runs the LangGraph Career Assistant workflow.

## Testing

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```
