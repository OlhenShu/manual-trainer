import type { Request, Response, NextFunction } from 'express';
import { ERROR_CODE } from '@manual-trainer/shared';

/**
 * requireAdmin middleware
 *
 * Must be composed AFTER requireAuth (which populates req.user).
 * Returns 403 FORBIDDEN if the authenticated user's role is not 'admin'.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({
      error: {
        code: ERROR_CODE.FORBIDDEN,
        message: 'Forbidden.',
      },
    });
    return;
  }

  next();
}
