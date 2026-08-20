import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";
import { EmployeeEvaluationJourneySchema } from "./evaluation-experience-schema";

const UuidSchema = z.string().uuid();
export { EmployeeEvaluationJourneySchema } from "./evaluation-experience-schema";
export type EmployeeEvaluationJourney =
  import("../app/[locale]/evaluations/[cycleId]/evaluation-experience-contracts").EvaluationJourney;

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
