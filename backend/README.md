# CareerAI — Backend API

Node.js / Express API gateway and persistence layer backed by MongoDB (Mongoose) and integrated with the Python FastAPI AI service.

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | HTTP server port (default `5000`). |
| `NODE_ENV` | Optional | `development` or `production`. |
| `MONGO_URI` | Yes (for DB routes) | MongoDB Atlas or local MongoDB connection string. |
| `JWT_SECRET` | Yes (production) | Secret used to sign and verify JWT Bearer tokens. |
| `JWT_EXPIRES_IN` | Optional | JWT lifetime (default `7d`). |
| `CORS_ORIGIN` | Optional | Allowed frontend origin(s), comma-separated (default `http://localhost:5173`). |
| `AI_SERVICE_URL` | Optional | FastAPI AI service URL (default `http://localhost:8000`). |
| `AI_SERVICE_TIMEOUT_MS` | Optional | Timeout in ms for AI service calls (default `25000`). |
| `INTERNAL_API_KEY` | For AI protected calls | Shared secret sent in `X-Internal-API-Key` to FastAPI. |
| `MAX_RESUME_FILE_SIZE_MB` | Optional | Max uploaded resume PDF size in MB (default `5`). |

## Commands

```powershell
npm install
npm run dev          # Start Express server with nodemon
npm run seed         # Seed 22 technology job listings into MongoDB
npm run sync:qdrant  # Sync all MongoDB jobs into Qdrant via FastAPI
npm test             # Run backend.test.js
```

## API Endpoints (`/api`)

- `GET /health` — Backend, MongoDB, and AI service connectivity status
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me` — JWT authentication
- `GET /users/profile`, `PUT /users/profile` — Candidate profile & preferences
- `POST /resumes/upload`, `GET /resumes`, `GET /resumes/:id` — PDF validation, AI parsing, and private resume history
- `GET /jobs`, `GET /jobs/search`, `GET /jobs/:id`, `POST /jobs`, `POST /jobs/sync-vectors` — Job catalog, semantic/keyword search, and Qdrant batch sync
- `GET /recommendations` — Hybrid semantic + deterministic skill/experience recommendations
- `POST /saved-jobs/:jobId`, `GET /saved-jobs`, `DELETE /saved-jobs/:jobId` — Saved jobs
- `GET /conversations`, `POST /conversations`, `GET /conversations/:id` — MongoDB conversation memory + LangGraph assistant bridge
- `POST /career/skill-gap`, `POST /career/roadmap` — Grounded skill-gap analysis and personalized learning roadmap
