import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { hashPassword } from '../services/auth.js';
import { ERROR_CODE } from '@manual-trainer/shared';

const app = createApp({ rateLimiting: false });

const scenarioInput = {
  slug: 'checkout-draft',
  title: 'Чернетка оформлення',
  summary: 'Короткий опис для каталогу.',
  taskType: 'test_case',
  mode: 'create',
  difficulty: 'easy',
  status: 'draft',
  prompt: 'Напишіть тест-кейс на оформлення замовлення.',
  passingThreshold: 70,
  referenceSolution: 'Назва конкретна, кроки повні, очікуваний результат однозначний.',
  rubric: {
    criteria: [
      {
        id: 'steps',
        title: 'Кроки',
        description: 'Кроки відтворювані і йдуть по порядку.',
        weight: 100,
      },
    ],
  },
  embeddedDefects: [],
};

async function cookieFor(role: 'user' | 'admin'): Promise<string> {
  const email = `${role}-${crypto.randomUUID()}@test.example`;
  const password = 'Password1!';
  await db.user.create({
    data: { email, passwordHash: await hashPassword(password), role, emailVerifiedAt: new Date() },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  const raw = res.headers['set-cookie'] as string[] | string;
  const cookieArr = Array.isArray(raw) ? raw : [raw];
  return cookieArr[0]!;
}

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "users", "scenarios" CASCADE');
});

afterAll(async () => {
  await db.$disconnect();
});

describe('admin scenarios', () => {
  it('rejects a regular user', async () => {
    const cookie = await cookieFor('user');
    const res = await request(app).get('/api/admin/scenarios').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
  });

  it('creates a draft and publishes it into the catalog', async () => {
    const cookie = await cookieFor('admin');
    const created = await request(app).post('/api/admin/scenarios').set('Cookie', cookie).send(scenarioInput);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('draft');

    const hidden = await request(app).get('/api/scenarios').set('Cookie', cookie);
    expect(hidden.body).toHaveLength(0);

    const published = await request(app)
      .patch(`/api/admin/scenarios/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ ...scenarioInput, status: 'published' });
    expect(published.status).toBe(200);

    const visible = await request(app).get('/api/scenarios').set('Cookie', cookie);
    expect(visible.body).toHaveLength(1);
    expect(visible.body[0].title).toBe('Чернетка оформлення');
  });

  it('requires embedded defects for fix mode and rejects a duplicate slug', async () => {
    const cookie = await cookieFor('admin');
    const missingDefects = await request(app)
      .post('/api/admin/scenarios')
      .set('Cookie', cookie)
      .send({ ...scenarioInput, mode: 'fix', embeddedDefects: [] });
    expect(missingDefects.status).toBe(422);

    await request(app).post('/api/admin/scenarios').set('Cookie', cookie).send(scenarioInput);
    const duplicate = await request(app).post('/api/admin/scenarios').set('Cookie', cookie).send(scenarioInput);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe(ERROR_CODE.SLUG_TAKEN);
  });

  it('returns statistics', async () => {
    const cookie = await cookieFor('admin');
    const res = await request(app).get('/api/admin/stats').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.attempts).toBe(0);
    expect(res.body.averageScore).toBeNull();
    expect(res.body.scenarios).toEqual([]);
    expect(res.body.students).toEqual([]);
  });

  it('lists a student with first and best scores and omits admins', async () => {
    const cookie = await cookieFor('admin');
    const student = await db.user.create({
      data: {
        email: 'student@test.example',
        passwordHash: await hashPassword('Password1!'),
        role: 'user',
      },
    });
    const scenario = await db.scenario.create({
      data: {
        slug: `student-stats-${crypto.randomUUID()}`,
        title: 'Оформлення',
        summary: 'Коротко',
        taskType: 'test_case',
        mode: 'create',
        difficulty: 'easy',
        status: 'published',
        prompt: 'Напишіть кейс.',
        referenceSolution: 'Еталон',
        rubric: { criteria: [] },
      },
    });
    const review = (percent: number, passed: boolean) => ({
      criteria: [{ criterionId: 'steps', title: 'Кроки', score: percent, maxScore: 100, comment: 'Коментар' }],
      totalScore: percent,
      maxScore: 100,
      percent,
      passed,
      feedback: 'Коментар до спроби.',
    });
    await db.attempt.create({
      data: {
        userId: student.id,
        scenarioId: scenario.id,
        answer: { taskType: 'test_case' },
        reviewStatus: 'completed',
        createdAt: new Date('2026-10-09T10:00:00.000Z'),
        review: review(23, false),
      },
    });
    await db.attempt.create({
      data: {
        userId: student.id,
        scenarioId: scenario.id,
        answer: { taskType: 'test_case' },
        reviewStatus: 'completed',
        createdAt: new Date('2026-10-09T12:00:00.000Z'),
        review: review(80, true),
      },
    });

    const res = await request(app).get('/api/admin/stats').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.students).toEqual([
      {
        id: student.id,
        email: 'student@test.example',
        attempts: 2,
        averageScore: 52,
        averageFirstScore: 23,
        successRate: 50,
        passedScenarios: 1,
        emailVerified: false,
        role: 'user',
        reviewCredits: 0,
        scenarios: [
          {
            scenarioId: scenario.id,
            title: 'Оформлення',
            attempts: 2,
            firstScore: 23,
            bestScore: 80,
            passed: true,
          },
        ],
      },
    ]);
  });

  it('deletes a student account and refuses to delete an admin', async () => {
    const cookie = await cookieFor('admin');
    const student = await db.user.create({
      data: {
        email: 'stray@test.example',
        passwordHash: await hashPassword('Password1!'),
        role: 'user',
      },
    });
    const removed = await request(app).delete(`/api/admin/users/${student.id}`).set('Cookie', cookie);
    expect(removed.status).toBe(204);
    const stats = await request(app).get('/api/admin/stats').set('Cookie', cookie);
    expect(stats.body.students).toEqual([]);
    const admin = await db.user.findFirst({ where: { role: 'admin' } });
    const forbidden = await request(app).delete(`/api/admin/users/${admin!.id}`).set('Cookie', cookie);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
  });

  it('changes a student role, grants extra reviews, and refuses to edit the current admin', async () => {
    const cookie = await cookieFor('admin');
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    const student = await db.user.create({
      data: {
        email: 'extra@test.example',
        passwordHash: await hashPassword('Password1!'),
        role: 'user',
      },
    });

    const added = await request(app)
      .patch(`/api/admin/users/${student.id}`)
      .set('Cookie', cookie)
      .send({ addReviews: 3 });
    expect(added.status).toBe(200);
    expect(added.body).toMatchObject({ email: 'extra@test.example', role: 'user', reviewCredits: 3 });

    const previousLimit = process.env['REVIEW_DAILY_LIMIT'];
    process.env['REVIEW_DAILY_LIMIT'] = '0';
    try {
      const { isReviewLimited } = await import('../services/reviewRun.js');
      expect(await isReviewLimited({ id: student.id, role: 'user' })).toBe(false);
    } finally {
      if (previousLimit === undefined) delete process.env['REVIEW_DAILY_LIMIT'];
      else process.env['REVIEW_DAILY_LIMIT'] = previousLimit;
    }

    const promoted = await request(app)
      .patch(`/api/admin/users/${student.id}`)
      .set('Cookie', cookie)
      .send({ role: 'admin' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.role).toBe('admin');

    const self = await request(app)
      .patch(`/api/admin/users/${me.body.id}`)
      .set('Cookie', cookie)
      .send({ role: 'user' });
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
  });
});
