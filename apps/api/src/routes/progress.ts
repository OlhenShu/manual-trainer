import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { ERROR_CODE } from '@manual-trainer/shared';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { loadProgress } from '../services/progress.js';

const progressRouter: ExpressRouter = Router();

progressRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({
        error: { code: ERROR_CODE.UNAUTHORIZED, message: 'Authentication required.' },
      });
      return;
    }
    res.status(200).json(await loadProgress(req.user.id));
  }),
);

export default progressRouter;
