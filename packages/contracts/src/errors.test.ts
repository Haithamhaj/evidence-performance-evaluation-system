import { describe, expect, it } from "vitest";

import { AppError, ErrorEnvelopeSchema } from "./errors.js";

const correlationId = "9a11bb8f-79f5-4a72-a98f-2e763e97699b";

describe("public error envelope", () => {
  it("accepts only the documented public fields", () => {
    expect(
      ErrorEnvelopeSchema.parse({
        code: "VALIDATION_FAILED",
        messageKey: "errors.validationFailed",
        correlationId,
        details: [{ field: "name", messageKey: "validation.required" }],
      }),
    ).toEqual({
      code: "VALIDATION_FAILED",
      messageKey: "errors.validationFailed",
      correlationId,
      details: [{ field: "name", messageKey: "validation.required" }],
    });
  });

  it.each([
    ["stack", "Error: internal"],
    ["sql", "select * from users"],
    ["token", "secret-token"],
    ["arbitrary", "not-public"],
  ])("rejects the unknown %s property", (field, value) => {
    expect(() =>
      ErrorEnvelopeSchema.parse({
        code: "INTERNAL_ERROR",
        messageKey: "errors.internal",
        correlationId,
        [field]: value,
      }),
    ).toThrow();
  });

  it("rejects arbitrary properties inside a detail", () => {
    expect(() =>
      ErrorEnvelopeSchema.parse({
        code: "VALIDATION_FAILED",
        messageKey: "errors.validationFailed",
        correlationId,
        details: [{ field: "name", messageKey: "validation.required", value: "private" }],
      }),
    ).toThrow();
  });

  it("carries only safe application error metadata", () => {
    const error = new AppError("NOT_FOUND", "errors.notFound", 404);

    expect(error).toMatchObject({
      name: "AppError",
      message: "NOT_FOUND",
      code: "NOT_FOUND",
      messageKey: "errors.notFound",
      status: 404,
    });
  });
});
