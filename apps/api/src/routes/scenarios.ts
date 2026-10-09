import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import {
  ERROR_CODE,
  answerSchema,
  attemptListSchema,
  attemptSchema,
  reviewResultSchema,
  scenarioDetailSchema,
  scenarioListQuerySchema,
  scenarioListSchema,
} from '@manual-trainer/shared';
import { Prisma } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { isReferenceUnlocked } from '../services/reviewScore.js';
import { isReviewLimited, reviewStoredAttempt } from '../services/reviewRun.js';

const scenariosRouter: ExpressRouter = Router();

const listSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  taskType: true,
  mode: true,
  difficulty: true,
  passingThreshold: true,
} as const;

function notFound(res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  res.status(404).json({
    error: {
      code: ERROR_CODE.NOT_FOUND,
      message: 'Scenario not found.',
    },
  });
}

scenariosRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = scenarioListQuerySchema.parse(req.query);
    const scenarios = await db.scenario.findMany({
      where: {
        status: 'published',
        ...(query.taskType ? { taskType: query.taskType } : {}),
        ...(query.mode ? { mode: query.mode } : {}),
        ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      },
      orderBy: { title: 'asc' },
      select: listSelect,
    });

    res.status(200).json(scenarioListSchema.parse(scenarios));
  }),
);

scenariosRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rawId = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
    if (!z.uuid().safeParse(rawId).success || !rawId) {
      notFound(res);
      return;
    }

    const scenario = await db.scenario.findFirst({
      where: { id: rawId, status: 'published' },
      select: { ...listSelect, prompt: true, referenceSolution: true },
    });

    if (!scenario || !req.user) {
      notFound(res);
      return;
    }

    const completed = await db.attempt.findMany({
      where: { userId: req.user.id, scenarioId: scenario.id, reviewStatus: 'completed' },
      select: { review: true },
    });
    const results = completed.flatMap((attempt) => {
      const parsed = reviewResultSchema.safeParse(attempt.review);
      return parsed.success ? [{ passed: parsed.data.passed }] : [];
    });
    const referenceSolution = isReferenceUnlocked(results) ? scenario.referenceSolution : null;

    res.status(200).json(
      scenarioDetailSchema.parse({
        ...scenario,
        referenceSolution,
      }),
    );
  }),
);

scenariosRouter.get(
  '/:id/attempts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const scenarioId = publishedScenarioId(req.params['id']);
    if (!req.user) {
      res.status(401).json({
        error: { code: ERROR_CODE.UNAUTHORIZED, message: 'Authentication required.' },
      });
      return;
    }
    if (!scenarioId) {
      notFound(res);
      return;
    }

    const scenario = await db.scenario.findFirst({
      where: { id: scenarioId, status: 'published' },
      select: { id: true },
    });
    if (!scenario) {
      notFound(res);
      return;
    }

    const attempts = await db.attempt.findMany({
      where: { scenarioId, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(attemptListSchema.parse(attempts.map(serializeAttempt)));
  }),
);

scenariosRouter.post(
  '/:id/attempts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const scenarioId = publishedScenarioId(req.params['id']);
    if (!req.user) {
      res.status(401).json({
        error: { code: ERROR_CODE.UNAUTHORIZED, message: 'Authentication required.' },
      });
      return;
    }
    if (!scenarioId) {
      notFound(res);
      return;
    }

    const scenario = await db.scenario.findFirst({
      where: { id: scenarioId, status: 'published' },
      select: { id: true, taskType: true },
    });
    if (!scenario) {
      notFound(res);
      return;
    }

    const answer = answerSchema.parse(req.body);
    if (answer.taskType !== scenario.taskType) {
      res.status(422).json({
        error: {
          code: ERROR_CODE.VALIDATION_ERROR,
          message: 'Answer does not match the scenario task type.',
        },
      });
      return;
    }

    if (await isReviewLimited(req.user)) {
      res.status(429).json({
        error: {
          code: ERROR_CODE.RATE_LIMITED,
          message: 'Daily review limit reached.',
        },
      });
      return;
    }

    const created = await db.attempt.create({
      data: {
        userId: req.user.id,
        scenarioId: scenario.id,
        answer: answer as Prisma.InputJsonValue,
      },
    });

    const reviewed = await reviewStoredAttempt(created.id, req.user);
    sendStoredAttempt(res, 201, reviewed);
  }),
);

scenariosRouter.post(
  '/:id/attempts/:attemptId/review',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      res.status(401).json({
        error: { code: ERROR_CODE.UNAUTHORIZED, message: 'Authentication required.' },
      });
      return;
    }
    const scenarioId = publishedScenarioId(req.params['id']);
    const attemptId = publishedScenarioId(req.params['attemptId']);
    if (!scenarioId || !attemptId) {
      notFound(res);
      return;
    }

    const ownsScenario = await db.attempt.findFirst({
      where: { id: attemptId, scenarioId, userId: req.user.id },
      select: { id: true },
    });
    if (!ownsScenario) {
      notFound(res);
      return;
    }

    const reviewed = await reviewStoredAttempt(attemptId, req.user);
    sendStoredAttempt(res, 200, reviewed);
  }),
);

function serializeAttempt(attempt: {
  id: string;
  scenarioId: string;
  createdAt: Date;
  answer: unknown;
  reviewStatus: 'pending' | 'completed' | 'failed';
  review: unknown;
}) {
  return attemptSchema.parse({
    id: attempt.id,
    scenarioId: attempt.scenarioId,
    createdAt: attempt.createdAt.toISOString(),
    answer: attempt.answer,
    reviewStatus: attempt.reviewStatus,
    review: attempt.review,
  });
}

function sendStoredAttempt(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  status: number,
  result: Awaited<ReturnType<typeof reviewStoredAttempt>>,
): void {
  if (result.type === 'not_found') {
    notFound(res);
    return;
  }
  if (result.type === 'limited') {
    res.status(429).json({
      error: {
        code: ERROR_CODE.RATE_LIMITED,
        message: 'Daily review limit reached.',
      },
    });
    return;
  }
  res.status(status).json(serializeAttempt(result.attempt));
}

function publishedScenarioId(raw: string | string[] | undefined): string | undefined {
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !z.uuid().safeParse(id).success) {
    return undefined;
  }
  return id;
}

export default scenariosRouter;
