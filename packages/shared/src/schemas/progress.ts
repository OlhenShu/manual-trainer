import { z } from 'zod';

export const progressItemSchema = z.object({
  scenarioId: z.uuid(),
  title: z.string().min(1),
  firstScore: z.number().int().min(0).max(100),
  bestScore: z.number().int().min(0).max(100),
  passed: z.boolean(),
});

export const progressListSchema = z.array(progressItemSchema);

export type ProgressItem = z.output<typeof progressItemSchema>;
