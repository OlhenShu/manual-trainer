import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { apiOrigin, renderOrigin, webOrigin as configuredWebOrigin } from './publicOrigin.js';

const STATE_COOKIE = 'google_oauth_state';
const NEXT_COOKIE = 'google_oauth_next';
const TEN_MINUTES_MS = 10 * 60 * 1000;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const profileSchema = z.object({
  email: z.string().email(),
  email_verified: z.boolean(),
});

export function googleConfigured(): boolean {
  return Boolean(process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET']);
}

export function googleRedirectUri(): string {
  const configured = process.env['GOOGLE_REDIRECT_URI'];
  if (configured && (!renderOrigin() || !configured.includes('localhost'))) return configured;
  return `${apiOrigin()}/api/auth/google/callback`;
}

export function webOrigin(): string {
  return configuredWebOrigin();
}

export function safeNextPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/';
  }
  return raw;
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: TEN_MINUTES_MS,
    path: '/api/auth/google',
  };
}

export function beginGoogleLogin(res: Response, nextPath: string): void {
  const state = randomBytes(32).toString('hex');
  const clientId = process.env['GOOGLE_CLIENT_ID'] ?? '';
  const redirectUri = googleRedirectUri();
  res.cookie(STATE_COOKIE, state, cookieOptions());
  res.cookie(NEXT_COOKIE, safeNextPath(nextPath), cookieOptions());
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  res.redirect(url.toString());
}

export function readGoogleState(req: Request): { state: string | undefined; nextPath: string } {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const state = cookies?.[STATE_COOKIE];
  return {
    state: typeof state === 'string' ? state : undefined,
    nextPath: safeNextPath(cookies?.[NEXT_COOKIE]),
  };
}

export function clearGoogleCookies(res: Response): void {
  const options = cookieOptions();
  res.clearCookie(STATE_COOKIE, options);
  res.clearCookie(NEXT_COOKIE, options);
}

export async function fetchGoogleEmail(code: string): Promise<string> {
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('Google sign-in is not configured.');
  }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed with status ${tokenResponse.status}.`);
  }
  const token = tokenResponseSchema.parse(await tokenResponse.json());
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) {
    throw new Error(`Google profile request failed with status ${profileResponse.status}.`);
  }
  const profile = profileSchema.parse(await profileResponse.json());
  if (!profile.email_verified) {
    throw new Error('UNVERIFIED_EMAIL');
  }
  return profile.email.trim().toLowerCase();
}
