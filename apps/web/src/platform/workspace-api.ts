import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { z } from "zod";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";

export type WorkspaceRoute =
  | { readonly kind: "projects" }
  | { readonly kind: "project"; readonly projectId: string }
  | {
      readonly kind: "workstream";
      readonly projectId: string;
      readonly workstreamId: string;
    };

export type SafeWorkspaceError = {
  readonly status: 401 | 403 | 404 | 409 | 500 | 503;
  readonly messageKey:
    | "errors.unauthorized"
    | "errors.forbidden"
    | "errors.notFound"
    | "errors.validation"
    | "errors.internal";
  readonly correlationId: string;
};

class WorkspaceApiError extends Error implements SafeWorkspaceError {
  readonly status: SafeWorkspaceError["status"];
  readonly messageKey: SafeWorkspaceError["messageKey"];
  readonly correlationId: string;

  constructor(
    status: SafeWorkspaceError["status"],
    messageKey: SafeWorkspaceError["messageKey"],
    correlationId: string,
  ) {
    super(messageKey);
    this.name = "WorkspaceApiError";
    this.status = status;
    this.messageKey = messageKey;
    this.correlationId = correlationId;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UuidSchema = z.string().uuid();
const ResourceDocumentSchema = z
  .object({
    id: UuidSchema,
    kind: z.enum(["project", "workstream"]),
    resourceId: UuidSchema,
  })
  .passthrough()
  .nullable();
const ProjectIdentitySchema = z
  .object({ project: z.object({ id: UuidSchema }).passthrough() })
  .passthrough();
const WorkstreamIdentitySchema = z
  .object({
    workstream: z
      .object({
        id: UuidSchema,
        projectId: UuidSchema,
      })
      .passthrough(),
  })
  .passthrough();
const ManagerReadinessSummarySchema = z
  .object({
    state: z.enum(["ready", "needs_attention", "missing_critical_information"]),
  })
  .strict();

export async function fetchWorkspaceUpstream<T>(input: {
  readonly route: WorkspaceRoute;
  readonly schema: { parse(value: unknown): T };
  readonly method?: "GET" | "POST";
  readonly body?: unknown;
}): Promise<T> {
  const correlationId = randomUUID();
  const baseUrl = internalApiBaseUrl(correlationId);
  const path = workspacePath(input.route, correlationId);
  let settings: ReturnType<typeof oidcSettings>;
  try {
    settings = oidcSettings();
  } catch {
    throw failure(500, "errors.internal", correlationId);
  }
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  try {
    cookieStore = await cookies();
  } catch {
    throw failure(500, "errors.internal", correlationId);
  }
  const encryptedSession = cookieStore.get(OIDC_SESSION_COOKIE)?.value ?? "";

  let accessToken: string;
  try {
    accessToken = sessionAccessToken(encryptedSession, settings);
  } catch {
    throw failure(401, "errors.unauthorized", correlationId);
  }

  const method = input.method ?? "GET";
  const context: UpstreamContext = {
    accessToken,
    baseUrl,
    correlationId,
  };
  if (input.route.kind === "projects") {
    return requestJson(context, path, input.schema, method, input.body);
  }
  if (method !== "GET") throw failure(409, "errors.validation", correlationId);
  try {
    let workspace: unknown;
    if (input.route.kind === "project") {
      const projectWorkspace = await requestJson(context, path, ProjectIdentitySchema);
      if (projectWorkspace.project.id !== input.route.projectId) {
        throw failure(503, "errors.internal", correlationId);
      }
      workspace = projectWorkspace;
    } else {
      const workstreamWorkspace = await requestJson(context, path, WorkstreamIdentitySchema);
      if (
        workstreamWorkspace.workstream.id !== input.route.workstreamId ||
        workstreamWorkspace.workstream.projectId !== input.route.projectId
      ) {
        throw failure(503, "errors.internal", correlationId);
      }
      workspace = workstreamWorkspace;
    }

    const resourceKind = input.route.kind;
    const resourceId =
      input.route.kind === "project" ? input.route.projectId : input.route.workstreamId;
    const query = new URLSearchParams({ kind: resourceKind, resourceId });
    const document = await requestJson(
      context,
      `/api/v1/documents/resource?${query.toString()}`,
      ResourceDocumentSchema,
    );
    if (
      document !== null &&
      (document.kind !== resourceKind || document.resourceId !== resourceId)
    ) {
      throw failure(503, "errors.internal", correlationId);
    }
    const readiness = document === null ? null : await fetchReadiness(context, document.id);
    const criteria = await requestJson(context, `/api/v1/dynamic-criteria/workspace?${query}`, {
      parse: (value: unknown) => value,
    });
    return input.schema.parse({ workspace, document, readiness, criteria });
  } catch (error) {
    if (error instanceof WorkspaceApiError) throw error;
    throw failure(503, "errors.internal", correlationId);
  }
}

export function safeWorkspaceError(error: unknown): SafeWorkspaceError {
  if (error instanceof WorkspaceApiError) {
    return {
      status: error.status,
      messageKey: error.messageKey,
      correlationId: error.correlationId,
    };
  }
  return failure(500, "errors.internal", randomUUID());
}

function internalApiBaseUrl(correlationId: string): string {
  const configured = process.env.INTERNAL_API_BASE_URL;
  if (configured === undefined || configured.trim().length === 0) {
    throw failure(500, "errors.internal", correlationId);
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw failure(500, "errors.internal", correlationId);
  }

  const isOriginOnly =
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  const environment = process.env.APP_ENV ?? "production";
  const isLocalLoopback =
    url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (!isOriginOnly || (environment === "local" ? !isLocalLoopback : url.protocol !== "https:")) {
    throw failure(500, "errors.internal", correlationId);
  }
  return url.origin;
}

function workspacePath(route: WorkspaceRoute, correlationId: string): string {
  if (route.kind === "projects") return "/api/v1/projects";
  assertUuid(route.projectId, correlationId);
  if (route.kind === "project") return `/api/v1/projects/${route.projectId}/workspace`;
  assertUuid(route.workstreamId, correlationId);
  return `/api/v1/projects/${route.projectId}/workstreams/${route.workstreamId}/workspace`;
}

type UpstreamContext = {
  readonly accessToken: string;
  readonly baseUrl: string;
  readonly correlationId: string;
};

async function requestJson<T>(
  context: UpstreamContext,
  path: string,
  schema: { parse(value: unknown): T },
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${context.accessToken}`,
    "x-correlation-id": context.correlationId,
  };
  if (method === "POST") headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${context.baseUrl}${path}`, {
      cache: "no-store",
      headers,
      method,
      ...(method === "POST" && body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw failure(503, "errors.internal", context.correlationId);
  }
  if (!response.ok) throw responseFailure(response.status, context.correlationId);

  try {
    return schema.parse(await response.json());
  } catch {
    throw failure(503, "errors.internal", context.correlationId);
  }
}

async function fetchReadiness(context: UpstreamContext, documentId: string): Promise<unknown> {
  const detailPath = `/api/v1/documents/${documentId}/readiness-checks/latest`;
  try {
    return await requestJson(context, detailPath, { parse: (value: unknown) => value });
  } catch (error) {
    if (!(error instanceof WorkspaceApiError)) throw error;
    if (error.status === 404) return null;
    if (error.status !== 403) throw error;
  }

  try {
    const summary = await requestJson(
      context,
      `${detailPath}/operational-state`,
      ManagerReadinessSummarySchema,
    );
    return { audience: "manager", state: summary.state };
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 404) return null;
    throw error;
  }
}

function assertUuid(value: string, correlationId: string): void {
  if (!UUID_PATTERN.test(value)) throw failure(404, "errors.notFound", correlationId);
}

function responseFailure(status: number, correlationId: string): WorkspaceApiError {
  if (status === 401) return failure(401, "errors.unauthorized", correlationId);
  if (status === 403) return failure(403, "errors.forbidden", correlationId);
  if (status === 404) return failure(404, "errors.notFound", correlationId);
  if (status === 400 || status === 409 || status === 422) {
    return failure(409, "errors.validation", correlationId);
  }
  if (status === 503) return failure(503, "errors.internal", correlationId);
  return failure(500, "errors.internal", correlationId);
}

function failure(
  status: SafeWorkspaceError["status"],
  messageKey: SafeWorkspaceError["messageKey"],
  correlationId: string,
): WorkspaceApiError {
  return new WorkspaceApiError(status, messageKey, correlationId);
}
