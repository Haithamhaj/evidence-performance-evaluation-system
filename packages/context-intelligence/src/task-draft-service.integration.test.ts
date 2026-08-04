import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  TASK_DRAFT_PROMPT_VERSION,
  TASK_DRAFT_ROUTE,
  TASK_DRAFT_TRUSTED_PROMPT,
} from "./prompts.js";
import { TaskDraftService } from "./task-draft-service.js";

const employeeId = "00000000-0000-4000-8000-000000000901";
const sourceItemId = "00000000-0000-4000-8000-000000000902";
const projectId = "00000000-0000-4000-8000-000000000903";
const departmentId = "00000000-0000-4000-8000-000000000904";
const systemId = "00000000-0000-4000-8000-000000000905";
const correlationId = "00000000-0000-4000-8000-000000000906";
const draftId = "00000000-0000-4000-8000-000000000907";
const sourceReference = `connected-source:${sourceItemId}`;

type RouterRequest = Readonly<{
  routeKey: string;
  outputSchema: Readonly<{ parse(value: unknown): unknown }>;
  outputSchemaVersion: string;
  promptTemplateVersion: string;
  sourceReferences: readonly string[];
}> &
  Record<string, unknown>;

type PersistOutput = (
  transaction: unknown,
  output: unknown,
) => Promise<Readonly<{ outputReference: string }>>;

describe("TaskDraftService", () => {
  it("persists a validated encrypted draft with exact route lineage but creates no official Task", async () => {
    const fixture = harness({
      title: "Prepare acceptance checklist",
      description: "Prepare the checklist requested in the connected email for employee review.",
      projectId,
      workstreamId: null,
      proposedAssigneeId: employeeId,
      dueAt: null,
      acceptanceConditions: ["Checklist covers the supplied acceptance request."],
      sourceReferences: [sourceReference],
      uncertainties: ["Due date was not supplied."],
    });

    const record = await fixture.service.prepare(command("AUTO_LINK"));

    expect(fixture.router.requests).toHaveLength(1);
    expect(fixture.router.requests[0]).toMatchObject({
      routeKey: TASK_DRAFT_ROUTE,
      outputSchemaVersion: "task-draft-output.v1",
      promptTemplateVersion: TASK_DRAFT_PROMPT_VERSION,
      requiresHumanApproval: true,
    });
    expect(record).toMatchObject({
      id: draftId,
      employeeId,
      reviewStatus: "PENDING",
      revisionOrigin: "AI",
      routeTrace: { routeKey: TASK_DRAFT_ROUTE },
      draft: { projectId },
    });
    expect(fixture.rows[0]).toMatchObject({
      draftCiphertext: expect.stringMatching(/^sealed:/u),
      draftKeyVersion: "context-key-v9",
      record: { id: draftId, draft: { projectId } },
    });
    expect(fixture.rows[0]?.draftCiphertext).not.toContain("acceptance checklist");
    expect(fixture.officialTasks).toHaveLength(0);
  });

  it.each(["REVIEW", "NO_MATCH"] as const)(
    "cannot smuggle a Project through a %s deterministic decision",
    async (kind) => {
      const fixture = harness({
        title: "Prepare follow-up",
        description: "Draft follow-up for review.",
        projectId,
        workstreamId: null,
        proposedAssigneeId: null,
        dueAt: null,
        acceptanceConditions: [],
        sourceReferences: [sourceReference],
        uncertainties: ["Project requires employee review."],
      });

      await expect(fixture.service.prepare(command(kind))).rejects.toThrow(
        "AI Task draft cannot upgrade the deterministic Project decision",
      );
      expect(fixture.rows).toHaveLength(0);
      expect(fixture.officialTasks).toHaveLength(0);
    },
  );

  it("keeps raw/manual operation intact when AI fails", async () => {
    const failure = new Error("AI route unavailable");
    const fixture = harness(failure);
    const input = command("REVIEW");

    await expect(fixture.service.prepare(input)).rejects.toBe(failure);
    expect(input.sources[0]?.content).toBe("Prepare the follow-up.");
    expect(fixture.rows).toHaveLength(0);
    expect(fixture.officialTasks).toHaveLength(0);
  });

  it("reuses a committed draft when the append response is lost and the operation is retried", async () => {
    const fixture = harness(
      {
        title: "Prepare follow-up",
        description: "Prepare the requested follow-up for employee review.",
        projectId: null,
        workstreamId: null,
        proposedAssigneeId: null,
        dueAt: null,
        acceptanceConditions: [],
        sourceReferences: [sourceReference],
        uncertainties: ["The Project is not confirmed."],
      },
      { loseAppendResponseOnce: true },
    );

    await expect(fixture.service.prepare(command("REVIEW"))).rejects.toThrow("draft response lost");
    await expect(fixture.service.prepare(command("REVIEW"))).resolves.toMatchObject({
      id: draftId,
      revision: 1,
    });

    expect(fixture.rows).toHaveLength(1);
    expect(fixture.router.requests).toHaveLength(1);
  });
});

