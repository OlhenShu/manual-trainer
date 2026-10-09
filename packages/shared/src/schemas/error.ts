import { z } from 'zod';

export const errorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(errorDetailSchema).optional(),
  }),
});

// Inferred TypeScript types
export type ErrorDetail = z.output<typeof errorDetailSchema>;
export type ErrorResponse = z.output<typeof errorResponseSchema>;
