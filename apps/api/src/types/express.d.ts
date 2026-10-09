import type { Role } from '../generated/prisma/enums.js';

// Extend Express Request to include the authenticated user attached by requireAuth.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
        passwordHash: string | null;
        createdAt: Date;
      };
    }
  }
}

export {};
