import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(e2eDir, "../..");

export const E2E_ADMIN_EMAIL = "admin@example.com";
export const E2E_ADMIN_PASSWORD = "Adminpass1";

function readDotEnv(path: string): Record<string, string> {
  const values: Record<string, string> = {};
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    values[key] = value;
  }
  return values;
}

const fileEnv = readDotEnv(resolve(repoRoot, "apps/api/.env"));
export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Add it to apps/api/.env before running e2e tests.",
  );
}

export const e2eApiEnv: Record<string, string> = {
  DATABASE_URL: testDatabaseUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
  JWT_SECRET: "e2e-jwt-secret-not-for-production",
  JWT_EXPIRES_IN: "7d",
  NODE_ENV: "test",
  PORT: "3000",
  BCRYPT_ROUNDS: "4",
  RATE_LIMIT_AUTH_MAX: "9999",
  RATE_LIMIT_AUTH_WINDOW_MS: "900000",
  ADMIN_EMAIL: E2E_ADMIN_EMAIL,
  ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
};
