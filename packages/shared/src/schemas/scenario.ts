import { z } from 'zod';
import { difficultyValues, scenarioModeValues, taskTypeValues } from '../constants/scenario';

export const taskTypeSchema = z.enum(taskTypeValues);
export const scenarioModeSchema = z.enum(scenarioModeValues);
export const difficultySchema = z.enum(difficultyValues);

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined) {
    return undefined;
  }
  return value;
}

export const scenarioListQuerySchema = z.object({
  taskType: z.preprocess(emptyToUndefined, taskTypeSchema.optional()),
  mode: z.preprocess(emptyToUndefined, scenarioModeSchema.optional()),
  difficulty: z.preprocess(emptyToUndefined, difficultySchema.optional()),
});

export const scenarioListItemSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  taskType: taskTypeSchema,
  mode: scenarioModeSchema,
  difficulty: difficultySchema,
  passingThreshold: z.number().int().min(1).max(100),
});

export const scenarioListSchema = z.array(scenarioListItemSchema);

export const scenarioDetailSchema = scenarioListItemSchema.extend({
  prompt: z.string().min(1),
  referenceSolution: z.string().nullable(),
});

export type ScenarioListQuery = z.output<typeof scenarioListQuerySchema>;
export type ScenarioListItem = z.output<typeof scenarioListItemSchema>;
export type ScenarioDetail = z.output<typeof scenarioDetailSchema>;
