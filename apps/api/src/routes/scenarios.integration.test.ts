/**
 * Published scenario catalog: list filters and detail access.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { ERROR_CODE, scenarioDetailSchema, scenarioListSchema } from '@manual-trainer/shared';
import { registerAndLogin } from '../test/account.js';

const app = createApp({ rateLimiting: false });

async function registerCookie(): Promise<string> {
  const email = `catalog-${crypto.randomUUID()}@test.example`;
  const account = await registerAndLogin(app, email, 'Password1!');
  return account.cookie;
}

beforeEach(async () => {
  await db.$executeRaw`TRUNCATE TABLE "scenarios", "users" CASCADE`;
});

afterAll(async () => {
  await db.$disconnect();
});

describe('GET /api/scenarios', () => {
  it('returns 401 when the request has no auth cookie', async () => {
    const res = await request(app).get('/api/scenarios');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
  });

  it('returns only published scenarios and applies taskType filter', async () => {
    const cookie = await registerCookie();
    await db.scenario.createMany({
      data: [
        {
          slug: 'published-case',
          title: 'Опублікований кейс',
          summary: 'Видно в каталозі',
          taskType: 'test_case',
          mode: 'create',
          difficulty: 'easy',
          status: 'published',
          prompt: 'Напишіть тест-кес.',
          passingThreshold: 70,
        },
        {
          slug: 'draft-case',
          title: 'Чернетка',
          summary: 'Не видно в каталозі',
          taskType: 'test_case',
          mode: 'fix',
          difficulty: 'hard',
          status: 'draft',
          prompt: 'Цю умову не віддаємо.',
          passingThreshold: 70,
        },
        {
          slug: 'published-bug',
          title: 'Опублікований репорт',
          summary: 'Інший тип',
          taskType: 'bug_report',
          mode: 'create',
          difficulty: 'medium',
          status: 'published',
          prompt: 'Напишіть баг-репорт.',
          passingThreshold: 80,
        },
      ],
    });

    const all = await request(app).get('/api/scenarios').set('Cookie', cookie);
    expect(all.status).toBe(200);
    const parsed = scenarioListSchema.parse(all.body);
    expect(parsed.map((item) => item.slug).sort()).toEqual(['published-bug', 'published-case']);
    expect(all.body[0]).not.toHaveProperty('prompt');

    const filtered = await request(app)
      .get('/api/scenarios')
      .query({ taskType: 'bug_report' })
      .set('Cookie', cookie);
    expect(filtered.status).toBe(200);
    expect(scenarioListSchema.parse(filtered.body)).toHaveLength(1);
    expect(filtered.body[0].slug).toBe('published-bug');
  });

  it('returns a published scenario and hides drafts', async () => {
    const cookie = await registerCookie();
    const published = await db.scenario.create({
      data: {
        slug: 'detail-published',
        title: 'Деталі',
        summary: 'Коротко',
        taskType: 'requirements_analysis',
        mode: 'fix',
        difficulty: 'hard',
        status: 'published',
        prompt: 'Знайдіть суперечності.',
        passingThreshold: 70,
      },
    });
    const draft = await db.scenario.create({
      data: {
        slug: 'detail-draft',
        title: 'Прихована чернетка',
        summary: 'Ні',
        taskType: 'test_case',
        mode: 'create',
        difficulty: 'easy',
        status: 'draft',
        prompt: 'Секрет',
        passingThreshold: 70,
      },
    });

    const ok = await request(app).get(`/api/scenarios/${published.id}`).set('Cookie', cookie);
    expect(ok.status).toBe(200);
    expect(scenarioDetailSchema.parse(ok.body).prompt).toBe('Знайдіть суперечності.');

    const hidden = await request(app).get(`/api/scenarios/${draft.id}`).set('Cookie', cookie);
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });
});
