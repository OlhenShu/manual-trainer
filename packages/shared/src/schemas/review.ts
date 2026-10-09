import { z } from 'zod';

export const REVIEW_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const reviewStatusSchema = z.enum([
  REVIEW_STATUS.PENDING,
  REVIEW_STATUS.COMPLETED,
  REVIEW_STATUS.FAILED,
]);

export const rubricCriterionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(1).max(100),
});

export const rubricSchema = z.object({
  criteria: z.array(rubricCriterionSchema).min(1),
});

export const providerReviewSchema = z.object({
  criteria: z.array(
    z.object({
      criterionId: z.string().min(1),
      score: z.number().int().min(0),
      comment: z.string(),
    }),
  ),
  feedback: z.string(),
});

export const criterionReviewSchema = z.object({
  criterionId: z.string().min(1),
  title: z.string().min(1),
  score: z.number().int().min(0),
  maxScore: z.number().int().min(1),
  comment: z.string(),
});

export const reviewResultSchema = z.object({
  criteria: z.array(criterionReviewSchema).min(1),
  totalScore: z.number().int().min(0),
  maxScore: z.number().int().min(1),
  percent: z.number().int().min(0).max(100),
  passed: z.boolean(),
  feedback: z.string().min(1),
});

export type ReviewStatus = z.output<typeof reviewStatusSchema>;
export type Rubric = z.output<typeof rubricSchema>;
export type ProviderReview = z.output<typeof providerReviewSchema>;
export type ReviewResult = z.output<typeof reviewResultSchema>;
