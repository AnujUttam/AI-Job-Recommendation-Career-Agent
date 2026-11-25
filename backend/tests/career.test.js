import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'career-test-jwt-secret';

const { default: app } = await import('../src/app.js');
const { connectDatabase, disconnectDatabase } = await import('../src/config/db.js');
const { seedJobsDatabase } = await import('../src/seed/seedJobs.js');
const { Job } = await import('../src/models/Job.js');

let mongoServer;
let httpServer;
let baseUrl;
let userToken;
let aiJobId;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());
  await seedJobsDatabase();

  const aiJob = await Job.findOne({ title: 'AI Engineer' }).lean();
  aiJobId = aiJob._id.toString();

  httpServer = http.createServer(app);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  const reg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Career Analyst',
      email: 'career.test@example.com',
      password: 'Password123!',
      skills: ['Python', 'FastAPI'],
      preferences: {
        experienceLevel: 'Entry Level (0-2 yrs)',
        desiredRoles: ['AI Engineer'],
      },
    }),
  });
  userToken = (await reg.json()).token;
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

test('1. Skill gap and roadmap routes require authentication', async () => {
  const res1 = await fetch(`${baseUrl}/api/career/skill-gap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetRole: 'AI Engineer' }),
  });
  assert.equal(res1.status, 401);

  const res2 = await fetch(`${baseUrl}/api/career/roadmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetRole: 'AI Engineer' }),
  });
  assert.equal(res2.status, 401);
});

test('2. Skill gap analysis compares actual candidate skills against target job and role', async () => {
  const resJob = await fetch(`${baseUrl}/api/career/skill-gap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ jobId: aiJobId }),
  });
  assert.equal(resJob.status, 200);
  const jobData = await resJob.json();
  assert.equal(jobData.success, true);
  assert.deepEqual(jobData.analysis.candidateSkills, ['Python', 'FastAPI']);
  assert.ok(jobData.analysis.matchedSkills.includes('Python'));
  assert.ok(jobData.analysis.missingSkills.includes('Qdrant'));
  assert.ok(typeof jobData.analysis.skillMatchPercentage === 'number');
  assert.ok(jobData.analysis.learningPriorities.length >= 1);

  const resBadId = await fetch(`${baseUrl}/api/career/skill-gap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ jobId: 'invalid-id' }),
  });
  assert.equal(resBadId.status, 400);
});

test('3. Personalized career roadmap returns stages, projects, milestones, timeline, and assumptions', async () => {
  const res = await fetch(`${baseUrl}/api/career/roadmap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ targetRole: 'AI Engineer' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);

  const { roadmap } = body;
  assert.equal(roadmap.generatedSuggestions.isTemplateGenerated, true);
  assert.ok(Array.isArray(roadmap.verifiedMarketRequirements));
  assert.ok(roadmap.verifiedMarketRequirements.length >= 1);
  assert.ok(roadmap.generatedSuggestions.stages.length === 4);
  assert.ok(roadmap.assumptions.length >= 2);
  assert.ok(roadmap.estimatedTimeline);
});
