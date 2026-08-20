import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import { PROJECT_PROGRESS_CONTRACT_PROMPT_V3 } from "./progress-contract-draft-artifacts.js";
import { ProgressContractDraftService } from "./progress-contract-draft-service.js";

const now = new Date("2026-07-19T12:00:00.000Z");
const ownerId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const documentId = crypto.randomUUID();
const documentVersionId = crypto.randomUUID();
const promptArtifactId = crypto.randomUUID();
const sourceChecksum = "a".repeat(64);
const sourceReference = `document-source:${crypto.randomUUID()}`;
const actor = { userId: ownerId, active: true } as const;
const aiContent = {
  components: [
    {
      clientKey: "release",
      kind: "milestone" as const,
      name: "Accepted release",
      description: "The reviewed release is accepted.",
      weight: 100,
      baseline: null,
      target: null,
      unit: null,
      direction: null,
      acceptanceConditions: ["Product owner accepts the release"],
      requiredEvidence: ["Acceptance record"],
      confirmationMode: "human_confirmed" as const,
      proposedSourceMappings: [],
      sourceReferences: [sourceReference],
    },
  ],
  ambiguities: [],
  clarificationQuestions: [],
};

function harness() {
  let request: any;
  const revisions: any[] = [];
  const appliedComponentMappings: any[] = [];
  const aiRuns: any[] = [];
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    progressContractAiDraftRequest: {
      findUnique: vi.fn(async () => request ?? null),
      create: vi.fn(async ({ data }: any) => {
        request = {
          ...data,
          createdAt: now,
          documentVersion: { version: 2 },
          appliedContractId: null,
          aiRunTraceId: null,
          failureCode: null,
        };
        return request;
      }),
      update: vi.fn(async ({ data }: any) => {
        request = { ...request, ...data };
        return request;
      }),
    },
    progressContractAiDraftRevision: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: data.id ?? crypto.randomUUID(), createdAt: now, ...data };
        revisions.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) =>
        revisions.find(
          (item) =>
            item.requestId === where.requestId_revision.requestId &&
            item.revision === where.requestId_revision.revision,
        ),
      ),
      findFirst: vi.fn(async () => revisions.at(-1) ?? null),
      count: vi.fn(async () => revisions.length),
    },
    progressContractAiDraftAppliedComponent: {
      createMany: vi.fn(async ({ data }: any) => {
        appliedComponentMappings.push(...data);
        return { count: data.length };
      }),
      findMany: vi.fn(async () => [...appliedComponentMappings]),
    },
    aiRun: {
      findFirst: vi.fn(
        async ({ where }: any) =>
          aiRuns.find(
            (run) =>
              run.outputReference === where.outputReference &&
              run.routeKey === where.routeKey &&
              run.state === where.state,
          ) ?? null,
      ),
    },
  };
  const updateRequestAfterRun = vi.fn(async (input: any) =>
    transaction.progressContractAiDraftRequest.update(input),
  );
  const database = {
    analysisPromptArtifact: {
      findUnique: vi.fn(async () => ({
        id: promptArtifactId,
        bodyHash: createHash("sha256").update(PROJECT_PROGRESS_CONTRACT_PROMPT_V3).digest("hex"),
        trustedBody: PROJECT_PROGRESS_CONTRACT_PROMPT_V3,
      })),
    },
    progressContractAiDraftRequest: {
      findUnique: vi.fn(async () => request ?? null),
      create: vi.fn(async ({ data }: any) => {
        request = {
          ...data,
          createdAt: now,
          documentVersion: { version: 2 },
          appliedContractId: null,
          aiRunTraceId: null,
          failureCode: null,
        };
        return request;
      }),
      update: updateRequestAfterRun,
    },
    progressContractAiDraftRevision: transaction.progressContractAiDraftRevision,
    progressContract: {
      findFirst: vi.fn(async () => null),
    },
    $transaction: vi.fn(async (operation: (tx: any) => Promise<unknown>) => operation(transaction)),
  };
  const sourceReader = {
    loadApprovedVersion: vi.fn(async () => ({
      projectId,
      departmentScopeId: crypto.randomUUID(),
      documentId,
      documentVersionId,
      documentVersion: 2,
      sourceChecksum,
      sourceReferences: [sourceReference],
      quotedSections: [
        {
          reference: sourceReference,
          mediaType: "text/markdown",
          text: "Approved release scope",
          trust: "untrusted" as const,
        },
      ],
    })),
  };
  const identityReader = {
    snapshotIn: vi.fn(async () => ({
      kind: "project",
      resourceId: projectId,
      projectId,
      organizationId: crypto.randomUUID(),
      departmentId: crypto.randomUUID(),
      primaryOwnerId: ownerId,
      contributorIds: [],
    })),
  };
  const aiRouter = {
    run: vi.fn(async (_input: any, persist: any): Promise<any> => {
      const persisted = await persist(transaction, aiContent);
      const runId = crypto.randomUUID();
      aiRuns.push({
        id: runId,
        outputReference: persisted.outputReference,
        routeKey: "project.progress-contract.draft",
        state: "succeeded",
      });
      return {
        runId,
        output: aiContent,
        outputReference: persisted.outputReference,
        requiresHumanApproval: true,
      };
    }),
  };
  const progressContractService = {
    propose: vi.fn(async ({ draft }: any) => ({
      id: crypto.randomUUID(),
      state: "draft",
      contractVersion: 1,
      ...draft,
    })),
  };
  const audit = { append: vi.fn(async () => ({ id: crypto.randomUUID() })) };
  const service = new ProgressContractDraftService(
    database as never,
    audit as never,
    sourceReader as never,
    identityReader as never,
    aiRouter as never,
    progressContractService as never,
    { systemId: crypto.randomUUID(), timeoutMs: 10_000, now: () => now },
  );
  const requestInput = {
    actor,
    correlationId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    projectId,
    documentVersionId,
    sourceChecksum,
    locale: "en",
    timezone: "Asia/Riyadh",
    effectiveAt: "2026-07-20T00:00:00.000Z",
    reason: "Draft measurable rules from the approved Project document.",
  };
  return {
    aiRouter,
    aiRuns,
    appliedComponentMappings,
    audit,
    database,
    identityReader,
    progressContractService,
    requestInput,
    revisions,
    service,
    sourceReader,
    updateRequestAfterRun,
    get request() {
      return request;
    },
  };
}

