import type { Express } from 'express';
import request from 'supertest';
import { verificationPathFor } from '../services/mail.js';

export async function confirmRegistration(app: Express, email: string): Promise<void> {
  const res = await request(app).get(verificationPathFor(email));
  if (res.status !== 302) {
    throw new Error(`Email confirmation failed with status ${res.status}`);
  }
}

export async function registerAndLogin(
  app: Express,
  email: string,
  password: string,
): Promise<{ cookie: string; userId: string }> {
  const registered = await request(app).post('/api/auth/register').send({ email, password });
  if (registered.status !== 201) {
    throw new Error(`Registration failed with status ${registered.status}`);
  }
  await confirmRegistration(app, email);
  const login = await request(app).post('/api/auth/login').send({ email, password });
  if (login.status !== 200) {
    throw new Error(`Login after confirmation failed with status ${login.status}`);
  }
  const raw = login.headers['set-cookie'] as string[] | string | undefined;
  const cookie = Array.isArray(raw) ? raw[0] : raw;
  if (!cookie) {
    throw new Error('Login did not set a cookie');
  }
  return { cookie, userId: login.body.id as string };
}
