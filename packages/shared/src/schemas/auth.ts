import { z } from 'zod';

export const publicUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(['user', 'admin']),
  createdAt: z.iso.datetime(),
});

export const registerSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email({ error: 'EMAIL_INVALID' })),
  password: z
    .string()
    .min(8, { error: 'PASSWORD_TOO_SHORT' })
    .check((ctx) => {
      if (new TextEncoder().encode(ctx.value).length > 72) {
        ctx.issues.push({ code: 'custom', input: ctx.value, message: 'PASSWORD_TOO_LONG' });
      }
    }),
});

export const registerResultSchema = z.object({
  email: z.email(),
});

export const resendVerificationSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email({ error: 'EMAIL_INVALID' })),
});

export const loginSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email({ error: 'EMAIL_INVALID' })),
  password: z.string().min(1, { error: 'FIELD_REQUIRED' }),
});

// Inferred TypeScript types
export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type PublicUser = z.output<typeof publicUserSchema>;
