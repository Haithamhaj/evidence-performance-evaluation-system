import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";

export type DailyWorkRoute =
  | { readonly kind: "my_work" }
  | { readonly kind: "projects" }
  | { readonly kind: "project"; readonly projectId: string };

const UuidSchema = z.string().uuid();
const WorkItemSchema = z
  .object({
    id: UuidSchema,
    projectId: UuidSchema,
    workstreamId: UuidSchema.nullable(),
    title: z.string(),
    description: z.string(),
    status: z.enum([
      "planned",
      "ready",
      "in_progress",
      "blocked",
      "in_review",
      "done",
      "cancelled",
    ]),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    assigneeId: UuidSchema.nullable(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    requirements: z.array(z.string()),
    acceptanceConditions: z.array(z.string()),
    blocker: z.string().nullable(),
    nextAction: z.string().nullable(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    allowedActions: z.array(z.enum(["edit", "transition", "assign", "add_update"])),
  })
  .strict();

export const WebMyWorkResponseSchema: z.ZodType<import("@evaluation/contracts").MyWorkResponse> = z
  .object({
    groups: z.array(
      z
        .object({
          key: z.enum([
            "needs_my_action",
            "today",
            "overdue",
            "waiting_blocked",
            "reviews_criteria",
            "this_week",
            "no_due_date",
            "recent_activity",
          ]),
          items: z.array(WorkItemSchema),
          collapsedByDefault: z.boolean(),
        })
        .strict(),
    ),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export const WebProjectPortfolioSchema = z.array(
  z
    .object({
      id: UuidSchema,
      name: z.string().trim().min(1).max(200),
      status: z.enum(["active", "paused"]),
      progress: z.discriminatedUnion("state", [
        z.object({ state: z.literal("awaiting_contract") }).strict(),
        z.object({ state: z.literal("awaiting_information") }).strict(),
        z
          .object({
            state: z.literal("accepted"),
            percent: z.number().min(0).max(100),
            updatedAt: z.iso.datetime({ offset: true }),
          })
          .strict(),
      ]),
    })
    .strict(),
);

export async function fetchDailyWorkUpstream<T>(input: {
  readonly route: DailyWorkRoute;
  readonly schema: { parse(value: unknown): T };
}): Promise<T> {
  const correlationId = randomUUID();
  const path = routePath(input.route);
  const baseUrl = internalApiBaseUrl();
  const settings = oidcSettings();
  const cookieStore = await cookies();
  const accessToken = sessionAccessToken(
    cookieStore.get(OIDC_SESSION_COOKIE)?.value ?? "",
    settings,
  );
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-correlation-id": correlationId,
    },
    method: "GET",
  });
  if (!response.ok) throw new Error(`Daily work request failed with status ${response.status}`);
  return input.schema.parse(await response.json());
}

function routePath(route: DailyWorkRoute): string {
  if (route.kind === "my_work") return "/api/v1/daily-work/my-work";
  if (route.kind === "projects") return "/api/v1/daily-work/projects";
  return `/api/v1/daily-work/projects/${z.string().uuid().parse(route.projectId)}`;
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
  )
    throw new Error("INTERNAL_API_BASE_URL is invalid");
  return url.origin;
}
