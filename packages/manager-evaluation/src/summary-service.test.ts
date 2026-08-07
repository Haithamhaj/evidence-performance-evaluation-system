import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT } from "./prompts.js";
import { ManagerEvaluationSummaryService } from "./summary-service.js";

const ids = {
  cycle: "00000000-0000-4000-8000-000000006201",
  department: "00000000-0000-4000-8000-000000006202",
  manager: "00000000-0000-4000-8000-000000006203",
  prompt: "00000000-0000-4000-8000-000000006204",
  run: "00000000-0000-4000-8000-000000006205",
  revision: "00000000-0000-4000-8000-000000006206",
  criterion: "00000000-0000-4000-8000-000000006207",
  responses: [
    "00000000-0000-4000-8000-000000006208",
    "00000000-0000-4000-8000-000000006209",
  ],
} as const;
const version = "manager-evaluation-summary.v1";
const promptHash = createHash("sha256")
  .update(MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT)
  .digest("hex");

describe("manager evaluation summary governance", () => {
  it("uses the verified prompt descriptor and writes a content-free generation audit", async () => {
    const harness = summaryHarness();

    await expect(harness.service.createSummary({ cycleId: ids.cycle, managerId: ids.manager }))
      .resolves.toMatchObject({ cycleId: ids.cycle, sourceResponseIds: ids.responses });

    expect(harness.findPrompt).toHaveBeenCalledWith({
      where: { routeKey_version: { routeKey: "manager-evaluation.summary", version } },
      select: { id: true, routeKey: true, version: true, bodyHash: true, trustedBody: true },
    });
    const request = harness.run.mock.calls[0]![0] as any;
    expect(request.input.trustedInstruction).toEqual({
      routeKey: "manager-evaluation.summary",
      artifactId: ids.prompt,
      version,
      sha256: promptHash,
    });
    expect(Object.keys(request.input).sort()).toEqual(["trustedInstruction", "untrustedContent"]);
    expect(JSON.stringify(request.input.untrustedContent)).toContain("Private identified comment");
    expect(JSON.stringify(request.input.trustedInstruction)).not.toContain(
      "Private identified comment",
    );
    expect(harness.auditAppend).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "manager_evaluation.summary.generated",
        safeDiff: {
          visibilityMode: "IDENTIFIED",
          revision: 1,
          sourceResponseCount: 2,
          themeCount: 0,
        },
      }),
    );
    expect(JSON.stringify(harness.auditAppend.mock.calls)).not.toContain(
      "Private identified comment",
    );
  });

  it("rejects a prompt artifact whose registered body does not match the code version", async () => {
    const harness = summaryHarness({ trustedBody: "changed prompt body" });

    await expect(
      harness.service.createSummary({ cycleId: ids.cycle, managerId: ids.manager }),
    ).rejects.toMatchObject({ code: "AI_PROMPT_ARTIFACT_MISMATCH" });
    expect(harness.run).not.toHaveBeenCalled();
  });
});

function summaryHarness(overrides: Partial<{ trustedBody: string }> = {}) {
  const trustedBody = overrides.trustedBody ?? MANAGER_EVALUATION_SUMMARY_TRUSTED_PROMPT;
  const findPrompt = vi.fn(async () => ({
    id: ids.prompt,
    routeKey: "manager-evaluation.summary",
    version,
    bodyHash: promptHash,
    trustedBody,
  }));
  const cycle = {
    id: ids.cycle,
    departmentId: ids.department,
    managerId: ids.manager,
    visibilityMode: "IDENTIFIED",
    startsAt: new Date("2026-07-01T00:00:00.000Z"),
    endsAt: new Date("2026-10-01T00:00:00.000Z"),
    responses: ids.responses.map((id, index) => ({
      id,
      submittedAt: new Date(`2026-08-0${index + 1}T00:00:00.000Z`),
      criterionResponses: [
        { criterionId: ids.criterion, rating: 3 + index, comment: "Private identified comment" },
      ],
    })),
  };
  const transaction = {
    managerEvaluationCycle: { findUnique: vi.fn(async () => cycle) },
    analysisPromptArtifact: { findUnique: findPrompt },
    managerEvaluationSummaryRevision: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: ids.revision,
        revision: 1,
        createdAt: new Date("2026-08-07T16:00:00.000Z"),
      })),
    },
  };
  const database = {
    managerEvaluationCycle: transaction.managerEvaluationCycle,
    analysisPromptArtifact: transaction.analysisPromptArtifact,
    $transaction: vi.fn(async (work: (value: typeof transaction) => Promise<unknown>) =>
      work(transaction),
    ),
  };
  const run = vi.fn(async (_request: unknown) => ({
    runId: ids.run,
    output: {
      schemaVersion: version,
      themes: [],
      limitations: ["Original identified responses remain authoritative."],
    },
  }));
  const auditAppend = vi.fn(async () => ({ id: crypto.randomUUID() }));
  return {
    findPrompt,
    run,
    auditAppend,
    service: new ManagerEvaluationSummaryService({
      database: database as never,
      router: { run } as never,
      systemId: "00000000-0000-4000-8000-000000006210",
      timeoutMs: 30_000,
      clock: () => new Date("2026-08-07T16:00:00.000Z"),
      audit: { append: auditAppend } as never,
    }),
  };
}
