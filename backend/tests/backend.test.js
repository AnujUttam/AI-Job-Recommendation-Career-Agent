import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-suite-jwt-secret-key';

const { default: app } = await import('../src/app.js');
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js');
const { seedJobsDatabase } = await import('../src/seed/seedJobs.js');

let mongoServer;
let httpServer;
let baseUrl;

let user1Token;
let user2Token;
let sampleJobId;
let user1ResumeId;
let user1ConversationId;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const connected = await connectDatabase(mongoServer.getUri());
  assert.equal(connected, true, 'Expected MongoDB connection to succeed');

  httpServer = http.createServer(app);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await disconnectDatabase();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

async function apiFetch(path, { method = 'GET', token = null, body = null } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: payload,
  });
  const data = await response.json();
  return { status: response.status, data };
}

test('1. Health check confirms connected MongoDB', async () => {
  const { status, data } = await apiFetch('/api/health');
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.dependencies.mongodb, 'connected');
});

test('2. Seed script inserts >= 20 realistic jobs idempotently', async () => {
  const firstRun = await seedJobsDatabase();
  assert.ok(firstRun.inserted >= 20, `Expected >= 20 seeded jobs, got ${firstRun.inserted}`);

  const secondRun = await seedJobsDatabase();
  assert.equal(secondRun.inserted, 0);
  assert.equal(secondRun.skipped, firstRun.totalSeedItems);
});

test('3. Protected endpoints reject unauthenticated requests with 401', async () => {
  const endpoints = [
    '/api/auth/me',
    '/api/users/profile',
    '/api/recommendations',
    '/api/resumes',
    '/api/saved-jobs',
    '/api/conversations',
  ];
  for (const endpoint of endpoints) {
    const { status } = await apiFetch(endpoint);
    assert.equal(status, 401, `Expected 401 on ${endpoint}`);
  }
});

test('4. Auth register, duplicate guard, validation, login, and /me', async () => {
  const invalid = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { name: 'A', email: 'not-an-email', password: '123' },
  });
  assert.equal(invalid.status, 400);

  const reg1 = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Aarav Mehta',
      email: 'aarav@example.com',
      password: 'Password123!',
      skills: ['Python', 'FastAPI', 'React', 'Node.js', 'Docker'],
    },
  });
  assert.equal(reg1.status, 201);
  assert.ok(reg1.data.token);
  assert.equal(reg1.data.user.passwordHash, undefined);
  user1Token = reg1.data.token;

  const duplicate = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Aarav Duplicate',
      email: 'aarav@example.com',
      password: 'Password123!',
    },
  });
  assert.equal(duplicate.status, 409);

  const badLogin = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email: 'aarav@example.com', password: 'WrongPassword' },
  });
  assert.equal(badLogin.status, 401);

  const login = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email: 'aarav@example.com', password: 'Password123!' },
  });
  assert.equal(login.status, 200);
  assert.ok(login.data.token);

  const me = await apiFetch('/api/auth/me', { token: user1Token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.email, 'aarav@example.com');
});

