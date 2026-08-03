import {
  decideProjectLink,
  ProjectAnchorReader,
  ProjectSemanticContextReader,
} from "@evaluation/context-intelligence";
import { describe, expect, it, vi } from "vitest";

import {
  ContextIntelligenceApplicationService,
  ContextIntelligenceProjectAnchorAdapter,
} from "./context-intelligence.module.js";

describe("Context Intelligence production anchor composition", () => {
  it("feeds governed candidates and approved semantics into the application analysis path", async () => {
    const employeeId = crypto.randomUUID();
    const sourceItemId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const departmentId = crypto.randomUUID();
    const semanticContext = {
      projectId,
      documentId: crypto.randomUUID(),
      documentVersionId: crypto.randomUUID(),
      documentVersion: 1,
      sourceReferences: [`document-source:${crypto.randomUUID()}`],
      purpose: ["Deliver a trustworthy daily workspace"],
      outcomes: [],
      milestones: [],
      deliverables: [],
      terminology: ["Atlas Delivery"],
      stakeholders: [],
      operationalKpis: [],
      acceptanceConditions: [],
      evidenceRequirements: [],
    };
    const semanticReader = new ProjectSemanticContextReader({
      readApprovedProjectSemanticContext: async () => semanticContext,
    });
    const analyze = vi.fn(async (input: unknown) => input);
    const context = {
      get: async () => ({
        id: sourceItemId,
        employeeId,
        provider: "GOOGLE_CALENDAR" as const,
        providerSourceId: "event",
        occurredAt: "2026-08-02T12:00:00.000Z",
        title: "Atlas release review",
        summary: null,
        sourceUrl: null,
        privacy: "PRIVATE" as const,
        excluded: false,
      }),
      review: async () => ({ items: [{ id: sourceItemId, excluded: false, projectId: null }] }),
    };
    const service = new ContextIntelligenceApplicationService(
      {} as never,
      context as never,
      {} as never,
      {
        seal: async (value: string) => ({ ciphertext: value, keyVersion: "test-key-v1" }),
        open: async ({ ciphertext }: { ciphertext: string }) => ciphertext,
      },
      { router: { run: async () => undefined } as never, systemId: crypto.randomUUID() },
      semanticReader,
    );
    const candidates = [
      {
        projectId,
        accessible: true,
        anchors: [
          {
            anchor: {
              kind: "EXPLICIT_USER_MAPPING" as const,
              reference: `source-project-link:${crypto.randomUUID()}`,
              conflicts: false,
            },
            current: true,
          },
        ],
      },
    ];
    Object.assign(service as never, {
      analyses: { analyze },
      projectService: {
        listProjects: async () => [{ id: projectId, departmentId, name: "Atlas Delivery" }],
      },
      projectAnchors: { read: async () => candidates },
    });

    await service.analyze({
      actor: { userId: employeeId, active: true },
      sourceItemId,
      correlationId: crypto.randomUUID(),
    });

    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        departmentId,
        candidates,
        semanticContexts: [semanticContext],
      }),
    );
  });

  it("turns two independent governed signals on an unlinked source into an explainable auto-link", async () => {
    const employeeId = crypto.randomUUID();
    const sourceItemId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const source = {
      id: sourceItemId,
      employeeId,
      provider: "GOOGLE_CALENDAR" as const,
      providerSourceId: "calendar-event",
      occurredAt: "2026-08-02T12:00:00.000Z",
      title: "Atlas Delivery release runbook review",
      summary: "Review the approved release runbook with the Product Owner.",
      sourceUrl: null,
      privacy: "PRIVATE" as const,
      excluded: false,
    };
    const projects = {
      listProjects: async () => [
        { id: projectId, name: "Atlas Delivery", departmentId: crypto.randomUUID() },
      ],
      getProject: async () => ({ id: projectId }),
    };
    const semantics = {
      read: async () => ({
        projectId,
        documentId: crypto.randomUUID(),
        documentVersionId: crypto.randomUUID(),
        documentVersion: 1,
        sourceReferences: [`document-source:${crypto.randomUUID()}`],
        purpose: [],
        outcomes: [],
        milestones: [],
        deliverables: ["release runbook"],
        terminology: ["Atlas Delivery"],
        stakeholders: ["Product Owner"],
        operationalKpis: [],
        acceptanceConditions: [],
        evidenceRequirements: [],
      }),
    };
    const adapter = new ContextIntelligenceProjectAnchorAdapter(
      {
        get: async () => source,
        readProjectAnchorFacts: async () => ({ links: [], corrections: [] }),
      } as never,
      projects as never,
      semantics as never,
    );
    const reader = new ProjectAnchorReader(adapter, {
      canAccessProject: async () => true,
    });

    const decision = decideProjectLink(
      await reader.read({ employeeId, sourceItemId, at: new Date("2026-08-02T12:01:00.000Z") }),
    );

    expect(decision).toMatchObject({
      kind: "AUTO_LINK",
      projectId,
      anchors: expect.arrayContaining([
        expect.objectContaining({ kind: "EXPLICIT_PROJECT_REFERENCE", conflicts: false }),
        expect.objectContaining({ kind: "CALENDAR_CONTEXT", conflicts: false }),
      ]),
    });
  });

  it("keeps a single approved term match in employee review", async () => {
    const employeeId = crypto.randomUUID();
    const sourceItemId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const adapter = new ContextIntelligenceProjectAnchorAdapter(
      {
        get: async () => ({
          id: sourceItemId,
          employeeId,
          provider: "GOOGLE_GMAIL",
          occurredAt: "2026-08-02T12:00:00.000Z",
          title: "Atlas Delivery",
          summary: null,
        }),
        readProjectAnchorFacts: async () => ({ links: [], corrections: [] }),
      } as never,
      {
        listProjects: async () => [
          { id: projectId, name: "Atlas Delivery", departmentId: crypto.randomUUID() },
        ],
      } as never,
      { read: async () => null } as never,
    );
    const reader = new ProjectAnchorReader(adapter, {
      canAccessProject: async () => true,
    });

    await expect(
      reader.read({ employeeId, sourceItemId, at: new Date("2026-08-02T12:01:00.000Z") }),
    ).resolves.toHaveLength(1);
    expect(
      decideProjectLink(
        await reader.read({
          employeeId,
          sourceItemId,
          at: new Date("2026-08-02T12:01:00.000Z"),
        }),
      ),
    ).toMatchObject({ kind: "REVIEW", reasons: ["INSUFFICIENT_INDEPENDENT_ANCHORS"] });
  });

  it("does not auto-link when a stakeholder address appears only in untrusted Gmail text", async () => {
    const employeeId = crypto.randomUUID();
    const sourceItemId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const adapter = new ContextIntelligenceProjectAnchorAdapter(
      {
        get: async () => ({
          id: sourceItemId,
          employeeId,
          provider: "GOOGLE_GMAIL",
          occurredAt: "2026-08-02T12:00:00.000Z",
          title: "Atlas Delivery — mention finance@example.com",
          summary:
            "The message body repeats finance@example.com without authenticated sender data.",
        }),
        readProjectAnchorFacts: async () => ({ links: [], corrections: [] }),
      } as never,
      {
        listProjects: async () => [
          { id: projectId, name: "Atlas Delivery", departmentId: crypto.randomUUID() },
        ],
      } as never,
      {
        read: async () => ({
          projectId,
          documentId: crypto.randomUUID(),
          documentVersionId: crypto.randomUUID(),
          documentVersion: 1,
          sourceReferences: [`document-source:${crypto.randomUUID()}`],
          purpose: [],
          outcomes: [],
          milestones: [],
          deliverables: [],
          terminology: [],
          stakeholders: ["finance@example.com"],
          operationalKpis: [],
          acceptanceConditions: [],
          evidenceRequirements: [],
        }),
      } as never,
    );
    const reader = new ProjectAnchorReader(adapter, {
      canAccessProject: async () => true,
    });

    const candidates = await reader.read({
      employeeId,
      sourceItemId,
      at: new Date("2026-08-02T12:01:00.000Z"),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.anchors.map(({ anchor }) => anchor.kind)).toEqual([
      "EXPLICIT_PROJECT_REFERENCE",
    ]);
    expect(decideProjectLink(candidates)).toMatchObject({
      kind: "REVIEW",
      reasons: ["INSUFFICIENT_INDEPENDENT_ANCHORS"],
    });
  });
});