function command(kind: "AUTO_LINK" | "REVIEW" | "NO_MATCH") {
  const decision =
    kind === "AUTO_LINK"
      ? {
          kind,
          projectId,
          anchors: [
            {
              kind: "EXPLICIT_USER_MAPPING" as const,
              reference: sourceReference,
              conflicts: false,
            },
          ],
        }
      : kind === "REVIEW"
        ? { kind, candidates: [], reasons: ["INSUFFICIENT_INDEPENDENT_ANCHORS"] }
        : { kind, reasons: ["NO_PROJECT_CANDIDATES"] };
  return {
    actor: { userId: employeeId, active: true },
    sourceItemId,
    departmentId,
    systemId,
    correlationId,
    sources: [
      {
        kind: "COMMENT" as const,
        reference: sourceReference,
        mediaType: "text/plain",
        content: "Prepare the follow-up.",
      },
    ],
    decision,
    semanticContexts: [],
    analysis: {
      summary: "A follow-up is requested.",
      uncertainties: kind === "AUTO_LINK" ? [] : ["Project is not confirmed."],
      sourceReferences: [sourceReference],
    },
  };
}

function harness(output: unknown, options: Readonly<{ loseAppendResponseOnce?: boolean }> = {}) {
  const traces = new Map<string, Record<string, unknown>>();
  const requests: RouterRequest[] = [];
  const router = {
    requests,
    run: vi.fn(async (request: RouterRequest, persist: PersistOutput) => {
      requests.push(request);
      if (output instanceof Error) throw output;
      const validated = request.outputSchema.parse(output);
      const persisted = await persist(undefined, validated);
      const runId = crypto.randomUUID();
      traces.set(runId, {
        id: runId,
        routeKey: request.routeKey,
        routeConfigId: crypto.randomUUID(),
        routeConfigVersion: 4,
        outputSchemaVersion: request.outputSchemaVersion,
        promptTemplateVersion: request.promptTemplateVersion,
        sourceReferences: request.sourceReferences,
        outputReference: persisted.outputReference,
        state: "succeeded",
      });
      return {
        runId,
        output: validated,
        outputReference: persisted.outputReference,
        requiresHumanApproval: true,
      };
    }),
  };
  const rows: any[] = [];
  let loseAppendResponse = options.loseAppendResponseOnce ?? false;
  const officialTasks: unknown[] = [];
  return {
    router,
    rows,
    officialTasks,
    service: new TaskDraftService({
      router: router as never,
      promptArtifacts: {
        read: async () => ({
          id: crypto.randomUUID(),
          routeKey: TASK_DRAFT_ROUTE,
          version: TASK_DRAFT_PROMPT_VERSION,
          bodyHash: createHash("sha256").update(TASK_DRAFT_TRUSTED_PROMPT).digest("hex"),
          trustedBody: TASK_DRAFT_TRUSTED_PROMPT,
        }),
      },
      aiRuns: { readSucceeded: async (runId: string) => traces.get(runId) as never },
      drafts: {
        findInitial: async () => rows[0]?.record ?? null,
        append: async (row) => {
          const existing = rows.find(({ record }) => record.id === row.record.id);
          if (existing === undefined) rows.push(row);
          if (loseAppendResponse) {
            loseAppendResponse = false;
            throw new Error("draft response lost");
          }
          return (existing ?? row).record;
        },
      },
      protector: {
        seal: async (value: string) => ({
          ciphertext: `sealed:${Buffer.from(value).toString("base64url")}`,
          keyVersion: "context-key-v9",
        }),
      },
      clock: () => new Date("2026-08-02T14:00:00.000Z"),
      idFactory: () => draftId,
      timeoutMs: 10_000,
    }),
  };
}
