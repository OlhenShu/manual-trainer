import type { Request, Response, NextFunction } from 'express';
import { ERROR_CODE } from '@manual-trainer/shared';
import { verifyToken } from '../services/auth.js';
import { db } from '../db.js';

/**
 * requireAuth middleware
 *
 * 1. Extracts the JWT from the httpOnly `token` cookie.
 * 2. Verifies signature and expiry via verifyToken (throws JsonWebTokenError /
 *    TokenExpiredError on failure — both are caught by the global errorHandler,
 *    but we handle them here to return a clean 401 immediately).
 * 3. Loads the full user record from the DB using jwt.sub.
 * 4. Attaches the DB user to req.user (role always comes from DB, never JWT).
 *
 * Returns 401 UNAUTHORIZED on any failure:
 *   - missing cookie
 *   - invalid or expired JWT
 *   - user ID no longer exists in DB
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token: string | undefined = req.cookies?.token;

  if (!token) {
    res.status(401).json({
      error: {
        code: ERROR_CODE.UNAUTHORIZED,
        message: 'Authentication required.',
      },
    });
    return;
  }

  let sub: string;
  try {
    ({ sub } = verifyToken(token));
  } catch {
    res.status(401).json({
      error: {
        code: ERROR_CODE.UNAUTHORIZED,
        message: 'Authentication required.',
      },
    });
    return;
  }

  const user = await db.user.findUnique({ where: { id: sub } });

  if (!user) {
    res.status(401).json({
      error: {
        code: ERROR_CODE.UNAUTHORIZED,
        message: 'Authentication required.',
      },
    });
    return;
  }

  // Role always comes from the DB record, never from the JWT payload.
  req.user = user;
  next();
}
