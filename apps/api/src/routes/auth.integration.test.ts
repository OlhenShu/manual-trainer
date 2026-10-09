/**
 * Integration tests for auth routes and related API behaviour.
 *
 * Covers requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4,
 *                      6.3, 6.4, 6.6, 10.1, 10.3, 11.3
 *
 * Verifies Properties: 2, 5, 7, 8, 9, 10, 11, 12
 *
 * All tests target the test database (TEST_DATABASE_URL).
 * Rate limiting is disabled for all tests except the dedicated 429 test.
 * BCRYPT_ROUNDS=4 is set via vitest.integration.config.ts for speed.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { hashPassword, signToken } from '../services/auth.js';
import {
  publicUserSchema,
  errorResponseSchema,
  ERROR_CODE,
} from '@manual-trainer/shared';
import { confirmRegistration, registerAndLogin } from '../test/account.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique email for each test to avoid cross-test contamination. */
function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${crypto.randomUUID()}@test.example`;
}

/**
 * Register a user and return the Set-Cookie header string for use in
 * subsequent authenticated requests.
 */
async function registerAndGetCookie(
  app: Express,
  email: string,
  password: string,
): Promise<string> {
  const account = await registerAndLogin(app, email, password);
  return account.cookie;
}

/**
 * Verify that the Set-Cookie header contains HttpOnly and SameSite=Strict.
 * Properties 2, 5, 10.
 */
function assertAuthCookieAttributes(rawCookie: string[] | string): void {
  const cookieStr = Array.isArray(rawCookie) ? rawCookie.join('; ') : rawCookie;
  expect(cookieStr).toMatch(/HttpOnly/i);
  expect(cookieStr).toMatch(/SameSite=Strict/i);
}

// ---------------------------------------------------------------------------
// Shared app instance (rate limiting disabled)
// ---------------------------------------------------------------------------
const app = createApp({ rateLimiting: false });
const appWithErrorRoute = createApp({ rateLimiting: false, testErrorRoute: true });

// ---------------------------------------------------------------------------
// DB clean-up
// ---------------------------------------------------------------------------
beforeEach(async () => {
  await db.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
});

afterAll(async () => {
  await db.$disconnect();
});

// ===========================================================================
// POST /api/auth/register
// ===========================================================================
describe('POST /api/auth/register', () => {
  it('201 — registration asks for email confirmation and does not sign in', async () => {
    const email = uniqueEmail('reg');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1!' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ email: email.toLowerCase().trim() });
    expect(res.headers['set-cookie']).toBeUndefined();

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password1!' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe(ERROR_CODE.EMAIL_NOT_VERIFIED);

    await confirmRegistration(app, email);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password1!' });
    expect(login.status).toBe(200);
    expect(publicUserSchema.safeParse(login.body).success).toBe(true);
  });

  it('409 EMAIL_TAKEN — duplicate email (Req 3.2, Property 3)', async () => {
    const email = uniqueEmail('dup');
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1!' });
    await confirmRegistration(app, email);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1!' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODE.EMAIL_TAKEN);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('422 VALIDATION_ERROR — invalid email format (Req 3.3, 10.1)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'Password1!' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);

    const details: Array<{ field: string; message: string }> = res.body.error.details;
    expect(Array.isArray(details)).toBe(true);
    expect(details.length).toBeGreaterThan(0);
    const messages = details.map((d) => d.message);
    expect(messages).toContain('EMAIL_INVALID');
  });

  it('422 VALIDATION_ERROR — password too short (Req 3.3)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    const details: Array<{ field: string; message: string }> = res.body.error.details;
    expect(Array.isArray(details)).toBe(true);
    const messages = details.map((d) => d.message);
    expect(messages).toContain('PASSWORD_TOO_SHORT');
  });

  it('422 VALIDATION_ERROR — password too long (> 72 UTF-8 bytes) (Req 3.3)', async () => {
    // 37 Cyrillic letters × 2 bytes = 74 bytes → exceeds 72-byte limit
    const longPassword = 'а'.repeat(37);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: longPassword });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    const details: Array<{ field: string; message: string }> = res.body.error.details;
    expect(Array.isArray(details)).toBe(true);
    const messages = details.map((d) => d.message);
    expect(messages).toContain('PASSWORD_TOO_LONG');
  });

  it('accepts password exactly at 72-byte boundary (36 Cyrillic letters) (Req 3.3)', async () => {
    // 36 Cyrillic letters × 2 bytes = 72 bytes → exactly at the limit, should pass
    const boundaryPassword = 'а'.repeat(36);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: boundaryPassword });

    expect(res.status).toBe(201);
  });

  it('422 VALIDATION_ERROR — missing required fields (Req 3.3)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    const details: Array<{ field: string; message: string }> = res.body.error.details;
    expect(Array.isArray(details)).toBe(true);
    expect(details.length).toBeGreaterThan(0);
  });

  it('422 VALIDATION_ERROR — malformed JSON body (Req 10.1)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });
});

// ===========================================================================
// POST /api/auth/login
// ===========================================================================
describe('POST /api/auth/login', () => {
  it('200 — valid login returns publicUserSchema body and auth cookie (Property 5, Req 4.1)', async () => {
    const email = uniqueEmail('login');
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1!' });
    await confirmRegistration(app, email);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password1!' });

    expect(res.status).toBe(200);

    // Body must parse publicUserSchema
    const parsed = publicUserSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    // No passwordHash in response
    expect(res.body).not.toHaveProperty('passwordHash');

    // Cookie attributes (Property 5, 10)
    const setCookie = res.headers['set-cookie'] as string[] | string;
    assertAuthCookieAttributes(setCookie);
  });

  it('401 INVALID_CREDENTIALS — wrong password (Req 4.2, Property 6)', async () => {
    const email = uniqueEmail('wrongpw');
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'Password1!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.INVALID_CREDENTIALS);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('401 INVALID_CREDENTIALS — email not found (Req 4.2, Property 6)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('notfound'), password: 'Password1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.INVALID_CREDENTIALS);
    // Same response body shape as wrong password — not distinguishable (Property 6)
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('422 VALIDATION_ERROR — invalid request body (Req 4.3)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODE.VALIDATION_ERROR);

    const details: Array<{ field: string; message: string }> = res.body.error.details;
    expect(Array.isArray(details)).toBe(true);
    expect(details.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// POST /api/auth/logout
// ===========================================================================
describe('POST /api/auth/logout', () => {
  it('200 — logout clears the token cookie (Property 7, Req 5.1)', async () => {
    const email = uniqueEmail('logout');
    const cookie = await registerAndGetCookie(app, email, 'Password1!');

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    // Set-Cookie should clear the token (Max-Age=0 or Expires in the past, or empty value)
    const setCookie = res.headers['set-cookie'] as string[] | string;
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    // clearCookie sets Max-Age=0 or an expired date
    expect(cookieStr).toMatch(/token=/);
    const hasMaxAge0 = /Max-Age=0/i.test(cookieStr);
    const hasExpired = /Expires=Thu, 01 Jan 1970/i.test(cookieStr);
    expect(hasMaxAge0 || hasExpired).toBe(true);
  });
});

// ===========================================================================
// GET /api/auth/me
// ===========================================================================
describe('GET /api/auth/me', () => {
  it('200 — valid JWT cookie returns user profile (Property 8 positive, Req 5.2)', async () => {
    const email = uniqueEmail('me');
    const cookie = await registerAndGetCookie(app, email, 'Password1!');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);

    const parsed = publicUserSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body.email).toBe(email.toLowerCase().trim());
  });

  it('401 UNAUTHORIZED — no cookie (Property 8 negative, Req 5.3)', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('401 UNAUTHORIZED — invalid/tampered JWT (Req 5.3)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'token=invalidjwttoken');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
  });

  it('401 UNAUTHORIZED — valid JWT but user deleted from DB (Req 5.4)', async () => {
    const email = uniqueEmail('deleted');
    const cookie = await registerAndGetCookie(app, email, 'Password1!');

    // Delete the user directly from DB
    await db.user.deleteMany({ where: { email: email.toLowerCase().trim() } });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
  });
});

// ===========================================================================
// GET /api/admin/ping
// ===========================================================================
describe('GET /api/admin/ping', () => {
  it('200 — admin user can access admin ping (Req 6.4)', async () => {
    const adminEmail = uniqueEmail('admin');
    await db.user.create({
      data: {
        email: adminEmail.toLowerCase().trim(),
        passwordHash: await hashPassword('AdminPass1!'),
        role: 'admin',
        emailVerifiedAt: new Date(),
      },
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'AdminPass1!' });

    const raw = loginRes.headers['set-cookie'] as string[] | string;
    const cookie = Array.isArray(raw) ? raw[0]! : raw;

    const res = await request(app)
      .get('/api/admin/ping')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
  });

  it('403 FORBIDDEN — regular user is rejected (Property 9, Req 6.3)', async () => {
    const email = uniqueEmail('regularuser');
    const cookie = await registerAndGetCookie(app, email, 'Password1!');

    const res = await request(app)
      .get('/api/admin/ping')
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODE.FORBIDDEN);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('401 UNAUTHORIZED — unauthenticated request (Property 8, Req 6.3)', async () => {
    const res = await request(app).get('/api/admin/ping');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });
});

// ===========================================================================
// 404 — unknown API paths
// ===========================================================================
describe('Unknown API paths (Property 11, Req 6.6)', () => {
  it('404 NOT_FOUND — body conforms to errorResponseSchema', async () => {
    const res = await request(app).get('/api/this-path-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODE.NOT_FOUND);

    // Property 11: body must parse errorResponseSchema
    const parsed = errorResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
  });

  it('404 NOT_FOUND — deeply nested unknown path', async () => {
    const res = await request(app).get('/api/auth/nonexistent/nested/route');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODE.NOT_FOUND);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
  });
});

// ===========================================================================
// 500 — unhandled exception
// ===========================================================================
describe('Unhandled exception (Property 12, Req 10.3)', () => {
  it('500 INTERNAL_ERROR — no stack trace in response body', async () => {
    const res = await request(appWithErrorRoute).get('/api/test/error');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe(ERROR_CODE.INTERNAL_ERROR);

    // Property 12: body must parse errorResponseSchema
    const parsed = errorResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    // Must not leak stack trace
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('at Object');
    expect(bodyStr).not.toContain('node_modules');
  });
});

// ===========================================================================
// Rate limiting
// ===========================================================================
describe('Rate limiting (Req 11.3)', () => {
  it('429 RATE_LIMITED — exceeding the rate limit on login (Req 11.3)', async () => {
    // Use a tightly-limited app: max 1 request per window
    const rateLimitedApp = createApp({ rateLimiting: { max: 1, windowMs: 60_000 } });

    const email = uniqueEmail('ratelimit');
    const password = 'Password1!';

    // First request — should go through (or fail with credentials, but not 429)
    const first = await request(rateLimitedApp)
      .post('/api/auth/login')
      .send({ email, password });
    expect(first.status).not.toBe(429);

    // Second request on the same endpoint from the same IP — should be rate-limited
    const second = await request(rateLimitedApp)
      .post('/api/auth/login')
      .send({ email, password });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe(ERROR_CODE.RATE_LIMITED);
    expect(errorResponseSchema.safeParse(second.body).success).toBe(true);
  });

  it('429 RATE_LIMITED — exceeding the rate limit on register (Req 11.3)', async () => {
    const rateLimitedApp = createApp({ rateLimiting: { max: 1, windowMs: 60_000 } });

    // First request — consumed by first registration
    await request(rateLimitedApp)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('rl1'), password: 'Password1!' });

    // Second request — should be rate-limited
    const res = await request(rateLimitedApp)
      .post('/api/auth/register')
      .send({ email: uniqueEmail('rl2'), password: 'Password1!' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe(ERROR_CODE.RATE_LIMITED);
  });
});

// ===========================================================================
// Error response conformance (Property 12)
// All 4xx/5xx responses must conform to errorResponseSchema
// ===========================================================================
describe('Error response conformance to errorResponseSchema (Property 12)', () => {
  it('422 response has details array (Req 10.1, 10.2)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad', password: 'x' });

    expect(res.status).toBe(422);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('non-422 error responses do NOT include a details array', async () => {
    // 401 response should not have details
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(errorResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.error.details).toBeUndefined();
  });

  it('code field is always a valid ERROR_CODE value', async () => {
    const validCodes = new Set(Object.values(ERROR_CODE));

    const res401 = await request(app).get('/api/auth/me');
    expect(validCodes.has(res401.body.error.code)).toBe(true);

    const res404 = await request(app).get('/api/unknown-path');
    expect(validCodes.has(res404.body.error.code)).toBe(true);

    const res422 = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad' });
    expect(validCodes.has(res422.body.error.code)).toBe(true);
  });
});

// ===========================================================================
// Signed-token helper: pre-create a user with a valid JWT for testing me route
// ===========================================================================
describe('GET /api/auth/me — pre-authenticated via signToken (Req 5.2)', () => {
  it('200 — user fetched from DB by JWT sub', async () => {
    const email = uniqueEmail('presign');
    const user = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash: await hashPassword('Password1!'),
        role: 'user',
      },
    });

    const token = signToken({ sub: user.id });
    const cookieHeader = `token=${token}`;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    const parsed = publicUserSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(email.toLowerCase().trim());
  });
});
