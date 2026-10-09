import express from 'express';
import type { Express } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { ERROR_CODE } from '@manual-trainer/shared';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import scenariosRouter from './routes/scenarios.js';
import progressRouter from './routes/progress.js';

export interface AppConfig {
  rateLimiting?: false | { max?: number; windowMs?: number };
  /**
   * When true, mounts GET /api/test/error that always throws an unhandled error.
   * Use only in integration tests to verify the 500 errorHandler behaviour.
   */
  testErrorRoute?: boolean;
}

/**
 * Express app factory.
 *
 * Accepts an optional AppConfig so tests can:
 *   - Disable rate limiting entirely:          createApp({ rateLimiting: false })
 *   - Override limits for the 429 test:        createApp({ rateLimiting: { max: 1 } })
 *   - Use production defaults (no argument):   createApp()
 *
 * Import order is intentional:
 *   1. Body-parsing middleware (cookie-parser, json)
 *   2. Per-route rate limiters (before the router mounts them)
 *   3. Route handlers
 *   4. 404 catch-all
 *   5. Global error handler (must be last)
 */
export function createApp(appConfig?: AppConfig): Express {
  const app = express();
  if (process.env['NODE_ENV'] === 'production') {
    app.set('trust proxy', 1);
  }

  // -----------------------------------------------------------------------
  // 1. Body-parsing middleware
  // -----------------------------------------------------------------------
  app.use(cookieParser());
  app.use(express.json());

  // -----------------------------------------------------------------------
  // 2. Per-route rate limiters
  //    Applied individually to POST /api/auth/register and POST /api/auth/login
  //    so each endpoint has its own independent counter.
  //    Skipped entirely when rateLimiting === false (integration tests).
  // -----------------------------------------------------------------------
  if (appConfig?.rateLimiting !== false) {
    const limiterOpts =
      appConfig?.rateLimiting && typeof appConfig.rateLimiting === 'object'
        ? appConfig.rateLimiting
        : undefined;

    app.post('/api/auth/register', rateLimiter(limiterOpts));
    app.post('/api/auth/login', rateLimiter(limiterOpts));
    app.post('/api/auth/resend-verification', rateLimiter(limiterOpts));
  }

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // -----------------------------------------------------------------------
  // 3. Route handlers
  // -----------------------------------------------------------------------
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/scenarios', scenariosRouter);
  app.use('/api/progress', progressRouter);

  // -----------------------------------------------------------------------
  // 3a. Optional test-only error route (integration tests only)
  //     Mounts GET /api/test/error that always throws to exercise the 500 handler.
  // -----------------------------------------------------------------------
  if (appConfig?.testErrorRoute) {
    app.get('/api/test/error', (_req, _res, next) => {
      next(new Error('Deliberate test error'));
    });
  }

  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (process.env['NODE_ENV'] === 'production' && existsSync(path.join(webDist, 'index.html'))) {
    const staticFiles = express.static(webDist);
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      staticFiles(req, res, next);
    });
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  // -----------------------------------------------------------------------
  // 4. 404 catch-all for any unmatched route
  // -----------------------------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: ERROR_CODE.NOT_FOUND,
        message: 'Route not found.',
      },
    });
  });

  // -----------------------------------------------------------------------
  // 5. Global error handler — must be registered last
  // -----------------------------------------------------------------------
  app.use(errorHandler);

  return app;
}
