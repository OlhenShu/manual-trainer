import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { registerAndLogin } from '../test/account.js';

const app = createApp({ rateLimiting: false });

async function registerCookie(): Promise<{ cookie: string; userId: string }> {
  const email = `progress-${crypto.randomUUID()}@test.example`;
  return registerAndLogin(app, email, 'Password1!');
}

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "users", "scenarios" CASCADE');
});

afterAll(async () => {
  await db.$disconnect();
});

describe('GET /api/progress', () => {
  it('returns only the current user first and best scores', async () => {
    const owner = await registerCookie();
    const other = await registerCookie();
    const scenario = await db.scenario.create({
      data: {
        slug: `progress-${crypto.randomUUID()}`,
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
        userId: owner.userId,
        scenarioId: scenario.id,
        answer: { taskType: 'test_case' },
        reviewStatus: 'completed',
        reviewedAt: new Date('2026-10-09T10:00:00.000Z'),
        createdAt: new Date('2026-10-09T10:00:00.000Z'),
        review: review(23, false),
      },
    });
    await db.attempt.create({
      data: {
        userId: owner.userId,
        scenarioId: scenario.id,
        answer: { taskType: 'test_case' },
        reviewStatus: 'completed',
        reviewedAt: new Date('2026-10-09T12:00:00.000Z'),
        createdAt: new Date('2026-10-09T12:00:00.000Z'),
        review: review(80, true),
      },
    });
    await db.attempt.create({
      data: {
        userId: other.userId,
        scenarioId: scenario.id,
        answer: { taskType: 'test_case' },
        reviewStatus: 'completed',
        review: review(100, true),
      },
    });

    const res = await request(app).get('/api/progress').set('Cookie', owner.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        scenarioId: scenario.id,
        title: 'Оформлення',
        firstScore: 23,
        bestScore: 80,
        passed: true,
      },
    ]);

    const hidden = await request(app).get('/api/progress').set('Cookie', other.cookie);
    expect(hidden.body).toEqual([
      {
        scenarioId: scenario.id,
        title: 'Оформлення',
        firstScore: 100,
        bestScore: 100,
        passed: true,
      },
    ]);
  });
});
