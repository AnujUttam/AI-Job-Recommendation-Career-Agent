import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'assistant-memory-jwt-secret';

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
let uvicornProc;
let user1Token;
let user2Token;
let conversationId;

async function startAssistantUvicorn(port, backendUrl, internalKey) {
  const proc = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: aiServiceDir,
      env: {
        ...process.env,
        INTERNAL_API_KEY: internalKey,
        GEMINI_API_KEY: '',
        ASSISTANT_PROVIDER: 'auto',
        BACKEND_URL: backendUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/ai/assistant/health`);
      if (res.ok) return proc;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  proc.kill();
  throw new Error('Assistant Uvicorn server failed to start');
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());
  await seedJobsDatabase();

  expressServer = http.createServer(app);
  await new Promise((resolve) => expressServer.listen(0, '127.0.0.1', resolve));
  expressBaseUrl = `http://127.0.0.1:${expressServer.address().port}`;

  const reg1 = await fetch(`${expressBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Sharma',
      email: 'priya.assistant@example.com',
      password: 'Password123!',
      skills: ['Python', 'FastAPI', 'React'],
      preferences: {
        experienceLevel: 'Entry Level (0-2 yrs)',
        desiredRoles: ['AI Engineer'],
      },
    }),
  });
  user1Token = (await reg1.json()).token;

  const reg2 = await fetch(`${expressBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Other Candidate',
      email: 'other.assistant@example.com',
      password: 'Password123!',
    }),
  });
  user2Token = (await reg2.json()).token;

  const aiPort = 8022;
  const sharedKey = 'assistant-internal-key';
  uvicornProc = await startAssistantUvicorn(aiPort, expressBaseUrl, sharedKey);
  env.aiServiceUrl = `http://127.0.0.1:${aiPort}`;
  env.internalApiKey = sharedKey;
});

test.after(async () => {
  if (uvicornProc && !uvicornProc.killed) {
    uvicornProc.kill();
  }
  if (expressServer) {
    await new Promise((resolve) => expressServer.close(resolve));
  }
  await disconnectDatabase();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test('1. Create conversation via Node -> LangGraph AI service and persist in MongoDB', async () => {
  const res = await fetch(`${expressBaseUrl}/api/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      message: 'Which jobs match my skills best?',
    }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.assistantMeta.provider, 'mock');
  assert.equal(body.assistantMeta.isMockResponse, true);
  assert.equal(body.conversation.messages.length, 2);
  assert.ok(body.latestReply.toolsUsed.includes('recommend_jobs'));
  conversationId = body.conversation._id;
});

test('2. Continue existing conversation with MongoDB history and enforce user isolation', async () => {
  const followUp = await fetch(`${expressBaseUrl}/api/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      conversationId,
      message: 'What skills am I missing and build me a 4-week roadmap?',
    }),
  });

  assert.equal(followUp.status, 200);
  const followData = await followUp.json();
  assert.equal(followData.conversation.messages.length, 4);
  assert.ok(followData.latestReply.toolsUsed.includes('generate_career_roadmap'));

  const fetched = await fetch(`${expressBaseUrl}/api/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${user1Token}` },
  });
  assert.equal(fetched.status, 200);
  const fetchedBody = await fetched.json();
  assert.equal(fetchedBody.conversation.messages.length, 4);

  // Cross-user isolation check
  const forbidden = await fetch(`${expressBaseUrl}/api/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${user2Token}` },
  });
  assert.equal(forbidden.status, 403);
});
