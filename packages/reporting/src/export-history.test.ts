import { describe, expect, it, vi } from "vitest";

import { ExportService } from "./export-service.js";

const requesterId = "11111111-1111-4111-8111-111111111111";

describe("ExportService history", () => {
  it("lists only the requester's safe export history and derives expiry", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "22222222-2222-4222-8222-222222222222",
        requesterId,
        reportType: "EMPLOYEE_EVALUATION",
        audience: "EMPLOYEE_SELF",
        format: "PDF",
        locale: "en",
        state: "READY",
        createdAt: new Date("2026-08-14T08:00:00.000Z"),
        manifest: {
          artifact: {
            id: "33333333-3333-4333-8333-333333333333",
            expiresAt: new Date("2026-08-15T07:00:00.000Z"),
            revocations: [],
            storageKey: "must-not-leak",
          },
        },
      },
    ]);
    const service = new ExportService(
      { exportRequest: { findMany } } as never,
      {} as never,
      {} as never,
      () => new Date("2026-08-15T08:00:00.000Z"),
    );

    await expect(service.listRequests(requesterId)).resolves.toEqual([
      {
        id: "22222222-2222-4222-8222-222222222222",
        reportType: "EMPLOYEE_EVALUATION",
        audience: "EMPLOYEE_SELF",
        format: "PDF",
        locale: "en",
        state: "EXPIRED",
        artifactId: "33333333-3333-4333-8333-333333333333",
        expiresAt: "2026-08-15T07:00:00.000Z",
        createdAt: "2026-08-14T08:00:00.000Z",
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requesterId }, take: 50 }),
    );
  });
});
