import { ERROR_CODE, VALIDATION_KEY } from "@manual-trainer/shared";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import errors from "./uk/errors.json";

const resource = errors as Record<string, string>;

describe("uk errors resource", () => {
  it("Feature: foundation-auth, Property 16: every ERROR_CODE and VALIDATION_KEY has a non-empty Ukrainian entry", () => {
    const keys = [...Object.values(ERROR_CODE), ...Object.values(VALIDATION_KEY)];
    fc.assert(
      fc.property(fc.constantFrom(...keys), (key) => {
        const value = resource[key];
        expect(typeof value).toBe("string");
        expect(value?.trim().length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
