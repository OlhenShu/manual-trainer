import { z } from 'zod';
import { VALIDATION_KEY } from '../constants/validationKeys';
import { difficultyValues, scenarioModeValues, taskTypeValues } from '../constants/scenario';
import { rubricSchema } from './review';

const requiredText = z
  .string()
  .refine((value) => value.trim().length > 0, { error: VALIDATION_KEY.FIELD_REQUIRED });

export const SCENARIO_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

export const scenarioStatusSchema = z.enum([SCENARIO_STATUS.DRAFT, SCENARIO_STATUS.PUBLISHED]);

export const adminScenarioWriteSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: VALIDATION_KEY.SLUG_INVALID }),
    title: requiredText,
    summary: requiredText,
    taskType: z.enum(taskTypeValues),
    mode: z.enum(scenarioModeValues),
    difficulty: z.enum(difficultyValues),
    status: scenarioStatusSchema,
    prompt: requiredText,
    passingThreshold: z.number().int().min(1).max(100),
    referenceSolution: requiredText,
    rubric: rubricSchema,
    embeddedDefects: z.array(requiredText),
  })
  .superRefine((value, ctx) => {
    const weight = value.rubric.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (weight !== 100) {
      ctx.addIssue({
        code: 'custom',
        message: VALIDATION_KEY.RUBRIC_WEIGHTS,
        path: ['rubric'],
      });
    }
    if (value.mode === 'fix' && value.embeddedDefects.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: VALIDATION_KEY.DEFECTS_REQUIRED,
        path: ['embeddedDefects'],
      });
    }
  });

export const adminScenarioSchema = adminScenarioWriteSchema.extend({
  id: z.uuid(),
});

export const adminScenarioListSchema = z.array(adminScenarioSchema);

export const adminScenarioStatsSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  attempts: z.number().int().min(0),
  averageScore: z.number().nullable(),
  averageFirstScore: z.number().nullable(),
  successRate: z.number().nullable(),
});

export const adminStudentScenarioSchema = z.object({
  scenarioId: z.uuid(),
  title: z.string(),
  attempts: z.number().int().min(0),
  firstScore: z.number().int().min(0).max(100),
  bestScore: z.number().int().min(0).max(100),
  passed: z.boolean(),
});

export const adminStudentStatsSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  attempts: z.number().int().min(0),
  averageScore: z.number().nullable(),
  averageFirstScore: z.number().nullable(),
  successRate: z.number().nullable(),
  passedScenarios: z.number().int().min(0),
  emailVerified: z.boolean(),
  role: z.enum(['user', 'admin']),
  reviewCredits: z.number().int().min(0),
  scenarios: z.array(adminStudentScenarioSchema),
});

export const adminUserPatchSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    addReviews: z.number().int().min(1).max(100).optional(),
  })
  .refine((value) => value.role !== undefined || value.addReviews !== undefined, {
    error: VALIDATION_KEY.FIELD_REQUIRED,
  });

export const adminStatsSchema = z.object({
  activeUsers: z.number().int().min(0),
  attempts: z.number().int().min(0),
  averageScore: z.number().nullable(),
  averageFirstScore: z.number().nullable(),
  successRate: z.number().nullable(),
  aiCostUsd: z.number(),
  scenarios: z.array(adminScenarioStatsSchema),
  students: z.array(adminStudentStatsSchema),
  weakCriteria: z.array(
    z.object({
      title: z.string(),
      failedCount: z.number().int().min(0),
    }),
  ),
});

export type AdminScenarioWrite = z.output<typeof adminScenarioWriteSchema>;
export type AdminScenario = z.output<typeof adminScenarioSchema>;
export type AdminStats = z.output<typeof adminStatsSchema>;
