import { PROJECT_PROTECTED_SECTION_KEYS } from "@evaluation/contracts";
import { TemplateService } from "@evaluation/documents";
import { describe, expect, it, vi } from "vitest";

import { DocumentTemplatePolicyGuard } from "./document-template-policy.guard.js";
import { DocumentTemplatesController } from "./document-templates.controller.js";
import { DocumentsAuthenticationGuard } from "./documents-authentication.guard.js";

const request = {
  principal: {
    userId: "00000000-0000-4000-8000-000000000001",
    oidcSubject: "manager",
    email: "manager@example.invalid",
    roles: ["manager"],
    active: true,
  },
  correlationId: "00000000-0000-4000-8000-000000000002",
} as const;

function templateInput() {
  return {
    expectedVersion: 0,
    scopeType: "organization",
    organizationId: "00000000-0000-4000-8000-000000000003",
    kind: "project",
    sections: PROJECT_PROTECTED_SECTION_KEYS.map((key, index) => ({
      key,
      position: index + 1,
      display: { en: { title: key } },
      required: true,
      protected: true,
    })),
    reason: "Initial template",
  } as const;
}

describe("DocumentTemplatesController", () => {
  it("binds principal and correlation ID to strict template input", async () => {
    const service = { createVersion: vi.fn(async (value: unknown) => value), activate: vi.fn() };
    const controller = new DocumentTemplatesController(service as never);
    await controller.createVersion(request, templateInput());
    expect(service.createVersion).toHaveBeenCalledWith({
      actor: { userId: request.principal.userId, active: true },
      correlationId: request.correlationId,
      input: templateInput(),
    });
    expect(() =>
      controller.createVersion(request, { ...templateInput(), unknown: true }),
    ).toThrowError(expect.objectContaining({ code: "DOCUMENT_INPUT_INVALID" }));
  });

  it("declares authentication and policy guards on the REST surface", () => {
    expect(Reflect.getMetadata("path", DocumentTemplatesController)).toBe(
      "api/v1/document-templates",
    );
    expect(Reflect.getMetadata("__guards__", DocumentTemplatesController)).toEqual(
      expect.arrayContaining([DocumentsAuthenticationGuard, DocumentTemplatePolicyGuard]),
    );
    expect(Reflect.getMetadata("self:paramtypes", DocumentTemplatesController)).toContainEqual({
      index: 0,
      param: TemplateService,
    });
  });

  it("rejects malformed activation identifiers before calling the service", () => {
    const service = { createVersion: vi.fn(), activate: vi.fn() };
    const controller = new DocumentTemplatesController(service as never);
    expect(() =>
      controller.activate(request, "bad", crypto.randomUUID(), {
        expectedVersion: 1,
        reason: "Approved",
      }),
    ).toThrowError(expect.objectContaining({ code: "DOCUMENT_INPUT_INVALID" }));
    expect(service.activate).not.toHaveBeenCalled();
  });
});
