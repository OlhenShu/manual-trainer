import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Response } from "express";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, config.bcryptRounds);
}

export async function comparePassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

export function signToken(payload: { sub: string }): string {
  return jwt.sign({ sub: payload.sub }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): { sub: string } {
  // jwt.verify throws JsonWebTokenError / TokenExpiredError on failure.
  const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
  if (typeof decoded.sub !== "string") {
    throw new jwt.JsonWebTokenError("Token is missing sub claim");
  }
  return { sub: decoded.sub };
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JWT expiry string (e.g. '7d', '24h', '30m', '60s') into milliseconds.
 * Falls back to 7 days if the format is unrecognised.
 */
function parseExpiresInMs(expiresIn: string): number {
  const match = /^(\d+)([dhms])$/.exec(expiresIn);
  if (!match) {
    // Default: 7 days
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

const COOKIE_NAME = "token";

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.nodeEnv === "production",
    maxAge: parseExpiresInMs(config.jwtExpiresIn),
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.nodeEnv === "production",
    path: "/",
  });
}
