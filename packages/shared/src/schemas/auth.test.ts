import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { registerSchema } from './auth.js';
import { VALIDATION_KEY } from '../constants/validationKeys.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates email addresses accepted by z.email().
 * Pattern: lowercase alphanumeric local part + domain + 2-6 letter TLD.
 */
const safeEmailArb = fc.stringMatching(
  /^[a-z0-9]+(\.[a-z0-9]+)*@[a-z]+\.[a-z]{2,6}$/,
);

/**
 * Generates ASCII strings with UTF-8 byte length in [8, 72].
 * ASCII characters are single-byte, so char length == byte length.
 */
const validPasswordArb = fc
  .string({ minLength: 8, maxLength: 72, unit: 'grapheme-ascii' })
  .filter((s) => {
    const len = new TextEncoder().encode(s).length;
    return len >= 8 && len <= 72;
  });

/**
 * Generates strings that are either:
 * - too short (UTF-8 byte length < 8), or
 * - too long (UTF-8 byte length > 72)
 */
const invalidPasswordArb = fc.oneof(
  // too short: 0–7 ASCII characters
  fc.string({ maxLength: 7, unit: 'grapheme-ascii' }),
  // too long: string with enough multi-byte chars to exceed 72 bytes.
  // Build by repeating a 2-byte Cyrillic char (а = 0xD0 0xB0) 37+ times.
  fc
    .integer({ min: 37, max: 50 })
    .map((n) => 'а'.repeat(n)) // each 'а' is 2 UTF-8 bytes
    .filter((s) => new TextEncoder().encode(s).length > 72),
);

/**
 * Generates objects where at least one field (email or password) is invalid.
 */
const invalidRegistrationInputArb = fc.oneof(
  // bad email, valid password
  fc.record({
    email: fc.string().filter((s) => {
      // Exclude anything that could coincidentally be a valid email
      return !s.includes('@') || s.trim() !== s || s !== s.toLowerCase();
    }),
    password: validPasswordArb,
  }),
  // valid email, invalid password
  fc.record({ email: safeEmailArb, password: invalidPasswordArb }),
  // completely empty
  fc.constant({ email: '', password: '' }),
  // missing fields (empty string simulates missing-ish)
  fc.record({ email: safeEmailArb, password: fc.constant('') }),
);

// ---------------------------------------------------------------------------
// Property 2: Valid registration round-trip
// Validates: Requirements 3.1, 6.5 (design.md Property 2)
// ---------------------------------------------------------------------------

