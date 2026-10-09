import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { sendVerificationEmail } from './mail.js';
import { apiOrigin as configuredApiOrigin } from './publicOrigin.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function apiOrigin(): string {
  return configuredApiOrigin();
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function exposeVerificationUrl(): boolean {
  return process.env['NODE_ENV'] !== 'production' && process.env['E2E_EXPOSE_VERIFICATION'] === '1';
}

export async function issueVerification(userId: string, email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.emailVerificationToken.deleteMany({ where: { userId } });
  await db.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashVerificationToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  const url = `${apiOrigin()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  await sendVerificationEmail(email, url);
  return url;
}
