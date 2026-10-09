import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { platform } from "node:process";
import { e2eApiEnv, repoRoot } from "./env";

function runPnpm(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  if (platform === "win32") {
    const pnpmMjs = resolve(dirname(process.execPath), "node_modules", "pnpm", "bin", "pnpm.mjs");
    execFileSync(process.execPath, [pnpmMjs, ...args], { cwd, env, stdio: "inherit" });
    return;
  }
  execFileSync("pnpm", args, { cwd, env, stdio: "inherit" });
}

export default function globalSetup() {
  const env = { ...process.env, ...e2eApiEnv };
  const apiDir = resolve(repoRoot, "apps/api");
  runPnpm(["exec", "prisma", "migrate", "reset", "--force", "--skip-seed"], apiDir, env);
  runPnpm(["exec", "tsx", "scripts/seed.ts"], apiDir, env);
}
