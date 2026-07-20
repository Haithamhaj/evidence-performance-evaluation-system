import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";
import { UpdateComposerContextSchema } from "./updates-evidence-contracts";
import {
  WebPrivateInboxItemSchema,
  WebTaskWorkspaceResponseSchema,
  WebUuidSchema,
  WebWorkItemSchema,
} from "./task-workspace-contracts";

export type DailyWorkRoute =
  | { readonly kind: "my_work" }
  | {
      readonly kind: "tasks";
      readonly layout: "list" | "board" | "calendar";
      readonly view: "my" | "team";
    }
  | { readonly kind: "projects" }
  | { readonly kind: "update_context" }
  | { readonly kind: "project"; readonly projectId: string };

const UuidSchema = WebUuidSchema;
const WorkItemSchema = WebWorkItemSchema;

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

export const WebUpdateComposerContextSchema = UpdateComposerContextSchema;
export { WebTaskWorkspaceResponseSchema };
export const WebDailyWorkspaceSnapshotSchema: z.ZodType<
  import("@evaluation/contracts").DailyWorkspaceSnapshot
> = z
  .object({
    needsMyAction: z.array(WorkItemSchema),
    today: z.array(WorkItemSchema),
    overdue: z.array(WorkItemSchema),
    reviewQueue: z.array(WorkItemSchema),
    inbox: z.array(WebPrivateInboxItemSchema),
    projectPulse: z.array(
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
    ),
    upcoming: z.array(WorkItemSchema),
  })
  .strict();

export async function fetchDailyWorkUpstream<T>(input: {
  readonly route: DailyWorkRoute;
  readonly schema: { parse(value: unknown): T };
}): Promise<T> {
  const correlationId = randomUUID();
  const path = routePath(input.route);
  const baseUrl = internalApiBaseUrl();
  const settings = oidcSettings();
  const cookieStore = await cookies();
  let accessToken: string;
  try {
    accessToken = sessionAccessToken(cookieStore.get(OIDC_SESSION_COOKIE)?.value ?? "", settings);
  } catch {
    redirect("/api/auth/login");
  }
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
  if (route.kind === "tasks") {
    const query = new URLSearchParams({ view: route.view, layout: route.layout });
    return `/api/v1/work-items?${query.toString()}`;
  }
  if (route.kind === "projects") return "/api/v1/daily-work/projects";
  if (route.kind === "update_context") return "/api/v1/daily-work/update-context";
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
