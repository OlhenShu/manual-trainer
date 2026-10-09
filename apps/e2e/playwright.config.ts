import { defineConfig, devices } from "@playwright/test";
import { e2eApiEnv, repoRoot } from "./env";

const webServerEnv = Object.fromEntries(
  Object.entries({ ...process.env, ...e2eApiEnv }).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm --filter @manual-trainer/api dev",
      cwd: repoRoot,
      port: 3000,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...webServerEnv, E2E_EXPOSE_VERIFICATION: "1" },
    },
    {
      command: "pnpm --filter @manual-trainer/web dev",
      cwd: repoRoot,
      url: "http://localhost:5173",
      reuseExistingServer: false,
      timeout: 120_000,
      env: webServerEnv,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
