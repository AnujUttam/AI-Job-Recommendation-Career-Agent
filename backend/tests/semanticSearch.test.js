import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'semantic-test-jwt-secret';

const { default: app } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js');
const { seedJobsDatabase } = await import('../src/seed/seedJobs.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aiServiceDir = path.resolve(__dirname, '../../ai-service');
const pythonExe = path.join(aiServiceDir, '.venv', 'Scripts', 'python.exe');

let mongoServer;
let expressServer;
let expressBaseUrl;
let aiServerProc;
let userToken;

async function startTestAiServer(port) {
  const runnerScript = `
import math, uvicorn
from qdrant_client import QdrantClient
from app.main import app
from app.services import embedding_service, qdrant_service

class TestEncoder:
    def encode(self, text: str, **_kwargs):
        lower = text.lower()
        vec = [0.02] * 384
        if "python" in lower or "fastapi" in lower or "qdrant" in lower or "ai" in lower:
            vec[0] = 5.0
            vec[1] = 2.0
        if "react" in lower or "tailwind" in lower or "frontend" in lower:
            vec[2] = 5.0
            vec[3] = 2.0
        if "java" in lower or "spring" in lower:
            vec[4] = 5.0
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec]

mem_qdrant = QdrantClient(location=":memory:")
encoder = TestEncoder()
embedding_service.get_embedding_model = lambda: encoder
qdrant_service.get_qdrant_client = lambda: mem_qdrant

uvicorn.run(app, host="127.0.0.1", port=${port}, log_level="warning")
`;
  const proc = spawn(pythonExe, ['-c', runnerScript], {
    cwd: aiServiceDir,
    env: { ...process.env, INTERNAL_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/ai/embedding/health`);
      if (res.ok) return proc;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  proc.kill();
  throw new Error('Test AI service failed to start');
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());
  await seedJobsDatabase();

  expressServer = http.createServer(app);
  await new Promise((resolve) => expressServer.listen(0, '127.0.0.1', resolve));
  expressBaseUrl = `http://127.0.0.1:${expressServer.address().port}`;

  const reg = await fetch(`${expressBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Semantic Tester',
      email: 'semantic@example.com',
      password: 'Password123!',
      skills: ['Python', 'FastAPI', 'Qdrant', 'Docker'],
      preferences: {
        experienceLevel: 'Entry Level (0-2 yrs)',
        desiredRoles: ['AI Engineer'],
        preferredLocations: ['Bengaluru', 'Remote'],
      },
    }),
  });
  userToken = (await reg.json()).token;
});

test.after(async () => {
  if (aiServerProc && !aiServerProc.killed) {
    aiServerProc.kill();
  }
  if (expressServer) {
    await new Promise((resolve) => expressServer.close(resolve));
  }
  await disconnectDatabase();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test('1. Fallback behavior when AI/Qdrant service is offline', async () => {
  const prevUrl = env.aiServiceUrl;
  env.aiServiceUrl = 'http://127.0.0.1:59999';

  try {
    const syncRes = await fetch(`${expressBaseUrl}/api/jobs/sync-vectors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(syncRes.status, 503);

    const searchRes = await fetch(`${expressBaseUrl}/api/jobs/search?q=Python`);
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.equal(searchData.searchMode, 'keyword_fallback');
    assert.ok(searchData.jobs.length >= 1);

    const recRes = await fetch(`${expressBaseUrl}/api/recommendations`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(recRes.status, 200);
    const recData = await recRes.json();
    assert.equal(recData.rankingMode, 'deterministic_fallback');
    assert.ok(recData.recommendations.length >= 1);
  } finally {
    env.aiServiceUrl = prevUrl;
  }
});

test('2. MongoDB-to-Qdrant sync, auto-index on create, semantic search, and hybrid recommendations', async () => {
  const aiPort = 8021;
  aiServerProc = await startTestAiServer(aiPort);
  const prevUrl = env.aiServiceUrl;
  const prevKey = env.internalApiKey;
  env.aiServiceUrl = `http://127.0.0.1:${aiPort}`;
  env.internalApiKey = '';

  try {
    // Sync all 22 seeded MongoDB jobs into Qdrant
    const syncRes = await fetch(`${expressBaseUrl}/api/jobs/sync-vectors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert.equal(syncData.success, true);
    assert.ok(syncData.indexedCount >= 22);

    // Creating a new job auto-indexes it into Qdrant
    const createRes = await fetch(`${expressBaseUrl}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Semantic Vector Search Engineer',
        company: 'VectorLabs',
        description: 'Build Python FastAPI and Qdrant semantic search pipelines.',
        requiredSkills: ['Python', 'FastAPI', 'Qdrant'],
        location: 'Bengaluru',
        workMode: 'Hybrid',
        employmentType: 'Full-time',
        experienceLevel: 'Entry Level (0-2 yrs)',
      }),
    });
    assert.equal(createRes.status, 201);
    const createdData = await createRes.json();
    assert.equal(createdData.job.vectorIndexed, true);

    // Semantic search hydrates MongoDB documents in Qdrant rank order
    const searchRes = await fetch(
      `${expressBaseUrl}/api/jobs/search?q=Python%20Qdrant%20semantic%20search&location=Bengaluru`
    );
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.equal(searchData.searchMode, 'semantic');
    assert.ok(searchData.jobs.length >= 1);
    assert.ok(typeof searchData.jobs[0].semanticScore === 'number');
    assert.equal(searchData.jobs[0].location, 'Bengaluru');

    // Recommendations use hybrid_semantic mode
    const recRes = await fetch(`${expressBaseUrl}/api/recommendations?limit=5`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(recRes.status, 200);
    const recData = await recRes.json();
    assert.equal(recData.rankingMode, 'hybrid_semantic');
    assert.equal(recData.recommendations.length, 5);
    assert.ok(typeof recData.recommendations[0].semanticScore === 'number');
  } finally {
    env.aiServiceUrl = prevUrl;
    env.internalApiKey = prevKey;
    if (aiServerProc && !aiServerProc.killed) {
      aiServerProc.kill();
      aiServerProc = null;
    }
  }
});
