import { createHash } from "node:crypto";

import { AppError } from "@evaluation/contracts";
import { OpaqueReferenceSchema } from "@evaluation/ai-routing";
import { describe, expect, it, vi } from "vitest";

import {
  PROJECT_ASSISTANT_PROMPT_VERSION,
  PROJECT_ASSISTANT_ROUTE,
  PROJECT_ASSISTANT_TRUSTED_PROMPT,
  ProjectAssistantService,
} from "./project-assistant.service.js";

const employeeId = "94000000-0000-4000-8000-000000000001";
const projectId = "94000000-0000-4000-8000-000000000002";
const correlationId = "94000000-0000-4000-8000-000000000003";

function harness(options: { ai?: boolean; fails?: boolean; answer?: string } = {}) {
  const experience = {
    load: vi.fn(async ({ userId }: { userId: string }) => {
      if (userId !== employeeId)
        throw new AppError("SCOPE_MISMATCH", "errors.authorization.scopeMismatch", 403);
      return projectExperience();
    }),
  };
  const router = {
    run: vi.fn(async (request: { sourceReferences: readonly string[] }, persist: Function) => {
      if (options.fails) throw new AppError("AI_PROVIDER_FAILED", "errors.ai.providerFailed", 502);
      const output = {
        answer:
          options.answer ??
          "The latest confirmed change is the Capture-to-Evidence bridge in commit 6a58834.",
      };
      const stored = await persist({}, output);
      return { runId: correlationId, output, outputReference: stored.outputReference };
    }),
  };
  return {
    router,
    service: new ProjectAssistantService({
      experience: experience as never,
      router: router as never,
      promptArtifacts: {
        read: async () => ({
          id: "94000000-0000-4000-8000-000000000004",
          routeKey: PROJECT_ASSISTANT_ROUTE,
          version: PROJECT_ASSISTANT_PROMPT_VERSION,
          bodyHash: createHash("sha256").update(PROJECT_ASSISTANT_TRUSTED_PROMPT).digest("hex"),
          trustedBody: PROJECT_ASSISTANT_TRUSTED_PROMPT,
        }),
      },
      systemId: "94000000-0000-4000-8000-000000000005",
      aiEnabled: options.ai ?? true,
    } as never),
  };
}

