import { z } from 'zod';
import { VALIDATION_KEY } from '../constants/validationKeys.js';
import { issueTypeValues, priorityValues, severityValues } from '../constants/answer.js';
import { TASK_TYPE } from '../constants/scenario.js';
import { reviewResultSchema, reviewStatusSchema } from './review.js';

const requiredText = z
  .string()
  .refine((value) => value.trim().length > 0, { error: VALIDATION_KEY.FIELD_REQUIRED });

const textItemSchema = z.object({
  text: requiredText,
});

export const prioritySchema = z.enum(priorityValues, { error: VALIDATION_KEY.FIELD_REQUIRED });
export const severitySchema = z.enum(severityValues, { error: VALIDATION_KEY.FIELD_REQUIRED });
export const issueTypeSchema = z.enum(issueTypeValues, { error: VALIDATION_KEY.FIELD_REQUIRED });

export const testCaseAnswerSchema = z.object({
  taskType: z.literal(TASK_TYPE.TEST_CASE),
  name: requiredText,
  preconditions: requiredText,
  steps: z.array(textItemSchema).min(1, { error: VALIDATION_KEY.FIELD_REQUIRED }),
  expectedResult: requiredText,
  priority: prioritySchema,
});

export const bugReportAnswerSchema = z.object({
  taskType: z.literal(TASK_TYPE.BUG_REPORT),
  summary: requiredText,
  environment: requiredText,
  stepsToReproduce: z.array(textItemSchema).min(1, { error: VALIDATION_KEY.FIELD_REQUIRED }),
  actualResult: requiredText,
  expectedResult: requiredText,
  severity: severitySchema,
  priority: prioritySchema,
});

export const requirementsAnalysisAnswerSchema = z.object({
  taskType: z.literal(TASK_TYPE.REQUIREMENTS_ANALYSIS),
  issues: z
    .array(
      z.object({
        issueType: issueTypeSchema,
        fragment: requiredText,
        description: requiredText,
      }),
    )
    .min(1, { error: VALIDATION_KEY.FIELD_REQUIRED }),
});

export const requirementsCompositionAnswerSchema = z.object({
  taskType: z.literal(TASK_TYPE.REQUIREMENTS_COMPOSITION),
  userStory: requiredText,
  acceptanceCriteria: z.array(textItemSchema).min(1, { error: VALIDATION_KEY.FIELD_REQUIRED }),
});

export const answerSchema = z.discriminatedUnion('taskType', [
  testCaseAnswerSchema,
  bugReportAnswerSchema,
  requirementsAnalysisAnswerSchema,
  requirementsCompositionAnswerSchema,
]);

export const attemptSchema = z.object({
  id: z.uuid(),
  scenarioId: z.uuid(),
  createdAt: z.iso.datetime(),
  answer: answerSchema,
  reviewStatus: reviewStatusSchema,
  review: reviewResultSchema.nullable(),
});

export const attemptListSchema = z.array(attemptSchema);

export type Answer = z.output<typeof answerSchema>;
export type TestCaseAnswer = z.output<typeof testCaseAnswerSchema>;
export type BugReportAnswer = z.output<typeof bugReportAnswerSchema>;
export type RequirementsAnalysisAnswer = z.output<typeof requirementsAnalysisAnswerSchema>;
export type RequirementsCompositionAnswer = z.output<typeof requirementsCompositionAnswerSchema>;
export type Attempt = z.output<typeof attemptSchema>;
