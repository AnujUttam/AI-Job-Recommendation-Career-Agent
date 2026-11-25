import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'audit-jwt-secret';

const { default: app } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aiServiceDir = path.resolve(__dirname, '../../ai-service');
const pythonExe = path.join(aiServiceDir, '.venv', 'Scripts', 'python.exe');

let mongoServer;
let expressServer;
let expressBaseUrl;
let userToken;
let uvicornProc;

const buildSamplePdf = () => {
  const text = 'Aarav Mehta - Software Engineer - Python FastAPI React Node.js MongoDB Docker';
  const stream = `BT\n/F1 12 Tf\n50 750 Td\n(${text}) Tj\nET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets.slice(1)) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
};

async function startUvicorn(port, internalApiKey) {
  const proc = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: aiServiceDir,
      env: {
        ...process.env,
        INTERNAL_API_KEY: internalApiKey,
        GEMINI_API_KEY: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return proc;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  proc.kill();
  throw new Error('Uvicorn failed to start within timeout');
}

test.before(async () => {
  expressServer = http.createServer(app);
  await new Promise((resolve) => expressServer.listen(0, '127.0.0.1', resolve));
  expressBaseUrl = `http://127.0.0.1:${expressServer.address().port}`;
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

test('1. MongoDB unavailable returns 503 immediately on DB routes', async () => {
  const res = await fetch(`${expressBaseUrl}/api/resumes`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Database is currently unavailable/i);
});

test('2. Connect MongoDB and register authenticated user for audit tests', async () => {
  mongoServer = await MongoMemoryServer.create();
  const ok = await connectDatabase(mongoServer.getUri());
  assert.equal(ok, true);

  const reg = await fetch(`${expressBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Audit Candidate',
      email: 'audit@example.com',
      password: 'Password123!',
    }),
  });
  assert.equal(reg.status, 201);
  const regBody = await reg.json();
  userToken = regBody.token;
});

test('3. Node -> Slow AI service triggers 504 timeout cleanly', async () => {
  const slowServer = http.createServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ parsedProfile: { summary: 'late', atsScore: 80 } }));
    }, 500);
  });
  await new Promise((r) => slowServer.listen(0, '127.0.0.1', r));

  const prevUrl = env.aiServiceUrl;
  const prevTimeout = env.aiServiceTimeoutMs;
  env.aiServiceUrl = `http://127.0.0.1:${slowServer.address().port}`;
  env.aiServiceTimeoutMs = 100;

  try {
    const form = new FormData();
    form.append('resume', new Blob([buildSamplePdf()], { type: 'application/pdf' }), 'sample.pdf');
    const res = await fetch(`${expressBaseUrl}/api/resumes/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: form,
    });
    assert.equal(res.status, 504);
  } finally {
    env.aiServiceUrl = prevUrl;
    env.aiServiceTimeoutMs = prevTimeout;
    await new Promise((r) => slowServer.close(r));
  }
});

test('4. Node -> Malformed LLM response from AI service triggers 502', async () => {
  const badAiServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ parsedProfile: { broken: true } }));
  });
  await new Promise((r) => badAiServer.listen(0, '127.0.0.1', r));

  const prevUrl = env.aiServiceUrl;
  env.aiServiceUrl = `http://127.0.0.1:${badAiServer.address().port}`;

  try {
    const form = new FormData();
    form.append('resume', new Blob([buildSamplePdf()], { type: 'application/pdf' }), 'sample.pdf');
    const res = await fetch(`${expressBaseUrl}/api/resumes/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: form,
    });
    assert.equal(res.status, 502);
  } finally {
    env.aiServiceUrl = prevUrl;
    await new Promise((r) => badAiServer.close(r));
  }
});

test('5. Live Node <-> Python FastAPI failure modes (bad key, missing Gemini key, corrupted PDF, non-PDF)', async () => {
  const aiPort = 8019;
  const sharedKey = 'audit-internal-secret';
  uvicornProc = await startUvicorn(aiPort, sharedKey);

  const prevUrl = env.aiServiceUrl;
  const prevKey = env.internalApiKey;
  env.aiServiceUrl = `http://127.0.0.1:${aiPort}`;

  try {
    // a) Invalid internal API key -> Python returns 403 -> Node returns 502 without leaking secret
    env.internalApiKey = 'wrong-internal-secret';
    const formBadKey = new FormData();
    formBadKey.append('resume', new Blob([buildSamplePdf()], { type: 'application/pdf' }), 'sample.pdf');
    const resBadKey = await fetch(`${expressBaseUrl}/api/resumes/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: formBadKey,
    });
    assert.equal(resBadKey.status, 502);
    const badKeyBody = await resBadKey.json();
    assert.ok(!JSON.stringify(badKeyBody).includes(sharedKey));

    // b) Valid internal API key + missing GEMINI_API_KEY -> Python extracts PDF then returns 503
    env.internalApiKey = sharedKey;
    const formNoGemini = new FormData();
    formNoGemini.append('resume', new Blob([buildSamplePdf()], { type: 'application/pdf' }), 'sample.pdf');
    const resNoGemini = await fetch(`${expressBaseUrl}/api/resumes/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: formNoGemini,
    });
    assert.equal(resNoGemini.status, 503);

    // c) Corrupted PDF -> Python returns 422 -> Node returns 422
    const formCorrupt = new FormData();
    formCorrupt.append('resume', new Blob([Buffer.from('%PDF-1.4\n%%corrupted')], { type: 'application/pdf' }), 'corrupt.pdf');
    const resCorrupt = await fetch(`${expressBaseUrl}/api/resumes/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: formCorrupt,
    });
    assert.equal(resCorrupt.status, 422);

    // d) Non-PDF -> Multer rejects 400
    const formTxt = new FormData();
    formTxt.append('resume', new Blob([Buffer.from('plain text')], { type: 'text/plain' }), 'bad.txt');
    const resTxt = await fetch(`${expressBaseUrl}/api/resumes/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: formTxt,
    });
    assert.equal(resTxt.status, 400);

    // e) Uploaded files are never exposed via static path
    const staticCheck = await fetch(`${expressBaseUrl}/uploads/sample.pdf`);
    assert.equal(staticCheck.status, 404);
  } finally {
    env.aiServiceUrl = prevUrl;
    env.internalApiKey = prevKey;
    if (uvicornProc && !uvicornProc.killed) {
      uvicornProc.kill();
      uvicornProc = null;
    }
  }
});
