/**
 * Integration tests for the admin seed script (apps/api/scripts/seed.ts).
 *
 * Covers requirements: 9.1, 9.2, 9.3, 9.4
 * Properties tested: 19 (password validation), 20 (idempotence)
 *
 * The seed script is spawned as a real child process so that exit codes and
 * stdout/stderr streams are exercised exactly as they are in production.
 *
 * DATABASE_URL is set to the test database by the root `test` script before
 * Vitest runs, so the child process inherits it via process.env.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/api root (two levels up from src/scripts/)
const apiRoot = path.resolve(__dirname, '..', '..');
// Path to the seed script relative to apiRoot — matches the "seed" npm script
const seedScript = path.join(apiRoot, 'scripts', 'seed.ts');

// ---------------------------------------------------------------------------
// Helper: run the seed script synchronously as a child process
// ---------------------------------------------------------------------------
interface SeedResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runSeed(env: Record<string, string>): SeedResult {
  // Merge with the current process env so DATABASE_URL, JWT_SECRET, etc. are
  // available.  The caller can override any variable by including it in `env`.
  const merged: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
    // Force BCRYPT_ROUNDS=4 for speed in tests
    BCRYPT_ROUNDS: '4',
  };

  const result = spawnSync('node', ['--import', 'tsx/esm', seedScript], {
    cwd: apiRoot,
    env: merged,
    encoding: 'utf8',
    // Give the script up to 30 s — bcrypt + DB round-trip
    timeout: 30_000,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ---------------------------------------------------------------------------
// DB clean-up
// ---------------------------------------------------------------------------
beforeEach(async () => {
  await db.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
});

afterAll(async () => {
  await db.$disconnect();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function uniqueAdminEmail(label = 'seed'): string {
  return `${label}-${crypto.randomUUID()}@admin.example`;
}

// ===========================================================================
// Seed creates admin (Req 9.1)
// ===========================================================================
describe('Seed creates admin account', () => {
  it('creates an admin user when valid ADMIN_EMAIL and ADMIN_PASSWORD are given (Req 9.1)', async () => {
    const email = uniqueAdminEmail('create');
    const { exitCode, stderr } = runSeed({
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: 'ValidPass1!',
    });

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe('admin');
  });

  it('normalises the email to lowercase before inserting (Req 9.1)', async () => {
    const upperEmail = 'ADMIN-' + crypto.randomUUID() + '@ADMIN.EXAMPLE';
    const { exitCode } = runSeed({
      ADMIN_EMAIL: upperEmail,
      ADMIN_PASSWORD: 'ValidPass1!',
    });

    expect(exitCode).toBe(0);

    const user = await db.user.findUnique({
      where: { email: upperEmail.toLowerCase() },
    });
    expect(user).not.toBeNull();
    expect(user!.email).toBe(upperEmail.toLowerCase());
  });

  it('normalises the email by trimming whitespace before inserting (Req 9.1)', async () => {
    const baseEmail = uniqueAdminEmail('trim');
    const paddedEmail = `  ${baseEmail}  `;
    const { exitCode } = runSeed({
      ADMIN_EMAIL: paddedEmail,
      ADMIN_PASSWORD: 'ValidPass1!',
    });

    expect(exitCode).toBe(0);

    const user = await db.user.findUnique({ where: { email: baseEmail } });
    expect(user).not.toBeNull();
  });
});

// ===========================================================================
// Duplicate email — idempotence (Req 9.4, Property 20)
// ===========================================================================
describe('Seed is idempotent for duplicate emails (Req 9.4, Property 20)', () => {
  it('makes no DB changes and prints stdout warning when email already exists', async () => {
    const email = uniqueAdminEmail('dup');

    // First run — creates admin
    const first = runSeed({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'ValidPass1!' });
    expect(first.exitCode).toBe(0);

    const afterFirstRun = await db.user.findMany({ where: { email } });
    expect(afterFirstRun).toHaveLength(1);

    // Second run — same email
    const second = runSeed({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'ValidPass1!' });
    expect(second.exitCode).toBe(0);
    // Warning must appear in stdout, not stderr
    expect(second.stdout).toMatch(/already exists/i);
    expect(second.stderr).toBe('');

    // DB must be unchanged — still exactly one record
    const afterSecondRun = await db.user.findMany({ where: { email } });
    expect(afterSecondRun).toHaveLength(1);
    expect(afterSecondRun[0]!.id).toBe(afterFirstRun[0]!.id);
  });

  it('stdout warning includes the existing user\'s role (Req 9.4)', async () => {
    const email = uniqueAdminEmail('role-warn');

    runSeed({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'ValidPass1!' });

    const second = runSeed({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'ValidPass1!' });
    expect(second.exitCode).toBe(0);
    // The warning should mention the role
    expect(second.stdout).toMatch(/admin/i);
  });

  it('is case-insensitively idempotent — uppercased email finds existing lowercase record', async () => {
    const email = uniqueAdminEmail('case-idem');

    // Create with lowercase
    runSeed({ ADMIN_EMAIL: email, ADMIN_PASSWORD: 'ValidPass1!' });

    // Run again with uppercase variant — should find existing and warn
    const second = runSeed({
      ADMIN_EMAIL: email.toUpperCase(),
      ADMIN_PASSWORD: 'ValidPass1!',
    });
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toMatch(/already exists/i);

    // Still only one record
    const records = await db.user.findMany({ where: { email } });
    expect(records).toHaveLength(1);
  });
});

// ===========================================================================
// Invalid password (Req 9.3, Property 19)
// ===========================================================================
describe('Seed rejects invalid passwords (Req 9.3, Property 19)', () => {
  it('exits non-zero and writes to stderr when password is shorter than 8 chars', async () => {
    const email = uniqueAdminEmail('short-pw');
    const { exitCode, stderr, stdout } = runSeed({
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: 'short',
    });

    expect(exitCode).not.toBe(0);
    expect(stderr).not.toBe('');

    // No DB record should have been created
    const user = await db.user.findUnique({ where: { email } });
    expect(user).toBeNull();
    // Nothing should have been written to stdout indicating success
    expect(stdout).not.toMatch(/created successfully/i);
  });

  it('exits non-zero when password is empty string', async () => {
    const email = uniqueAdminEmail('empty-pw');
    const { exitCode, stderr } = runSeed({
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: '',
    });

    // Empty string is falsy — the script treats this as missing ADMIN_PASSWORD
    expect(exitCode).not.toBe(0);
    expect(stderr).not.toBe('');

    const user = await db.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  it('exits non-zero and writes to stderr when password exceeds 72 UTF-8 bytes (37 Cyrillic chars = 74 bytes)', async () => {
    // 37 Cyrillic letters × 2 bytes = 74 bytes > 72 byte limit
    const longPassword = 'а'.repeat(37);
    const email = uniqueAdminEmail('long-pw');
    const { exitCode, stderr } = runSeed({
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: longPassword,
    });

    expect(exitCode).not.toBe(0);
    expect(stderr).not.toBe('');

    const user = await db.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });

  it('accepts password exactly at 72-byte boundary (36 Cyrillic chars = 72 bytes)', async () => {
    // 36 Cyrillic letters × 2 bytes = 72 bytes — exactly at the limit, should pass
    const boundaryPassword = 'а'.repeat(36);
    const email = uniqueAdminEmail('boundary-pw');
    const { exitCode, stderr } = runSeed({
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: boundaryPassword,
    });

    expect(exitCode).toBe(0);
    expect(stderr).toBe('');

    const user = await db.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
  });
});

// ===========================================================================
// Missing environment variables (Req 9.2)
// ===========================================================================
describe('Seed exits non-zero when required env vars are missing (Req 9.2)', () => {
  it('exits non-zero and writes to stderr when ADMIN_EMAIL is not set', () => {
    const { exitCode, stderr } = runSeed({
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: 'ValidPass1!',
    });

    expect(exitCode).not.toBe(0);
    expect(stderr).not.toBe('');
  });

  it('exits non-zero and writes to stderr when ADMIN_PASSWORD is not set', () => {
    const { exitCode, stderr } = runSeed({
      ADMIN_EMAIL: uniqueAdminEmail('no-pw'),
      ADMIN_PASSWORD: '',
    });

    expect(exitCode).not.toBe(0);
    expect(stderr).not.toBe('');
  });

  it('exits non-zero with descriptive stderr message when both vars are missing', () => {
    const { exitCode, stderr } = runSeed({
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
    });

    expect(exitCode).not.toBe(0);
    // Stderr should mention the missing variables
    expect(stderr).toMatch(/ADMIN_EMAIL|ADMIN_PASSWORD/i);
  });
});
