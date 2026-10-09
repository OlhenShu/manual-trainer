/**
 * Cross-platform test runner.
 *
 * Steps:
 *   1. Load apps/api/.env via dotenv so TEST_DATABASE_URL is available.
 *   2. Override DATABASE_URL with the value of TEST_DATABASE_URL so Prisma
 *      migrations and Vitest always target the test database.
 *   3. Run `prisma migrate deploy` inside apps/api.
 *   4. Run the root Vitest suite.
 *
 * Using a Node script instead of shell variable assignment (e.g. DATABASE_URL=…)
 * ensures identical behaviour on Windows, macOS, and Linux.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { platform } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const apiDir = resolve(root, "apps", "api");
const envPath = resolve(apiDir, ".env");

// ── 1. Load apps/api/.env ────────────────────────────────────────────────────
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch (err) {
  if (err.code !== "ENOENT") {
    console.error("[test.mjs] Failed to read apps/api/.env:", err.message);
    process.exit(1);
  }
  // .env not present — rely on environment variables already set (CI, etc.)
}

// ── 2. Switch DATABASE_URL to the test database ──────────────────────────────
const testDbUrl = process.env["TEST_DATABASE_URL"];
if (!testDbUrl) {
  console.error(
    "[test.mjs] TEST_DATABASE_URL is not set. " +
      "Add it to apps/api/.env or export it in your environment before running tests."
  );
  process.exit(1);
}
process.env["DATABASE_URL"] = testDbUrl;

// ── Helper: spawn a command and wait for it to exit ──────────────────────────
function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${cmd} ${args.join(" ")}" exited with code ${code}`));
      }
    });
  });
}

// ── pnpm runner (Windows-safe) ───────────────────────────────────────────────
// On Windows pnpm is installed as a shell script chain (pnpm.cmd → sh → pnpm.mjs)
// which cannot be spawned reliably without shell:true (which has quoting bugs).
// We invoke pnpm.mjs directly via the current node executable instead.
// On Unix, pnpm is a proper executable that can be called directly by name.
function pnpm(args, options = {}) {
  if (platform !== "win32") {
    return run("pnpm", args, options);
  }
  const nodeDir = dirname(process.execPath);
  const pnpmMjs = resolve(nodeDir, "node_modules", "pnpm", "bin", "pnpm.mjs");
  return run(process.execPath, [pnpmMjs, ...args], options);
}

// ── 3. Apply Prisma migrations to the test database ─────────────────────────
console.log("[test.mjs] Running prisma migrate deploy against TEST_DATABASE_URL…");
try {
  await pnpm(["exec", "prisma", "migrate", "deploy"], {
    cwd: apiDir,
    env: process.env,
  });
} catch (err) {
  console.error("[test.mjs] prisma migrate deploy failed:", err.message);
  process.exit(1);
}

// ── 4. Run Vitest ────────────────────────────────────────────────────────────
console.log("[test.mjs] Running Vitest…");
try {
  await pnpm(["exec", "vitest", "run"], {
    cwd: root,
    env: process.env,
  });
} catch (err) {
  console.error("[test.mjs] Vitest run failed:", err.message);
  process.exit(1);
}
