import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { ERROR_CODE } from '@manual-trainer/shared';

/**
 * Factory that returns an express-rate-limit middleware instance.
 *
 * Defaults are read from the typed env config (RATE_LIMIT_AUTH_MAX and
 * RATE_LIMIT_AUTH_WINDOW_MS). Both can be overridden per-instance so
 * integration tests can set `max: 1` for the 429 test without affecting
 * the rest of the suite.
 *
 * The 429 response uses the unified ErrorResponse shape.
 */
export function rateLimiter(opts?: { max?: number; windowMs?: number }) {
  return rateLimit({
    max: opts?.max ?? config.rateLimitAuthMax,
    windowMs: opts?.windowMs ?? config.rateLimitAuthWindowMs,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: ERROR_CODE.RATE_LIMITED,
          message: 'Too many requests.',
        },
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