test('5. User profile GET and PUT update preferences and skills', async () => {
  const updated = await apiFetch('/api/users/profile', {
    method: 'PUT',
    token: user1Token,
    body: {
      headline: 'Applied AI & Full-Stack Engineer',
      skills: ['Python', 'FastAPI', 'React', 'Node.js', 'MongoDB', 'Docker', 'Qdrant'],
      preferences: {
        experienceLevel: 'Entry Level (0-2 yrs)',
        preferredLocations: ['Bengaluru', 'Remote'],
        desiredRoles: ['AI Engineer', 'Full Stack Developer'],
      },
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.user.headline, 'Applied AI & Full-Stack Engineer');
  assert.ok(updated.data.user.skills.includes('Qdrant'));

  const fetched = await apiFetch('/api/users/profile', { token: user1Token });
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.data.user.preferences.desiredRoles, [
    'AI Engineer',
    'Full Stack Developer',
  ]);
});

test('6. Job APIs: pagination, search, get by id, and create job', async () => {
  const listRes = await apiFetch('/api/jobs?page=1&limit=10');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.jobs.length, 10);
  assert.ok(listRes.data.pagination.total >= 22);
  sampleJobId = listRes.data.jobs[0]._id;

  const searchRes = await apiFetch('/api/jobs/search?q=Python&workMode=Hybrid');
  assert.equal(searchRes.status, 200);
  assert.ok(searchRes.data.jobs.length >= 1);

  const byId = await apiFetch(`/api/jobs/${sampleJobId}`);
  assert.equal(byId.status, 200);
  assert.equal(byId.data.job._id, sampleJobId);

  const badId = await apiFetch('/api/jobs/invalid-id');
  assert.equal(badId.status, 400);

  const created = await apiFetch('/api/jobs', {
    method: 'POST',
    token: user1Token,
    body: {
      title: 'Staff Distributed Systems Engineer',
      company: 'TestScale Inc',
      description: 'Design resilient event-driven distributed backend systems in Node.js and Go.',
      requiredSkills: ['Node.js', 'Docker', 'Kubernetes'],
      location: 'Remote',
      workMode: 'Remote',
      employmentType: 'Full-time',
      experienceLevel: 'Senior (5+ yrs)',
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.job.title, 'Staff Distributed Systems Engineer');
});

test('7. Recommendations API returns personalized ranked jobs', async () => {
  const recRes = await apiFetch('/api/recommendations?limit=5', { token: user1Token });
  assert.equal(recRes.status, 200);
  assert.equal(recRes.data.recommendations.length, 5);
  const first = recRes.data.recommendations[0];
  assert.ok(typeof first.matchPercentage === 'number');
  assert.ok(Array.isArray(first.matchedSkills));
  assert.ok(Array.isArray(first.missingSkills));
});

test('8. Saved Jobs APIs: save, list, and delete', async () => {
  const saveRes = await apiFetch(`/api/saved-jobs/${sampleJobId}`, {
    method: 'POST',
    token: user1Token,
  });
  assert.equal(saveRes.status, 201);

  const listRes = await apiFetch('/api/saved-jobs', { token: user1Token });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.savedJobs.length, 1);
  assert.equal(listRes.data.savedJobs[0].job._id, sampleJobId);

  const delRes = await apiFetch(`/api/saved-jobs/${sampleJobId}`, {
    method: 'DELETE',
    token: user1Token,
  });
  assert.equal(delRes.status, 200);

  const afterDel = await apiFetch('/api/saved-jobs', { token: user1Token });
  assert.equal(afterDel.status, 200);
  assert.equal(afterDel.data.savedJobs.length, 0);
});

test('9. Resume PDF upload validation, retrieval, and cross-user isolation', async () => {
  const badForm = new FormData();
  badForm.append('resume', new Blob(['plain text'], { type: 'text/plain' }), 'notes.txt');
  const badUpload = await apiFetch('/api/resumes/upload', {
    method: 'POST',
    token: user1Token,
    body: badForm,
  });
  assert.equal(badUpload.status, 400);

  const pdfForm = new FormData();
  const pdfContent = '%PDF-1.4\n1 0 obj\n(Skills: Python, FastAPI, React, Docker, MongoDB)\nendobj\n%%EOF';
  pdfForm.append('resume', new Blob([pdfContent], { type: 'application/pdf' }), 'aarav_resume.pdf');

  const uploadRes = await apiFetch('/api/resumes/upload', {
    method: 'POST',
    token: user1Token,
    body: pdfForm,
  });
  assert.equal(uploadRes.status, 201);
  assert.equal(uploadRes.data.resume.fileName, 'aarav_resume.pdf');
  user1ResumeId = uploadRes.data.resume._id;

  const listRes = await apiFetch('/api/resumes', { token: user1Token });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.resumes.length, 1);

  const reg2 = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Other User',
      email: 'other@example.com',
      password: 'Password123!',
    },
  });
  user2Token = reg2.data.token;

  const forbiddenResume = await apiFetch(`/api/resumes/${user1ResumeId}`, {
    token: user2Token,
  });
  assert.equal(forbiddenResume.status, 403);
});

test('10. Conversation APIs: create, append, list, and cross-user isolation', async () => {
  const createRes = await apiFetch('/api/conversations', {
    method: 'POST',
    token: user1Token,
    body: { message: 'Which jobs match my skills best?' },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.conversation.messages.length, 2);
  user1ConversationId = createRes.data.conversation._id;

  const appendRes = await apiFetch('/api/conversations', {
    method: 'POST',
    token: user1Token,
    body: {
      conversationId: user1ConversationId,
      message: 'What skill gaps do I have?',
    },
  });
  assert.equal(appendRes.status, 200);
  assert.equal(appendRes.data.conversation.messages.length, 4);

  const listRes = await apiFetch('/api/conversations', { token: user1Token });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.conversations.length, 1);

  const forbiddenConvo = await apiFetch(`/api/conversations/${user1ConversationId}`, {
    token: user2Token,
  });
  assert.equal(forbiddenConvo.status, 403);
});