describe('registerSchema — Property 2: Valid registration round-trip', () => {
  it('accepts any valid email+password pair and normalises the email to lowercase', () => {
    fc.assert(
      fc.property(safeEmailArb, validPasswordArb, (email, password) => {
        const result = registerSchema.safeParse({ email, password });

        expect(result.success).toBe(true);
        if (result.success) {
          // email must be normalised to lowercase and trimmed
          expect(result.data.email).toBe(email.trim().toLowerCase());
          // password must pass through unchanged
          expect(result.data.password).toBe(password);
        }
      }),
    );
  });

  it('normalises email with leading/trailing whitespace', () => {
    fc.assert(
      fc.property(safeEmailArb, validPasswordArb, (email, password) => {
        const padded = `  ${email}  `;
        const result = registerSchema.safeParse({ email: padded, password });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe(email.toLowerCase());
        }
      }),
    );
  });

  it('normalises uppercase email to lowercase', () => {
    fc.assert(
      fc.property(safeEmailArb, validPasswordArb, (email, password) => {
        const upper = email.toUpperCase();
        const result = registerSchema.safeParse({ email: upper, password });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe(email.toLowerCase());
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Invalid request body always returns an error with the correct key
// Validates: Requirements 3.3, 4.3, 10.1, 10.2 (design.md Property 4)
// ---------------------------------------------------------------------------

describe('registerSchema — Property 4: Invalid request body produces correct validation key', () => {
  it('returns a parse error for any invalid registration input', () => {
    fc.assert(
      fc.property(invalidRegistrationInputArb, (input) => {
        const result = registerSchema.safeParse(input);

        expect(result.success).toBe(false);
      }),
    );
  });

  it('returns EMAIL_INVALID key when email field is not a valid email', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes('@')),
        validPasswordArb,
        (badEmail, password) => {
          const result = registerSchema.safeParse({ email: badEmail, password });

          expect(result.success).toBe(false);
          if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages).toContain(VALIDATION_KEY.EMAIL_INVALID);
          }
        },
      ),
    );
  });

  it('returns PASSWORD_TOO_SHORT key for any password shorter than 8 UTF-8 bytes', () => {
    fc.assert(
      fc.property(
        // strings with 0-7 ASCII characters (guaranteed < 8 bytes)
        fc.string({ maxLength: 7, unit: 'grapheme-ascii' }),
        safeEmailArb,
        (shortPassword, email) => {
          const result = registerSchema.safeParse({ email, password: shortPassword });

          expect(result.success).toBe(false);
          if (!result.success) {
            const messages = result.error.issues.map((i) => i.message);
            expect(messages).toContain(VALIDATION_KEY.PASSWORD_TOO_SHORT);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 19: Seed script password validation (schema layer)
// Validates: Requirements 9.3 (design.md Property 19)
// ---------------------------------------------------------------------------

describe('registerSchema — Property 19: Seed script password validation', () => {
  it('rejects any invalid password with PASSWORD_TOO_SHORT or PASSWORD_TOO_LONG', () => {
    fc.assert(
      fc.property(invalidPasswordArb, safeEmailArb, (invalidPassword, email) => {
        const result = registerSchema.safeParse({ email, password: invalidPassword });

        expect(result.success).toBe(false);
        if (!result.success) {
          const messages = result.error.issues.map((i) => i.message);
          const hasExpectedKey =
            messages.includes(VALIDATION_KEY.PASSWORD_TOO_SHORT) ||
            messages.includes(VALIDATION_KEY.PASSWORD_TOO_LONG);
          expect(hasExpectedKey).toBe(true);
        }
      }),
    );
  });

  it('rejects a too-short password with PASSWORD_TOO_SHORT', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(VALIDATION_KEY.PASSWORD_TOO_SHORT);
    }
  });

  it('rejects an empty password with PASSWORD_TOO_SHORT', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(VALIDATION_KEY.PASSWORD_TOO_SHORT);
    }
  });
});

// ---------------------------------------------------------------------------
// Cyrillic boundary test cases (explicit examples — Requirements 3.3, 9.3)
// Each Cyrillic character is 2 UTF-8 bytes.
// ---------------------------------------------------------------------------

describe('registerSchema — Cyrillic password boundary cases', () => {
  const email = 'user@example.com';

  it('accepts a 36-character Cyrillic password (72 UTF-8 bytes — exactly at limit)', () => {
    const password = 'а'.repeat(36); // 36 × 2 = 72 bytes
    expect(new TextEncoder().encode(password).length).toBe(72);

    const result = registerSchema.safeParse({ email, password });
    expect(result.success).toBe(true);
  });

  it('rejects a 37-character Cyrillic password (74 UTF-8 bytes — 2 bytes over limit)', () => {
    const password = 'а'.repeat(37); // 37 × 2 = 74 bytes
    expect(new TextEncoder().encode(password).length).toBe(74);

    const result = registerSchema.safeParse({ email, password });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(VALIDATION_KEY.PASSWORD_TOO_LONG);
    }
  });

  it('accepts a mixed ASCII+Cyrillic password at exactly 72 bytes', () => {
    // 10 ASCII chars + 31 Cyrillic = 10 + 62 = 72 bytes
    const password = 'abcdefghij' + 'а'.repeat(31);
    expect(new TextEncoder().encode(password).length).toBe(72);

    const result = registerSchema.safeParse({ email, password });
    expect(result.success).toBe(true);
  });

  it('rejects a mixed password that exceeds 72 bytes by one', () => {
    // 11 ASCII chars + 31 Cyrillic = 11 + 62 = 73 bytes
    const password = 'abcdefghijk' + 'а'.repeat(31);
    expect(new TextEncoder().encode(password).length).toBe(73);

    const result = registerSchema.safeParse({ email, password });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain(VALIDATION_KEY.PASSWORD_TOO_LONG);
    }
  });
});
