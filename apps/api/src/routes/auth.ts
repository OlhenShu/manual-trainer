import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import {
  registerSchema,
  loginSchema,
  publicUserSchema,
  resendVerificationSchema,
  ERROR_CODE,
} from '@manual-trainer/shared';
import {
  hashPassword,
  comparePassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
} from '../services/auth.js';
import {
  beginGoogleLogin,
  clearGoogleCookies,
  fetchGoogleEmail,
  googleConfigured,
  readGoogleState,
  safeNextPath,
  webOrigin,
} from '../services/googleAuth.js';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { exposeVerificationUrl, hashVerificationToken, issueVerification } from '../services/verification.js';

const authRouter: ExpressRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    // 1. Validate and normalise input (throws ZodError → errorHandler → 422)
    const parsed = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(parsed.password);
    const existing = await db.user.findUnique({ where: { email: parsed.email } });
    if (existing?.emailVerifiedAt) {
      res.status(409).json({
        error: { code: ERROR_CODE.EMAIL_TAKEN, message: 'An account with this email already exists.' },
      });
      return;
    }

    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { passwordHash } })
      : await db.user.create({
          data: { email: parsed.email, passwordHash, role: 'user' },
        });

    try {
      const verificationUrl = await issueVerification(user.id, user.email);
      res.status(201).json({
        email: user.email,
        ...(exposeVerificationUrl() ? { verificationUrl } : {}),
      });
    } catch (err) {
      if (!existing) {
        await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      }
      if (err instanceof Error && err.message === 'MAIL_NOT_CONFIGURED') {
        res.status(503).json({
          error: { code: ERROR_CODE.EMAIL_DELIVERY_FAILED, message: 'Email delivery is not configured.' },
        });
        return;
      }
      throw err;
    }
  }),
);

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    // 1. Validate input
    const parsed = loginSchema.parse(req.body);

    // 2. Look up user by normalised email
    const user = await db.user.findUnique({ where: { email: parsed.email } });

    // 3. Verify credentials — identical response for missing user and wrong password
    //    to prevent user enumeration.
    const passwordMatch = user?.passwordHash
      ? await comparePassword(parsed.password, user.passwordHash)
      : false;

    if (!user || !passwordMatch) {
      res.status(401).json({
        error: {
          code: ERROR_CODE.INVALID_CREDENTIALS,
          message: 'Invalid credentials.',
        },
      });
      return;
    }

    if (!user.emailVerifiedAt) {
      res.status(403).json({
        error: {
          code: ERROR_CODE.EMAIL_NOT_VERIFIED,
          message: 'Email is not verified.',
        },
      });
      return;
    }

    // 4. Issue JWT and set cookie
    const token = signToken({ sub: user.id });
    setAuthCookie(res, token);

    // 5. Return public profile
    res.status(200).json(publicUserSchema.parse({ ...user, createdAt: user.createdAt.toISOString() }));
  }),
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
authRouter.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ message: 'Logged out.' });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    // req.user is guaranteed to be set by requireAuth
    const user = req.user!;
    res.status(200).json(
      publicUserSchema.parse({ ...user, createdAt: user.createdAt.toISOString() }),
    );
  }),
);

authRouter.get(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = typeof req.query['token'] === 'string' ? req.query['token'] : '';
    const row = token
      ? await db.emailVerificationToken.findUnique({ where: { tokenHash: hashVerificationToken(token) } })
      : null;
    if (!row || row.expiresAt.getTime() < Date.now()) {
      res.redirect(`${webOrigin()}/login?error=verify`);
      return;
    }
    await db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
    await db.emailVerificationToken.deleteMany({ where: { userId: row.userId } });
    res.redirect(`${webOrigin()}/login?verified=1`);
  }),
);

authRouter.post(
  '/resend-verification',
  asyncHandler(async (req, res) => {
    const parsed = resendVerificationSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: parsed.email } });
    if (!user || user.emailVerifiedAt) {
      res.status(200).json({ email: parsed.email });
      return;
    }
    try {
      await issueVerification(user.id, user.email);
      res.status(200).json({ email: user.email });
    } catch (err) {
      if (err instanceof Error && err.message === 'MAIL_NOT_CONFIGURED') {
        res.status(503).json({
          error: { code: ERROR_CODE.EMAIL_DELIVERY_FAILED, message: 'Email delivery is not configured.' },
        });
        return;
      }
      throw err;
    }
  }),
);

authRouter.get('/google', (req, res) => {
  if (!googleConfigured()) {
    res.redirect(`${webOrigin()}/login?error=google`);
    return;
  }
  const nextPath = safeNextPath(req.query['next']);
  beginGoogleLogin(res, nextPath);
});

authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const returnedState = typeof req.query['state'] === 'string' ? req.query['state'] : '';
    const stored = readGoogleState(req);
    clearGoogleCookies(res);
    if (!stored.state || stored.state !== returnedState) {
      res.redirect(`${webOrigin()}/login?error=google`);
      return;
    }
    if (typeof req.query['error'] === 'string' || typeof req.query['code'] !== 'string') {
      res.redirect(`${webOrigin()}/login?error=google`);
      return;
    }
    try {
      const email = await fetchGoogleEmail(req.query['code']);
      const existing = await db.user.findUnique({ where: { email } });
      const user = existing
        ? existing.emailVerifiedAt
          ? existing
          : await db.user.update({
              where: { id: existing.id },
              data: { emailVerifiedAt: new Date() },
            })
        : await db.user.create({
            data: { email, passwordHash: null, role: 'user', emailVerifiedAt: new Date() },
          });
      setAuthCookie(res, signToken({ sub: user.id }));
      res.redirect(`${webOrigin()}${stored.nextPath}`);
    } catch (err) {
      console.error('[Google login failed]', err);
      const unverified = err instanceof Error && err.message === 'UNVERIFIED_EMAIL';
      res.redirect(`${webOrigin()}/login?error=${unverified ? 'unverified' : 'google'}`);
    }
  }),
);

export default authRouter;
