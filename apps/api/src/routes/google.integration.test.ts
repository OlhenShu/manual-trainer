import { describe, expect, it, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { ERROR_CODE } from '@manual-trainer/shared';

const app = createApp({ rateLimiting: false });

beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
});

afterAll(async () => {
  await db.$disconnect();
});

describe('Google sign-in', () => {
  it('starts the Google redirect without exposing the client secret', async () => {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(res.headers.location).not.toContain('GOCSPX');
    expect(String(res.headers['set-cookie'])).toContain('google_oauth_state');
  });

  it('rejects a callback whose state does not match', async () => {
    const res = await request(app).get('/api/auth/google/callback?code=abc&state=nope');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/login?error=google');
  });

  it('does not accept a password for an account created without one', async () => {
    const email = `google-${crypto.randomUUID()}@test.example`;
    await db.user.create({ data: { email, passwordHash: null, role: 'user' } });
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password1!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.INVALID_CREDENTIALS);
  });
});
