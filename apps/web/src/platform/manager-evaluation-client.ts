import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";
import { WebManagerEvaluationParticipantJourneySchema } from "./manager-feedback-contracts";

const Uuid = z.string().uuid();
const Instant = z.iso.datetime({ offset: true });

export const IdentifiedManagerViewSchema = z
  .object({
    schemaVersion: z.literal(1),
    cycleId: Uuid,
    managerId: Uuid,
    visibilityMode: z.literal("IDENTIFIED"),
    period: z.object({ startsAt: Instant, endsAt: Instant }).strict(),
    completion: z
      .object({
        submitted: z.number().int().nonnegative(),
        pending: z.number().int().nonnegative(),
        approvedLeave: z.number().int().nonnegative(),
        postponed: z.number().int().nonnegative(),
        excluded: z.number().int().nonnegative(),
        entries: z.array(
          z
            .object({
              evaluatorId: Uuid,
              evaluatorDisplayName: z.string().min(1),
              state: z.string().min(1),
              responseId: Uuid.nullable(),
              submittedAt: Instant.nullable(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
    responses: z.array(
      z
        .object({
          responseId: Uuid,
          submitterId: Uuid,
          submitterDisplayName: z.string().min(1),
          submittedAt: Instant,
          responses: z.array(
            z
              .object({
                criterionId: Uuid,
                rating: z.number().int().min(1).max(5),
                comment: z.string(),
              })
              .strict(),
          ),
        })
        .passthrough(),
    ),
    summaryRevision: z.unknown().nullable(),
  })
  .passthrough();

export type IdentifiedManagerView = z.infer<typeof IdentifiedManagerViewSchema>;
export type ManagerFeedbackExperience =
  | Readonly<{
      kind: "participant";
      journey: z.infer<typeof WebManagerEvaluationParticipantJourneySchema>;
    }>
  | Readonly<{ kind: "manager"; view: IdentifiedManagerView }>;

export async function fetchManagerFeedbackExperience(input: {
  cycleId: string;
  locale: "ar" | "en";
}): Promise<ManagerFeedbackExperience> {
  const cycleId = Uuid.parse(input.cycleId);
  const accessToken = await currentAccessToken(input.locale, cycleId);
  const participant = await request(
    accessToken,
    `/api/v1/manager-evaluation/cycles/${cycleId}/participant-view`,
  );
  if (participant.ok) {
    return {
      kind: "participant",
      journey: WebManagerEvaluationParticipantJourneySchema.parse(await participant.json()),
    };
  }
  if (participant.status !== 403) {
    throw new Error(`Manager Evaluation participant request failed: ${participant.status}`);
  }
  const manager = await request(
    accessToken,
    `/api/v1/manager-evaluation/cycles/${cycleId}/manager-view`,
  );
  if (!manager.ok) throw new Error(`Manager Evaluation request failed: ${manager.status}`);
  return { kind: "manager", view: IdentifiedManagerViewSchema.parse(await manager.json()) };
}

export async function fetchIdentifiedManagerView(input: { cycleId: string; locale: "ar" | "en" }) {
  const cycleId = Uuid.parse(input.cycleId);
  const accessToken = await currentAccessToken(input.locale, cycleId);
  const response = await request(
    accessToken,
    `/api/v1/manager-evaluation/cycles/${cycleId}/manager-view`,
  );
  if (!response.ok) throw new Error(`Manager Evaluation request failed: ${response.status}`);
  return IdentifiedManagerViewSchema.parse(await response.json());
}

async function currentAccessToken(locale: "ar" | "en", cycleId: string) {
  const settings = oidcSettings();
  const cookieStore = await cookies();
  try {
    return sessionAccessToken(cookieStore.get(OIDC_SESSION_COOKIE)?.value ?? "", settings);
  } catch {
    const loginUrl = new URL("/api/auth/login", settings.redirectUri);
    loginUrl.searchParams.set("returnTo", `/${locale}/manager-feedback/${cycleId}`);
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }
}

function request(accessToken: string, path: string) {
  return fetch(`${internalApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-correlation-id": randomUUID(),
    },
  });
}

function internalApiBaseUrl() {
  const configured = process.env.INTERNAL_API_BASE_URL?.trim();
  if (!configured) throw new Error("INTERNAL_API_BASE_URL must be configured");
  const url = new URL(configured);
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    ((process.env.APP_ENV ?? "production") === "local" ? !local : url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("INTERNAL_API_BASE_URL is invalid");
  }
  return url.origin;
}
