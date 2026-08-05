import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";

const UuidSchema = z.string().uuid();
const InstantSchema = z.iso.datetime({ offset: true });
const SourceReferenceSchema = z
  .object({
    sourceType: z.enum([
      "responsibility_window",
      "timeline_event",
      "evidence",
      "check_in",
      "criterion_version",
      "document_version",
      "github_event",
      "approved_leave",
    ]),
    sourceId: UuidSchema,
    sourceVersion: z.number().int().positive().nullable(),
    occurredAt: InstantSchema,
    url: z.url().max(2_000).nullable(),
  })
  .strict();
const FactBaseSchema = z
  .object({
    kind: z.literal("source_fact"),
    sourceId: UuidSchema,
    sourceOccurredAt: InstantSchema,
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    sourceReferences: z.array(SourceReferenceSchema).min(1),
  })
  .strict();
const VerificationSchema = z.enum([
  "source_supported",
  "partially_supported",
  "self_reported",
  "conflicting",
  "unable_to_verify",
  "peer_acknowledged",
]);
const AttributionSchema = z.enum([
  "employee_confirmed",
  "peer_acknowledged",
  "disputed",
  "clarified",
  "team_contribution",
  "unable_to_attribute",
]);

export const WebEvaluationFactViewSchema: z.ZodType<
  import("@evaluation/contracts").EvaluationFactView
> = z
  .object({
    schemaVersion: z.literal(1),
    cycle: z
      .object({
        id: UuidSchema,
        startsAt: InstantSchema,
        endsAt: InstantSchema,
        rubricVersionId: UuidSchema,
      })
      .strict(),
    subjectEmployeeId: UuidSchema,
    generatedAt: InstantSchema,
    responsibilityWindows: z.array(
      FactBaseSchema.extend({
        sourceType: z.literal("responsibility_window"),
        responsibilityType: z.enum([
          "original_owner",
          "acting_owner",
          "permanent_owner",
          "contributor",
        ]),
        startedAt: InstantSchema,
        endedAt: InstantSchema.nullable(),
      }).strict(),
    ),
    projectFacts: z.array(
      FactBaseSchema.extend({
        sourceType: z.literal("project_contribution"),
        relatedWorkItemId: UuidSchema.nullable(),
        criterionStableId: z.string().trim().min(1).max(100).nullable(),
        criterionVersionId: UuidSchema.nullable(),
        summary: z.string().trim().min(1).max(4_000),
        result: z.string().trim().min(1).max(4_000).nullable(),
        verificationState: VerificationSchema,
        attributionState: AttributionSchema,
        responsibilityWindowIds: z.array(UuidSchema),
      }).strict(),
    ),
    confirmedEvidence: z.array(
      FactBaseSchema.extend({
        sourceType: z.literal("confirmed_evidence"),
        relatedWorkItemId: UuidSchema.nullable(),
        relatedCriterionStableId: z.string().trim().min(1).max(100).nullable(),
        supportedClaim: z.string().trim().min(1).max(4_000),
        contributionContext: z.string().trim().min(1).max(4_000),
        verificationState: VerificationSchema,
        attributionState: AttributionSchema,
      }).strict(),
    ),
    checkInFacts: z.array(
      FactBaseSchema.extend({
        sourceType: z.literal("check_in"),
        checkInType: z.enum(["workstream", "project"]),
        status: z.string().trim().min(1).max(100),
        summary: z.string().trim().min(1).max(4_000),
      }).strict(),
    ),
    dynamicCriteriaVersions: z.array(
      FactBaseSchema.extend({
        sourceType: z.literal("criterion_version"),
        criterionStableId: z.string().trim().min(1).max(100),
        criterionVersionId: UuidSchema,
        locale: z.enum(["ar", "en"]),
        name: z.string().trim().min(1).max(500),
        effectiveFrom: InstantSchema,
        effectiveUntil: InstantSchema.nullable(),
      }).strict(),
    ),
    employeeInterpretations: z.array(
      z
        .object({
          kind: z.literal("employee_interpretation"),
          id: UuidSchema,
          originalText: z.string().trim().min(1).max(20_000),
          normalizedText: z.string().trim().min(1).max(20_000),
          sourceFactIds: z.array(UuidSchema),
          createdAt: InstantSchema,
        })
        .strict(),
    ),
    sourceCoverageNotes: z.array(
      z
        .object({
          kind: z.literal("coverage_note"),
          code: z.enum([
            "missing_source",
            "partial_period",
            "unverified_claim",
            "disputed_attribution",
            "approved_leave_excluded",
            "incomplete_context",
          ]),
          scope: z.enum(["cycle", "project", "workstream", "criterion", "evidence"]),
          projectId: UuidSchema.nullable(),
          workstreamId: UuidSchema.nullable(),
          messageKey: z.string().trim().min(1).max(200),
          sourceFactIds: z.array(UuidSchema),
          neutral: z.literal(true),
        })
        .strict(),
    ),
  })
  .strict();

export async function fetchEvaluationFactView(
  input: Readonly<{
    cycleId: string;
    employeeId: string;
    locale: "ar" | "en";
  }>,
): Promise<import("@evaluation/contracts").EvaluationFactView> {
  const cycleId = UuidSchema.parse(input.cycleId);
  const employeeId = UuidSchema.parse(input.employeeId);
  const settings = oidcSettings();
  const cookieStore = await cookies();
  let accessToken: string;
  try {
    accessToken = sessionAccessToken(cookieStore.get(OIDC_SESSION_COOKIE)?.value ?? "", settings);
  } catch {
    const query = new URLSearchParams({ cycle: cycleId, employee: employeeId });
    const loginUrl = new URL("/api/auth/login", settings.redirectUri);
    loginUrl.searchParams.set("returnTo", `/${input.locale}/evaluations/facts?${query.toString()}`);
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }
  const response = await fetch(
    `${internalApiBaseUrl()}/api/v1/evaluation-cycles/${cycleId}/employees/${employeeId}/facts`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        "x-correlation-id": randomUUID(),
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Evaluation Fact View request failed with status ${response.status}`);
  }
  return WebEvaluationFactViewSchema.parse(await response.json());
}

function internalApiBaseUrl(): string {
  const configured = process.env.INTERNAL_API_BASE_URL?.trim();
  if (!configured) throw new Error("INTERNAL_API_BASE_URL must be configured");
  const url = new URL(configured);
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  const validProtocol =
    (process.env.APP_ENV ?? "production") === "local" ? local : url.protocol === "https:";
  if (
    !validProtocol ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("INTERNAL_API_BASE_URL is invalid");
  }
  return url.origin;
}