describe("ProjectAssistantService", () => {
  it("answers what changed from the authorized Project experience through the AI Router", async () => {
    const { service, router } = harness();

    const result = await service.ask({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: { projectId, locale: "en", question: "what_changed" },
    });

    expect(result).toMatchObject({
      schemaVersion: "project-assistant-output.v1",
      assistance: "ai_assisted",
      createsCommand: false,
    });
    expect(result.sourceReferences).toContain(`project:${projectId}`);
    expect(result.sourceReferences).toHaveLength(4);
    expect(
      result.sourceReferences.every(
        (reference) => OpaqueReferenceSchema.safeParse(reference).success,
      ),
    ).toBe(true);
    expect(router.run).toHaveBeenCalledWith(
      expect.objectContaining({
        routeKey: PROJECT_ASSISTANT_ROUTE,
        requiresHumanApproval: false,
        input: expect.objectContaining({
          untrustedContent: expect.objectContaining({
            question: "what_changed",
            project: expect.objectContaining({ name: "Evidence Performance System" }),
          }),
        }),
      }),
      expect.any(Function),
    );
  });

  it("answers blocked and missing-evidence questions with a truthful deterministic fallback", async () => {
    const blocked = await harness({ fails: true }).service.ask({
      actor: { userId: employeeId, active: true, roles: ["contributor"] },
      correlationId,
      input: { projectId, locale: "en", question: "why_blocked" },
    });
    const missing = await harness({ ai: false }).service.ask({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: { projectId, locale: "en", question: "missing_evidence" },
    });

    expect(blocked).toMatchObject({ assistance: "deterministic", createsCommand: false });
    expect(blocked.answer).toContain("staging credential decision");
    expect(missing.answer).toContain("Owner confirmation");
  });

  it("rejects inactive users and quarantines rating or activity-based progress answers", async () => {
    await expect(
      harness().service.ask({
        actor: { userId: employeeId, active: false, roles: ["employee"] },
        correlationId,
        input: { projectId, locale: "en", question: "what_changed" },
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      harness({
        answer: "The employee deserves rating 5 and progress is 90% from commit count.",
      }).service.ask({
        actor: { userId: employeeId, active: true, roles: ["employee"] },
        correlationId,
        input: { projectId, locale: "en", question: "what_changed" },
      }),
    ).resolves.toMatchObject({ assistance: "deterministic", createsCommand: false });
  });

  it("explains Evidence sources and suggests editable draft improvements without creating a command", async () => {
    const source = await harness({ ai: false }).service.ask({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: { projectId, locale: "en", question: "explain_evidence_source" },
    });
    const revision = await harness({ ai: false }).service.ask({
      actor: { userId: employeeId, active: true, roles: ["employee"] },
      correlationId,
      input: { projectId, locale: "ar", question: "revise_evidence_draft" },
    });

    expect(source.answer).toContain("URL");
    expect(source.answer).toContain("unverified");
    expect(revision.answer).toContain("Authentication fallback");
    expect(source.createsCommand).toBe(false);
    expect(revision.createsCommand).toBe(false);
  });
});

function projectExperience() {
  return {
    schemaVersion: "employee-project-experience.v1",
    generatedAt: "2026-08-14T06:00:00.000Z",
    project: {
      id: projectId,
      name: "Evidence Performance System",
      description: "AI-native daily work and evidence-supported evaluation.",
      status: "active",
      ownerName: "Manager",
      workstreams: [],
    },
    document: null,
    progress: { state: "awaiting_contract" },
    milestones: [],
    kpi: null,
    attention: [],
    collections: { work: [], updates: [], evidence: [], documents: [] },
    evidenceWorkspace: {
      confirmed: [],
      pending: [
        {
          id: "94000000-0000-4000-8000-000000000020",
          project: { id: projectId, name: "Evidence Performance System" },
          workItem: null,
          state: "draft",
          revision: 1,
          revisionKind: "employee_edit",
          sourceKind: "url",
          supportedClaim: "Authentication fallback is verified.",
          contributionContext: "Implemented and reviewed the fallback.",
          verificationState: "unverified",
          attributionState: "acknowledged",
          createdAt: "2026-08-14T05:00:00.000Z",
          updatedAt: "2026-08-14T05:00:00.000Z",
        },
      ],
      attributionIssues: [],
      gaps: [],
      history: [],
      detections: [],
      preparations: [],
    },
    timeline: [
      {
        id: "timeline:confirmed-update",
        kind: "update",
        occurredAt: "2026-08-14T05:00:00.000Z",
        title: "Capture-to-Evidence bridge verified",
        detail: "Commit 6a58834 passed focused verification.",
        projectId,
        projectName: "Evidence Performance System",
        statusLabel: "Confirmed update",
        href: `/en/projects/${projectId}`,
        source: { kind: "update", label: "Employee-confirmed update", freshness: "fresh" },
      },
    ],
    nextCursor: null,
    agentSignals: [
      {
        id: "project-signal:dependency",
        kind: "dependency",
        severity: "attention",
        title: "Blocked work",
        detail: "Waiting for the staging credential decision.",
        source: { kind: "work_item", label: "Authorized Project Task", freshness: "fresh" },
        action: { label: "Review blocked Task", href: "/en/tasks" },
      },
      {
        id: "project-signal:source-gap",
        kind: "evidence_gap",
        severity: "watch",
        title: "Evidence needed",
        detail: "Owner confirmation is still missing.",
        source: { kind: "progress_contract", label: "Approved contract", freshness: "fresh" },
        action: { label: "Review evidence", href: `/en/projects/${projectId}#progress` },
      },
    ],
    preparedActions: [],
    smartBrief: null,
  };
}
