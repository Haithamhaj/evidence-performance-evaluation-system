import { describe, expect, it } from "vitest";

const inspectionContracts = await import("./experience-inspection.js").catch(() => null);

const validTrace = {
  access: {
    environment: "LOCAL",
    serverAuthorization: {
      disposition: "SYSTEM_ADMINISTRATOR_LOCAL_TEST",
      authorizationDecisionId: "00000000-0000-4000-8000-000000000083",
    },
    privateModeSourceAccess: false,
    auditEventId: null,
  },
  capabilityId: "CAP-003",
  assistanceMode: "DETERMINISTIC_ASSISTANCE",
  executionKind: "DETERMINISTIC",
  sourceReferences: [
    {
      reference: "ai-run:00000000-0000-4000-8000-000000000084",
      sourceAuthorizationDecisionId: "00000000-0000-4000-8000-000000000082",
    },
  ],
  summaries: {
    why: { locale: "en", messageKey: "experience-inspection.route-fallback" },
    freshness: { locale: "en", messageKey: "experience-inspection.current-completed-run" },
    consequence: { locale: "en", messageKey: "experience-inspection.no-business-record-changed" },
  },
  schemaVersion: "experience-inspection.v1",
  promptVersion: "experience-inspection-prompt.v1",
  aiRouterRunId: "00000000-0000-4000-8000-000000000084",
  fallbackState: "FALLBACK_USED",
  correlationId: "00000000-0000-4000-8000-000000000085",
  command: {
    disposition: "NOT_APPLICABLE",
    safeRecoveryAction: { locale: "en", messageKey: "experience-inspection.no-recovery-required" },
  },
} as const;

function requireContracts() {
  expect(inspectionContracts).not.toBeNull();
  if (!inspectionContracts) throw new Error("experience inspection contracts are unavailable");
  return inspectionContracts;
}

describe("experience inspection contracts", () => {
  it("accepts only the bounded redacted trace for an authorized local administrator", () => {
    const { ExperienceInspectionTraceSchema } = requireContracts();

    expect(ExperienceInspectionTraceSchema.parse(validTrace)).toEqual(validTrace);
  });

  it("rejects secrets, private content, readiness values, and performance influence fields", () => {
    const { ExperienceInspectionTraceSchema } = requireContracts();

    for (const prohibitedField of [
      "prompt",
      "chainOfThought",
      "accessToken",
      "credential",
      "providerKey",
      "rawPrivateContent",
      "documentationReadiness",
      "recommendedRating",
      "predictedRating",
      "employeeRank",
      "productivityScore",
      "managerJudgment",
      "unredactedEvidence",
      "emailBody",
      "attachment",
      "googleToken",
      "githubToken",
    ]) {
      expect(
        () =>
          ExperienceInspectionTraceSchema.parse({ ...validTrace, [prohibitedField]: "private" }),
        prohibitedField,
      ).toThrow();
    }
  });

  it("requires trace provenance and does not label a deterministic path as Agent-generated", () => {
    const { ExperienceInspectionTraceSchema } = requireContracts();

    for (const requiredField of ["sourceReferences", "summaries", "correlationId"] as const) {
      const invalid = { ...validTrace } as Record<string, unknown>;
      delete invalid[requiredField];
      expect(() => ExperienceInspectionTraceSchema.parse(invalid), requiredField).toThrow();
    }
    for (const summaryField of ["why", "freshness", "consequence"] as const) {
      const summaries = { ...validTrace.summaries } as Record<string, unknown>;
      delete summaries[summaryField];
      expect(() => ExperienceInspectionTraceSchema.parse({ ...validTrace, summaries })).toThrow();
    }

    expect(() =>
      ExperienceInspectionTraceSchema.parse({
        ...validTrace,
        assistanceMode: "AGENT_ASSISTANCE",
      }),
    ).toThrow(/deterministic/iu);
  });

  it("disables production inspection and requires a server authorization decision plus audit event for private sources", () => {
    const { ExperienceInspectionTraceSchema } = requireContracts();

    expect(() =>
      ExperienceInspectionTraceSchema.parse({
        ...validTrace,
        access: { ...validTrace.access, environment: "PRODUCTION" },
      }),
    ).toThrow(/production/iu);
    expect(() =>
      ExperienceInspectionTraceSchema.parse({
        ...validTrace,
        access: { ...validTrace.access, serverAuthorization: { disposition: "manager" } },
      }),
    ).toThrow();
    expect(() =>
      ExperienceInspectionTraceSchema.parse({
        ...validTrace,
        access: { ...validTrace.access, privateModeSourceAccess: true },
      }),
    ).toThrow(/audit event.*audit reason/iu);
  });

  it("rejects raw private narratives in allowed summary fields", () => {
    const { ExperienceInspectionTraceSchema } = requireContracts();

    expect(() =>
      ExperienceInspectionTraceSchema.parse({
        ...validTrace,
        summaries: {
          ...validTrace.summaries,
          consequence: {
            locale: "en",
            messageKey:
              "From Alice to Bob: the client confirms its private account number is 123456.",
          },
        },
      }),
    ).toThrow();
  });

  it("rejects caller-asserted source authorization", () => {
    const { ExperienceInspectionTraceSchema } = requireContracts();

    expect(() =>
      ExperienceInspectionTraceSchema.parse({
        ...validTrace,
        sourceReferences: [
          {
            reference: "email:00000000-0000-4000-8000-000000000086",
            authorizedForCurrentUser: true,
          },
        ],
      }),
    ).toThrow();
  });
});