describe("ProgressContractDraftService", () => {
  it("persists the request before invoking AI and preserves AI then human revisions", async () => {
    const context = harness();
    context.aiRouter.run.mockImplementationOnce(async (_input: any, persist: any) => {
      expect(context.request).toMatchObject({ state: "pending" });
      const persisted = await persist(
        (context.database.$transaction as any).mock.calls.length >= 0
          ? {
              $queryRaw: vi.fn(async () => []),
              progressContractAiDraftRequest: {
                findUnique: vi.fn(async () => context.request),
                update: vi.fn(async ({ data }: any) => Object.assign(context.request, data)),
              },
              progressContractAiDraftRevision: {
                findFirst: vi.fn(async () => context.revisions.at(-1) ?? null),
                create: vi.fn(async ({ data }: any) => {
                  const row = { id: data.id, createdAt: now, ...data };
                  context.revisions.push(row);
                  return row;
                }),
              },
            }
          : null,
        aiContent,
      );
      return {
        runId: crypto.randomUUID(),
        output: aiContent,
        outputReference: persisted.outputReference,
        requiresHumanApproval: true,
      };
    });

    const ready = await context.service.requestDraft(context.requestInput);
    const edited = await context.service.reviseDraft({
      actor,
      correlationId: crypto.randomUUID(),
      requestId: ready.requestId,
      expectedRevision: 1,
      content: {
        ...aiContent,
        components: [
          {
            ...aiContent.components[0],
            description: "The reviewed release passes the accepted quality gate.",
          },
        ],
      },
      reason: "Clarified the accepted quality gate",
    });

    expect(ready).toMatchObject({ state: "ready", revision: 1 });
    expect(edited).toMatchObject({ state: "ready", revision: 2, origin: "human" });
    expect(context.revisions.map(({ origin }) => origin)).toEqual(["ai", "human"]);
    const governedInput = context.aiRouter.run.mock.calls[0]?.[0].input;
    expect(governedInput.trustedInstruction).toMatchObject({
      routeKey: "project.progress-contract.draft",
      artifactId: promptArtifactId,
      version: "project-progress-contract-draft.v3",
    });
    expect(governedInput.trustedInstruction).not.toEqual(expect.any(String));
    expect(JSON.parse(governedInput.untrustedContent)).toMatchObject({
      allowedSourceReferences: [sourceReference],
      requestedContext: {
        locale: "en",
        timezone: "Asia/Riyadh",
        effectiveAt: "2026-07-20T00:00:00.000Z",
      },
    });
  });

  it("returns the same result for the same idempotent request and rejects a changed payload", async () => {
    const context = harness();
    const first = await context.service.requestDraft(context.requestInput);
    const duplicate = await context.service.requestDraft(context.requestInput);
    expect(duplicate).toEqual(first);
    expect(context.aiRouter.run).toHaveBeenCalledOnce();

    await expect(
      context.service.requestDraft({
        ...context.requestInput,
        locale: "ar",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("bounds a large approved source before the provider call without losing its source reference", async () => {
    const context = harness();
    const source = await context.sourceReader.loadApprovedVersion();
    context.sourceReader.loadApprovedVersion.mockResolvedValueOnce({
      ...source,
      quotedSections: [
        {
          reference: sourceReference,
          mediaType: "text/markdown",
          text: "approved-source-line\n".repeat(15_000),
          trust: "untrusted" as const,
        },
      ],
    });

    await context.service.requestDraft(context.requestInput);

    const governedInput = context.aiRouter.run.mock.calls[0]?.[0].input;
    const quoted = JSON.parse(governedInput.untrustedContent).quotedSections[0];
    expect(quoted.reference).toBe(sourceReference);
    expect(quoted.text.length).toBeLessThanOrEqual(80_000);
    expect(quoted.text).toContain("[bounded omission:");
  });

  it("authorizes and audits a direct human-review read", async () => {
    const context = harness();
    const ready = await context.service.requestDraft(context.requestInput);
    context.audit.append.mockClear();

    const read = await context.service.getDraft({
      actor,
      correlationId: crypto.randomUUID(),
      projectId,
      requestId: ready.requestId,
    });

    expect(read).toMatchObject({
      requestId: ready.requestId,
      state: "ready",
      revision: 1,
      sourceDocumentVersion: 2,
    });
    expect(context.audit.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "progress_contract_ai_draft.viewed",
        scopeId: projectId,
        targetId: ready.requestId,
      }),
    );
  });

  it("does not return duplicate private draft content after Project ownership ends", async () => {
    const context = harness();
    await context.service.requestDraft(context.requestInput);
    context.sourceReader.loadApprovedVersion.mockClear();
    context.identityReader.snapshotIn.mockResolvedValue({
      ...(await context.identityReader.snapshotIn()),
      primaryOwnerId: crypto.randomUUID(),
    });

    await expect(context.service.requestDraft(context.requestInput)).rejects.toMatchObject({
      code: "PROGRESS_CONTRACT_AI_DRAFT_FORBIDDEN",
    });
    expect(context.sourceReader.loadApprovedVersion).not.toHaveBeenCalled();
  });

  it("persists a safe failure code without displaying or storing invalid provider output", async () => {
    const context = harness();
    context.aiRouter.run.mockImplementationOnce(async (_input: any, persist: any) => {
      await persist(
        {
          $queryRaw: vi.fn(async () => []),
          progressContractAiDraftRequest: {
            findUnique: vi.fn(async () => context.request),
            update: vi.fn(async ({ data }: any) => Object.assign(context.request, data)),
          },
          progressContractAiDraftRevision: {
            findFirst: vi.fn(async () => context.revisions.at(-1) ?? null),
            create: vi.fn(async ({ data }: any) => {
              context.revisions.push(data);
              return data;
            }),
          },
        },
        { ...aiContent, components: [{ ...aiContent.components[0], clientKey: "" }] },
      );
      throw new Error("unreachable");
    });

    await expect(context.service.requestDraft(context.requestInput)).rejects.toMatchObject({
      code: "PROGRESS_CONTRACT_AI_DRAFT_FAILED",
    });
    expect(context.request).toMatchObject({
      state: "failed",
      failureCode: "invalid_output",
    });
    expect(context.revisions).toEqual([]);
  });

  it("rejects an AI proposal that tries to convert raw activity into Project progress", async () => {
    const context = harness();
    context.aiRouter.run.mockImplementationOnce(async (_input: any, persist: any) => {
      await persist(
        {
          $queryRaw: vi.fn(async () => []),
          progressContractAiDraftRequest: {
            findUnique: vi.fn(async () => context.request),
            update: vi.fn(async ({ data }: any) => Object.assign(context.request, data)),
          },
          progressContractAiDraftRevision: {
            findFirst: vi.fn(async () => context.revisions.at(-1) ?? null),
            create: vi.fn(async ({ data }: any) => {
              context.revisions.push(data);
              return data;
            }),
          },
        },
        {
          ...aiContent,
          components: [
            {
              ...aiContent.components[0],
              name: "Commit count",
              description: "Count commits as progress.",
              unit: "commits",
              baseline: 0,
              target: 20,
              direction: "increase",
            },
          ],
        },
      );
      throw new Error("unreachable");
    });

    await expect(context.service.requestDraft(context.requestInput)).rejects.toMatchObject({
      code: "PROGRESS_CONTRACT_AI_DRAFT_FAILED",
    });
    expect(context.request).toMatchObject({ state: "failed", failureCode: "invalid_output" });
    expect(context.revisions).toEqual([]);
  });

  it("retries the same failed request without creating a second request", async () => {
    const context = harness();
    context.aiRouter.run.mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(context.service.requestDraft(context.requestInput)).rejects.toMatchObject({
      code: "PROGRESS_CONTRACT_AI_DRAFT_FAILED",
    });
    expect(context.request).toMatchObject({ state: "failed" });

    const ready = await context.service.requestDraft(context.requestInput);
    expect(ready).toMatchObject({ state: "ready", revision: 1 });
    expect(context.aiRouter.run).toHaveBeenCalledTimes(2);
    expect(context.revisions).toHaveLength(1);
  });

  it("recovers the immutable AI run trace link after a post-run update failure", async () => {
    const context = harness();
    context.updateRequestAfterRun.mockRejectedValueOnce(new Error("post-run link failed"));

    await expect(context.service.requestDraft(context.requestInput)).rejects.toThrow(
      "post-run link failed",
    );
    expect(context.request).toMatchObject({ state: "ready", aiRunTraceId: null });

    const recovered = await context.service.requestDraft(context.requestInput);
    expect(recovered).toMatchObject({
      state: "ready",
      aiRunTraceId: context.aiRuns[0]?.id,
    });
    expect(context.aiRouter.run).toHaveBeenCalledOnce();
  });

  it("rejects stale and unauthorized human revisions", async () => {
    const context = harness();
    const ready = await context.service.requestDraft(context.requestInput);

    await expect(
      context.service.reviseDraft({
        actor,
        correlationId: crypto.randomUUID(),
        requestId: ready.requestId,
        expectedRevision: 0,
        content: aiContent,
        reason: "Stale edit",
      }),
    ).rejects.toMatchObject({ code: "PROGRESS_CONTRACT_AI_DRAFT_REVISION_CONFLICT" });

    context.identityReader.snapshotIn.mockResolvedValueOnce({
      ...(await context.identityReader.snapshotIn()),
      primaryOwnerId: crypto.randomUUID(),
    });
    await expect(
      context.service.rejectDraft({
        actor,
        correlationId: crypto.randomUUID(),
        requestId: ready.requestId,
        expectedRevision: 1,
        reason: "Unauthorized rejection",
      }),
    ).rejects.toMatchObject({ code: "PROGRESS_CONTRACT_AI_DRAFT_FORBIDDEN" });
  });

  it("applies a selected revision only as an ordinary inactive draft", async () => {
    const context = harness();
    const ready = await context.service.requestDraft(context.requestInput);
    const applied = await context.service.applyRevision({
      actor,
      correlationId: crypto.randomUUID(),
      requestId: ready.requestId,
      expectedRevision: 1,
      selectedRevision: 1,
      calculationKind: "weighted",
      reason: "Create the human-reviewed ordinary contract draft.",
    });

    expect(applied.contractState).toBe("draft");
    expect(context.progressContractService.propose).toHaveBeenCalledOnce();
    expect(
      context.progressContractService.propose.mock.calls[0]?.[0].draft.components[0],
    ).toMatchObject({
      id: expect.any(String),
      kind: "milestone",
      confirmationMode: "human_confirmed",
    });
    expect(context.request).toMatchObject({
      state: "applied",
      appliedContractId: applied.contractId,
    });
    const generatedComponentId =
      context.progressContractService.propose.mock.calls[0]?.[0].draft.components[0].id;
    expect(applied.componentMappings).toEqual([
      { clientKey: "release", componentId: generatedComponentId },
    ]);
    expect(context.audit.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "progress_contract_ai_draft.applied",
        actor: { kind: "human", id: actor.userId },
        reason: "Create the human-reviewed ordinary contract draft.",
        safeDiff: expect.objectContaining({
          sourceDocumentVersion: 2,
          selectedRevision: 1,
          appliedContractVersion: 1,
        }),
      }),
    );
    expect(context.appliedComponentMappings).toEqual([
      expect.objectContaining({
        requestId: ready.requestId,
        selectedRevision: 1,
        clientKey: "release",
        contractId: applied.contractId,
        componentId: generatedComponentId,
      }),
    ]);
    const queried = await context.service.requestDraft(context.requestInput);
    expect(queried).toMatchObject({
      state: "applied",
      appliedContractId: applied.contractId,
      componentMappings: [{ clientKey: "release", componentId: generatedComponentId }],
    });
  });

  it("preserves deterministic confirmation intent without activating its proposed mapping", async () => {
    const context = harness();
    context.aiRouter.run.mockImplementationOnce(async (_input: any, persist: any) => {
      const deterministic = {
        ...aiContent,
        components: [
          {
            ...aiContent.components[0],
            confirmationMode: "deterministic" as const,
            proposedSourceMappings: [
              {
                source: "github" as const,
                event: "pull_request_merged" as const,
                repositoryRef: "owner/repository",
                branchRef: "main",
                checkNames: [],
              },
            ],
          },
        ],
      };
      const persisted = await persist(
        {
          $queryRaw: vi.fn(async () => []),
          progressContractAiDraftRequest: {
            findUnique: vi.fn(async () => context.request),
            update: vi.fn(async ({ data }: any) => Object.assign(context.request, data)),
          },
          progressContractAiDraftRevision: {
            findFirst: vi.fn(async () => context.revisions.at(-1) ?? null),
            create: vi.fn(async ({ data }: any) => {
              const row = { id: data.id, createdAt: now, ...data };
              context.revisions.push(row);
              return row;
            }),
          },
        },
        deterministic,
      );
      return {
        runId: crypto.randomUUID(),
        output: deterministic,
        outputReference: persisted.outputReference,
        requiresHumanApproval: true,
      };
    });
    const ready = await context.service.requestDraft(context.requestInput);

    const result = await context.service.applyRevision({
      actor,
      correlationId: crypto.randomUUID(),
      requestId: ready.requestId,
      expectedRevision: 1,
      selectedRevision: 1,
      calculationKind: "weighted",
      reason: "Preserve deterministic intent for later binding.",
    });

    expect(result.contractState).toBe("draft");
    expect(
      context.progressContractService.propose.mock.calls[0]?.[0].draft.components[0],
    ).toMatchObject({
      confirmationMode: "deterministic",
    });
  });
});
