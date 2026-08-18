import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import {
  parseApiFieldErrors,
  validateWithSchema,
  zodIssuesToFieldErrors,
  fieldRules,
} from "@/lib/formValidation";

describe("formValidation", () => {
  it("maps zod issues to field errors", () => {
    const schema = z.object({
      name: fieldRules.requiredString("Name"),
    });
    const result = schema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodIssuesToFieldErrors(result.error)).toEqual({ name: "Name is required." });
    }
  });

  it("returns null when schema passes", () => {
    const schema = z.object({ name: fieldRules.requiredString("Name") });
    expect(validateWithSchema(schema, { name: "Acme" })).toBeNull();
  });

  it("parses API field errors from path:message strings", () => {
    const error = new ApiError("Validation failed", 422, ["email: Invalid email", "name: Required"]);
    const parsed = parseApiFieldErrors(error);
    expect(parsed.hasFieldErrors).toBe(true);
    expect(parsed.fieldErrors.email).toBe("Enter a valid email address.");
    expect(parsed.fieldErrors.name).toBe("This field is required.");
  });

  it("returns global message when no field errors", () => {
    const error = new ApiError("Conflict", 409);
    const parsed = parseApiFieldErrors(error);
    expect(parsed.hasFieldErrors).toBe(false);
    expect(parsed.globalMessage).toContain("Conflict");
  });
});
