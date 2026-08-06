import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";

const UuidSchema = z.string().uuid();
const InstantSchema = z.iso.datetime({ offset: true });
const SubmissionSchema = z
  .object({
    kind: z.enum(["SELF", "MANAGER_INITIAL"]),
    submittedAt: InstantSchema,
    entries: z.array(z.unknown()),
  })
  .strict();

export const EmployeeEvaluationJourneySchema = z
  .object({
    schemaVersion: z.literal(1),
    audience: z.enum(["self", "assigned_manager"]),
    cycle: z
      .object({
        id: UuidSchema,
        type: z.enum(["CALIBRATION_NON_BASELINE", "STANDARD"]),
        state: z.string().min(1),
        startsAt: InstantSchema,
        endsAt: InstantSchema,
        version: z.number().int().positive(),
      })
      .strict(),
    assignment: z
      .object({
        id: UuidSchema,
        employeeId: UuidSchema,
        managerId: UuidSchema,
        version: z.number().int().positive(),
      })
      .strict(),
    templateSnapshot: z.unknown().nullable(),
    factViewFirst: z
      .object({
        responsibilityWindows: z.array(z.unknown()),
        workFacts: z.array(z.unknown()),
        researchFacts: z.array(z.unknown()),
        sourceCoverageNotes: z.array(z.unknown()),
      })
      .strict(),
    submissions: z.array(SubmissionSchema),
    comparison: z.unknown().nullable(),
    discussion: z.array(
      z
        .object({
          id: UuidSchema,
          body: z.string().min(1),
          sourceReferences: z.unknown(),
          createdAt: InstantSchema,
        })
        .strict(),
    ),
    finalDecision: z
      .object({
        humanManagerDecision: z.literal(true),
        entries: z.array(z.unknown()),
        finalComment: z.string().nullable(),
        finalizedAt: InstantSchema,
      })
      .strict()
      .nullable(),
    acknowledgment: z
      .object({
        kind: z.enum(["ACKNOWLEDGED", "ACKNOWLEDGED_WITH_RESERVATION", "NO_RESPONSE"]),
        reservation: z.string().nullable(),
        recordedAt: InstantSchema,
      })
      .strict()
      .nullable(),
    immutableClosedSnapshot: z
      .object({
        id: UuidSchema,
        schemaVersion: z.number().int().positive(),
        closedAt: InstantSchema,
      })
      .strict()
      .nullable(),
    independenceGate: z.object({ managerSubmittedBeforeSelfProjection: z.boolean() }).strict(),
  })
  .strict();

export type EmployeeEvaluationJourney = z.infer<typeof EmployeeEvaluationJourneySchema>;

export async function fetchEmployeeEvaluationJourney(input: {
  readonly cycleId: string;
  readonly locale: "ar" | "en";
}): Promise<EmployeeEvaluationJourney> {
  const cycleId = UuidSchema.parse(input.cycleId);
  const settings = oidcSettings();
  const cookieStore = await cookies();
  let accessToken: string;
  try {
    accessToken = sessionAccessToken(cookieStore.get(OIDC_SESSION_COOKIE)?.value ?? "", settings);
  } catch {
    const loginUrl = new URL("/api/auth/login", settings.redirectUri);
    loginUrl.searchParams.set("returnTo", `/${input.locale}/evaluations/${cycleId}`);
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }
  const response = await fetch(
    `${internalApiBaseUrl()}/api/v1/employee-evaluation/cycles/${cycleId}/journey`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        "x-correlation-id": randomUUID(),
      },
    },
  );
  if (!response.ok) throw new Error(`Employee Evaluation request failed: ${response.status}`);
  return EmployeeEvaluationJourneySchema.parse(await response.json());
}

function internalApiBaseUrl(): string {
  const configured = process.env.INTERNAL_API_BASE_URL?.trim();
  if (!configured) throw new Error("INTERNAL_API_BASE_URL must be configured");
  const url = new URL(configured);
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    ((process.env.APP_ENV ?? "production") === "local" ? !local : url.protocol !== "https:") ||
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
