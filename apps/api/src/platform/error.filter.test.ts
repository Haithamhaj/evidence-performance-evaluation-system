import type { ArgumentsHost } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AppError, ErrorEnvelopeSchema } from "@evaluation/contracts";

import { AppErrorFilter } from "./error.filter.js";

const correlationId = "9a11bb8f-79f5-4a72-a98f-2e763e97699b";

function createHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ correlationId }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, json, status };
}

describe("AppErrorFilter", () => {
  it("returns the strict safe envelope for an expected error", () => {
    const { host, json, status } = createHost();

    new AppErrorFilter().catch(
      new AppError("NOT_FOUND", "errors.notFound", 404, [
        { field: "project", messageKey: "validation.notFound" },
      ]),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    const envelope = json.mock.calls[0]?.[0];
    expect(ErrorEnvelopeSchema.parse(envelope)).toEqual({
      code: "NOT_FOUND",
      messageKey: "errors.notFound",
      correlationId,
      details: [{ field: "project", messageKey: "validation.notFound" }],
    });
  });

  it("does not expose stack traces, SQL, or tokens for unknown errors", () => {
    const { host, json, status } = createHost();
    const error = new Error("select token from private_table");

    new AppErrorFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      code: "INTERNAL_ERROR",
      messageKey: "errors.internal",
      correlationId,
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain(error.message);
    expect(JSON.stringify(json.mock.calls)).not.toContain(error.stack);
  });

  it("falls back safely when an application error violates the runtime envelope", () => {
    const { host, json, status } = createHost();
    const unsafeDetails = [
      { field: "project", messageKey: "validation.invalid", token: "private-token" },
    ] as never;

    new AppErrorFilter().catch(
      new AppError("invalid-code", "errors.invalid", 400, unsafeDetails),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      code: "INTERNAL_ERROR",
      messageKey: "errors.internal",
      correlationId,
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain("private-token");
  });
});
