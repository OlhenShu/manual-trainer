import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { Prisma } from '../generated/prisma/client.js';
import { ERROR_CODE } from '@manual-trainer/shared';

/**
 * Global Express error handler (four-argument form).
 *
 * Maps all error types to the unified ErrorResponse shape.
 * Must be registered as the LAST middleware in the app.
 *
 * Error mapping:
 * - ZodError                          → 422 VALIDATION_ERROR  (with details)
 * - SyntaxError (malformed JSON body) → 422 VALIDATION_ERROR
 * - Prisma P2002 on email             → 409 EMAIL_TAKEN
 * - JsonWebTokenError / TokenExpiredError → 401 UNAUTHORIZED
 * - unhandled exception               → 500 INTERNAL_ERROR    (no stack leak)
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // -----------------------------------------------------------------------
  // 422 — Zod validation failure
  // -----------------------------------------------------------------------
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(422).json({
      error: {
        code: ERROR_CODE.VALIDATION_ERROR,
        message: 'Validation failed.',
        details,
      },
    });
    return;
  }

  // -----------------------------------------------------------------------
  // 422 — Malformed JSON body (Express JSON parser throws SyntaxError with
  //        status 400 set on the error object)
  // -----------------------------------------------------------------------
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as SyntaxError & { status: number }).status === 400
  ) {
    res.status(422).json({
      error: {
        code: ERROR_CODE.VALIDATION_ERROR,
        message: 'Invalid JSON in request body.',
      },
    });
    return;
  }

  // -----------------------------------------------------------------------
  // 409 — Prisma unique constraint violation on the email field
  //
  // Prisma 7 with driver adapters surfaces the constraint name differently
  // depending on the adapter. The constraint name may appear in:
  //   - meta.target (array or string) — Prisma 6 / engine-based
  //   - meta.constraint — Prisma 7 driver-adapter path
  //   - meta.modelName — always 'User' for our only unique-constrained model
  //
  // We accept the 409 mapping for any P2002 on the User model whose constraint
  // name or target references 'email', OR (as a safe fallback for driver-adapter
  // mode) for any P2002 where modelName is 'User', because email is the only
  // unique field on that model.
  // -----------------------------------------------------------------------
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    const meta = err.meta as Record<string, unknown> | undefined;

    const target = meta?.['target'];
    const constraint = meta?.['constraint'];
    const modelName = meta?.['modelName'];

    const targetReferencesEmail =
      Array.isArray(target)
        ? target.includes('email')
        : typeof target === 'string' && target.includes('email');

    const constraintReferencesEmail =
      typeof constraint === 'string' && constraint.includes('email');

    // Fallback: any P2002 on the User model is an email uniqueness violation
    // because email is the only unique field defined in the schema.
    const isUserModel = modelName === 'User';

    if (targetReferencesEmail || constraintReferencesEmail || isUserModel) {
      res.status(409).json({
        error: {
          code: ERROR_CODE.EMAIL_TAKEN,
          message: 'Email is already in use.',
        },
      });
      return;
    }
  }

  // -----------------------------------------------------------------------
  // 401 — JWT errors (invalid signature, malformed, expired)
  // -----------------------------------------------------------------------
  if (err instanceof jwt.TokenExpiredError || err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({
      error: {
        code: ERROR_CODE.UNAUTHORIZED,
        message: 'Authentication required.',
      },
    });
    return;
  }

  // -----------------------------------------------------------------------
  // 500 — Unhandled exception
  // Log the full error server-side; never leak stack traces to the client.
  // -----------------------------------------------------------------------
  console.error('[Unhandled error]', err);

  res.status(500).json({
    error: {
      code: ERROR_CODE.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
    },
  });
}
