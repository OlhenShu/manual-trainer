import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import {
  ERROR_CODE,
  adminScenarioListSchema,
  adminScenarioSchema,
  adminScenarioWriteSchema,
  adminUserPatchSchema,
} from '@manual-trainer/shared';
import { Prisma } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { loadAdminStats } from '../services/adminStats.js';

const adminRouter: ExpressRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = scenarioId(req.params['id']);
    if (!id) {
      notFound(res);
      return;
    }
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      notFound(res);
      return;
    }
    if (user.role !== 'user') {
      res.status(403).json({
        error: { code: ERROR_CODE.FORBIDDEN, message: 'Only student accounts can be deleted.' },
      });
      return;
    }
    await db.user.delete({ where: { id } });
    res.status(204).send();
  }),
);

adminRouter.get(
  '/ping',
  asyncHandler(async (_req, res) => {
    res.status(200).json({ message: 'pong' });
  }),
);

adminRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await loadAdminStats();
    res.status(200).json({
      ...stats,
      students: stats.students.filter((student) => student.id !== req.user?.id),
    });
  }),
);

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = scenarioId(req.params['id']);
    if (!id) {
      notFound(res);
      return;
    }
    const input = adminUserPatchSchema.parse(req.body);
    if (id === req.user?.id) {
      res.status(403).json({
        error: { code: ERROR_CODE.FORBIDDEN, message: 'You cannot change your own account here.' },
      });
      return;
    }
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      notFound(res);
      return;
    }
    const updated = await db.user.update({
      where: { id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.addReviews ? { reviewCredits: { increment: input.addReviews } } : {}),
      },
    });
    res.status(200).json({
      id: updated.id,
      email: updated.email,
      role: updated.role,
      reviewCredits: updated.reviewCredits,
    });
  }),
);

adminRouter.get(
  '/scenarios',
  asyncHandler(async (_req, res) => {
    const scenarios = await db.scenario.findMany({ orderBy: { updatedAt: 'desc' } });
    res.status(200).json(adminScenarioListSchema.parse(scenarios.map(toAdminScenario)));
  }),
);

adminRouter.get(
  '/scenarios/:id',
  asyncHandler(async (req, res) => {
    const scenario = await findScenario(req.params['id']);
    if (!scenario) {
      notFound(res);
      return;
    }
    res.status(200).json(adminScenarioSchema.parse(toAdminScenario(scenario)));
  }),
);

adminRouter.post(
  '/scenarios',
  asyncHandler(async (req, res) => {
    const input = adminScenarioWriteSchema.parse(req.body);
    try {
      const created = await db.scenario.create({ data: toScenarioData(input) });
      res.status(201).json(adminScenarioSchema.parse(toAdminScenario(created)));
    } catch (err) {
      if (isSlugTaken(err)) {
        slugTaken(res);
        return;
      }
      throw err;
    }
  }),
);

adminRouter.patch(
  '/scenarios/:id',
  asyncHandler(async (req, res) => {
    const id = scenarioId(req.params['id']);
    if (!id) {
      notFound(res);
      return;
    }
    const input = adminScenarioWriteSchema.parse(req.body);
    try {
      const updated = await db.scenario.update({
        where: { id },
        data: toScenarioData(input),
      });
      res.status(200).json(adminScenarioSchema.parse(toAdminScenario(updated)));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        notFound(res);
        return;
      }
      if (isSlugTaken(err)) {
        slugTaken(res);
        return;
      }
      throw err;
    }
  }),
);

function toScenarioData(input: ReturnType<typeof adminScenarioWriteSchema.parse>) {
  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    taskType: input.taskType,
    mode: input.mode,
    difficulty: input.difficulty,
    status: input.status,
    prompt: input.prompt,
    passingThreshold: input.passingThreshold,
    referenceSolution: input.referenceSolution,
    rubric: input.rubric as Prisma.InputJsonValue,
    embeddedDefects: input.embeddedDefects as Prisma.InputJsonValue,
  };
}

function toAdminScenario(scenario: {
  id: string;
  slug: string;
  title: string;
  summary: string;
  taskType: string;
  mode: string;
  difficulty: string;
  status: string;
  prompt: string;
  passingThreshold: number;
  referenceSolution: string;
  rubric: unknown;
  embeddedDefects: unknown;
}) {
  return {
    ...scenario,
    embeddedDefects: Array.isArray(scenario.embeddedDefects) ? scenario.embeddedDefects : [],
  };
}

async function findScenario(raw: string | string[] | undefined) {
  const id = scenarioId(raw);
  if (!id) return null;
  return db.scenario.findUnique({ where: { id } });
}

function scenarioId(raw: string | string[] | undefined): string | undefined {
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !z.uuid().safeParse(id).success) return undefined;
  return id;
}

function isSlugTaken(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function slugTaken(res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  res.status(409).json({
    error: { code: ERROR_CODE.SLUG_TAKEN, message: 'A scenario with this slug already exists.' },
  });
}

function notFound(res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  res.status(404).json({
    error: { code: ERROR_CODE.NOT_FOUND, message: 'Scenario not found.' },
  });
}

export default adminRouter;
