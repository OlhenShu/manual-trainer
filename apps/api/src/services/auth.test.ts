/**
 * Unit tests for apps/api/src/services/auth.ts
 *
 * Validates: Requirements 3.1, 4.1
 *
 * BCRYPT_ROUNDS is set to "4" via process.env before importing the module
 * so that password hashing completes quickly in tests.
 */

import { describe, it, expect, beforeAll } from "vitest";
import jwt from "jsonwebtoken";

// Override BCRYPT_ROUNDS and JWT_SECRET before the config module is imported.
// Because the config module reads process.env at import time, we must set
// the env variables before the first dynamic import.
process.env["BCRYPT_ROUNDS"] = "4";
process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
process.env["JWT_EXPIRES_IN"] = "1h";

// Import after env is set.
const { hashPassword, comparePassword, signToken, verifyToken } = await import(
  "./auth.js"
);

// ---------------------------------------------------------------------------
// hashPassword + comparePassword
// ---------------------------------------------------------------------------

describe("hashPassword / comparePassword", () => {
  it("correct password round-trip returns true", async () => {
    const hash = await hashPassword("correct-password");
    const result = await comparePassword("correct-password", hash);
    expect(result).toBe(true);
  });

  it("wrong password returns false", async () => {
    const hash = await hashPassword("correct-password");
    const result = await comparePassword("wrong-password", hash);
    expect(result).toBe(false);
  });

  it("hash is not the plaintext", async () => {
    const hash = await hashPassword("some-password");
    expect(hash).not.toBe("some-password");
  });

  it("same password produces a different hash each time (bcrypt salting)", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// signToken + verifyToken
// ---------------------------------------------------------------------------

describe("signToken / verifyToken", () => {
  it("round-trip returns the original sub value", () => {
    const sub = "550e8400-e29b-41d4-a716-446655440000";
    const token = signToken({ sub });
    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(sub);
  });

  it("decoded payload contains only sub (no role or other claims)", () => {
    const sub = "user-id-123";
    const token = signToken({ sub });
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded["sub"]).toBe(sub);
    expect(decoded["role"]).toBeUndefined();
  });

  it("tampered token throws", () => {
    const sub = "user-id-tampered";
    const token = signToken({ sub });
    // Flip one character in the signature (last segment of the JWT)
    const parts = token.split(".");
    const sig = parts[2]!;
    const tamperedSig =
      sig[0] === "a"
        ? "b" + sig.slice(1)
        : "a" + sig.slice(1);
    const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;
    expect(() => verifyToken(tampered)).toThrow();
  });

  it("malformed / non-JWT string throws", () => {
    expect(() => verifyToken("not.a.jwt")).toThrow();
    expect(() => verifyToken("completelyinvalid")).toThrow();
    expect(() => verifyToken("")).toThrow();
  });

  it("expired token throws", async () => {
    // Sign with a very short expiry using the same secret the config uses.
    const secret = process.env["JWT_SECRET"]!;
    const expiredToken = jwt.sign({ sub: "user-expired" }, secret, {
      expiresIn: "1ms",
    });

    // Wait for the token to expire.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(() => verifyToken(expiredToken)).toThrow();
  });
});
