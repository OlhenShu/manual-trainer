import "dotenv/config";

// Validate required variables at startup
const jwtSecret = process.env["JWT_SECRET"];
if (!jwtSecret) {
  process.stderr.write(
    "Error: JWT_SECRET environment variable is required but not set. " +
      "Please set JWT_SECRET in your .env file before starting the server.\n"
  );
  process.exit(1);
}

export const config = {
  jwtSecret,
  jwtExpiresIn: process.env["JWT_EXPIRES_IN"] ?? "7d",
  bcryptRounds: parseInt(process.env["BCRYPT_ROUNDS"] ?? "12", 10),
  port: parseInt(process.env["PORT"] ?? "3000", 10),
  rateLimitAuthMax: parseInt(process.env["RATE_LIMIT_AUTH_MAX"] ?? "20", 10),
  rateLimitAuthWindowMs: parseInt(
    process.env["RATE_LIMIT_AUTH_WINDOW_MS"] ?? "900000",
    10
  ),
  nodeEnv: process.env["NODE_ENV"] ?? "development",
} as const;

export type Config = typeof config;
