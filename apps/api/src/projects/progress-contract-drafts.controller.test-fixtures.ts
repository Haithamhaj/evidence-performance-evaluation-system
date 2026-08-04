import { vi } from "vitest";

import { ProgressContractDraftsController } from "./progress-contract-drafts.controller.js";

export const projectId = "11111111-1111-4111-8111-111111111111";
export const requestId = "22222222-2222-4222-8222-222222222222";
export const documentVersionId = "33333333-3333-4333-8333-333333333333";
export const contractId = "44444444-4444-4444-8444-444444444444";
export const actorId = "55555555-5555-4555-8555-555555555555";
export const sourceReference = "document-source:66666666-6666-4666-8666-666666666666";

export const request = {
  principal: {
    userId: actorId,
    oidcSubject: "product-owner",
    email: "owner@example.invalid",
    roles: ["employee"],
    active: true,
  },
  correlationId: "77777777-7777-4777-8777-777777777777",
} as const;

export const content = {
  components: [
    {
      clientKey: "quality-gate",
      kind: "operational_kpi" as const,
      name: "Required quality gate",
      description: "All approved scenarios pass.",
      weight: 100,
      baseline: 0,
      target: 12,
      unit: "scenarios",
      direction: "increase" as const,
      acceptanceConditions: ["Product Owner accepts the result"],
      requiredEvidence: ["Acceptance record"],
      confirmationMode: "human_confirmed" as const,
      proposedSourceMappings: [],
      sourceReferences: [sourceReference],
    },
  ],
  ambiguities: ["The document does not define the retry threshold."],
  clarificationQuestions: ["Which retry threshold is approved?"],
};

export const readyReceipt = {
  requestId,
  state: "ready" as const,
  revision: 1,
  origin: "ai" as const,
  content,
  sourceDocumentVersion: 3,
  failureCode: null,
  aiRunTraceId: "88888888-8888-4888-8888-888888888888",
  appliedContractId: null,
  appliedContract: null,
  componentMappings: [],
};

type ServiceMock = Readonly<{
  requestDraft: ReturnType<typeof vi.fn>;
  findLatestReviewable: ReturnType<typeof vi.fn>;
  getDraft: ReturnType<typeof vi.fn>;
  reviseDraft: ReturnType<typeof vi.fn>;
  rejectDraft: ReturnType<typeof vi.fn>;
  applyRevision: ReturnType<typeof vi.fn>;
}>;

export const service: ServiceMock = {
  requestDraft: vi.fn().mockResolvedValue(readyReceipt),
  findLatestReviewable: vi.fn().mockResolvedValue(readyReceipt),
  getDraft: vi.fn().mockResolvedValue(readyReceipt),
  reviseDraft: vi
    .fn()
    .mockResolvedValue({ ...readyReceipt, revision: 2, origin: "human" as const }),
  rejectDraft: vi.fn().mockResolvedValue({ ...readyReceipt, state: "rejected" as const }),
  applyRevision: vi.fn().mockResolvedValue({
    requestId,
    selectedRevision: 1,
    contractId,
    contractState: "draft" as const,
    componentMappings: [
      {
        clientKey: "quality-gate",
        componentId: "99999999-9999-4999-8999-999999999999",
      },
    ],
  }),
};

export const controller = new ProgressContractDraftsController(service as never);
