/**
 * Saving and listing the current user's attempts on a published scenario.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { ERROR_CODE, attemptSchema } from '@manual-trainer/shared';
import { registerAndLogin } from '../test/account.js';

const app = createApp({ rateLimiting: false });

async function registerCookie(): Promise<string> {
  const email = `attempt-${crypto.randomUUID()}@test.example`;
  const account = await registerAndLogin(app, email, 'Password1!');
  return account.cookie;
}

const testCaseAnswer = {
  taskType: 'test_case',
  name: 'Успішний пошук',
  preconditions: 'У каталозі є товар «Навушники».',
  steps: [{ text: 'Ввести «навушники» у поле пошуку.' }],
  expectedResult: 'Картка «Навушники» видна в результатах.',
  priority: 'high',
};

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE TABLE "attempts", "scenarios", "users" CASCADE`;
});

afterAll(async () => {
  await db.$disconnect();
});

describe('scenario attempts', () => {
  it('returns 401 when saving without an auth cookie', async () => {
    const res = await request(app).post('/api/scenarios/11111111-1111-4111-8111-111111111111/attempts').send(testCaseAnswer);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
  });

  it('stores an attempt and lists only that user\'s attempts', async () => {
    const owner = await registerCookie();
    const other = await registerCookie();
    const scenario = await db.scenario.create({
      data: {
        slug: `attempt-${crypto.randomUUID()}`,
        title: 'Пошук',
        summary: 'Написати кейс',
        taskType: 'test_case',
        mode: 'create',
        difficulty: 'easy',
        status: 'published',
        prompt: 'Напишіть тест-кейс.',
        passingThreshold: 70,
      },
    });

    const created = await request(app)
      .post(`/api/scenarios/${scenario.id}/attempts`)
      .set('Cookie', owner)
      .send(testCaseAnswer);
    expect(created.status).toBe(201);
    expect(attemptSchema.parse(created.body).answer).toMatchObject({ name: 'Успішний пошук' });

    const mismatch = await request(app)
      .post(`/api/scenarios/${scenario.id}/attempts`)
      .set('Cookie', owner)
      .send({
        taskType: 'bug_report',
        summary: 'Сума кошика менша',
        environment: 'Chrome',
        stepsToReproduce: [{ text: 'Застосувати промокод' }],
        actualResult: '800 грн',
        expectedResult: '900 грн',
        severity: 'major',
        priority: 'high',
      });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    await request(app)
      .post(`/api/scenarios/${scenario.id}/attempts`)
      .set('Cookie', other)
      .send(testCaseAnswer);

    const listed = await request(app).get(`/api/scenarios/${scenario.id}/attempts`).set('Cookie', owner);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.id);
    expect(created.body.reviewStatus).toBe('failed');
  });

  it('reviews a published scenario against its rubric and unlocks the reference after three unsuccessful attempts', async () => {
    const cookie = await registerCookie();
    const scenario = await db.scenario.create({
      data: {
        slug: `reviewed-${crypto.randomUUID()}`,
        title: 'Пошук',
        summary: 'Написати кейс',
        taskType: 'test_case',
        mode: 'create',
        difficulty: 'easy',
        status: 'published',
        prompt: 'Напишіть тест-кейс.',
        passingThreshold: 70,
        referenceSolution: 'Кроки відтворювані і повні.',
        rubric: {
          criteria: [
            {
              id: 'steps',
              title: 'Кроки',
              description: 'Кроки відтворювані, повні і йдуть у правильному порядку.',
              weight: 100,
            },
          ],
        },
      },
    });

    const hidden = await request(app).get(`/api/scenarios/${scenario.id}`).set('Cookie', cookie);
    expect(hidden.status).toBe(200);
    expect(hidden.body.referenceSolution).toBeNull();

    for (let index = 0; index < 3; index += 1) {
      const created = await request(app)
        .post(`/api/scenarios/${scenario.id}/attempts`)
        .set('Cookie', cookie)
        .send(testCaseAnswer);
      expect(created.status).toBe(201);
      expect(created.body.reviewStatus).toBe('completed');
      expect(created.body.review.passed).toBe(false);
    }

    const unlocked = await request(app).get(`/api/scenarios/${scenario.id}`).set('Cookie', cookie);
    expect(unlocked.body.referenceSolution).toBe('Кроки відтворювані і повні.');
  });

  it('returns 404 when the scenario is a draft', async () => {
    const cookie = await registerCookie();
    const draft = await db.scenario.create({
      data: {
        slug: `draft-attempt-${crypto.randomUUID()}`,
        title: 'Чернетка',
        summary: 'Ні',
        taskType: 'test_case',
        mode: 'fix',
        difficulty: 'easy',
        status: 'draft',
        prompt: 'Приховано',
        passingThreshold: 70,
      },
    });

    const res = await request(app)
      .post(`/api/scenarios/${draft.id}/attempts`)
      .set('Cookie', cookie)
      .send(testCaseAnswer);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });
});
