import { z } from "zod";

const UuidSchema = z.string().uuid();
const ContextItemSchema = z
  .object({
    id: UuidSchema,
    provider: z.enum(["GOOGLE_GMAIL", "GOOGLE_CALENDAR"]),
    occurredAt: z.iso.datetime({ offset: true }),
    title: z.string(),
    summary: z.string().nullable(),
    sourceUrl: z.url().nullable(),
    privacy: z.literal("PRIVATE"),
    excluded: z.boolean(),
    projectId: UuidSchema.nullable(),
    sourceExclusion: z
      .object({
        provider: z.enum(["GOOGLE_GMAIL", "GOOGLE_CALENDAR"]),
        kind: z.enum(["GMAIL_LABEL", "GMAIL_THREAD", "CALENDAR", "CALENDAR_EVENT_CATEGORY"]),
        providerExclusionId: z.string().min(1).max(1_000),
        excluded: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict();

const ContextListSchema = z
  .object({
    mode: z.enum(["synthetic", "live"]),
    synthetic: z.boolean(),
    connection: z
      .object({
        status: z.enum(["connected", "disconnected"]),
        lastSuccessfulSyncAt: z.iso.datetime({ offset: true }).nullable(),
      })
      .strict(),
    items: z.array(ContextItemSchema),
  })
  .strict();

export type ConnectedWorkContext = z.infer<typeof ContextListSchema>;
export type ConnectedWorkContextItem = z.infer<typeof ContextItemSchema>;

export async function listConnectedWorkContext(): Promise<ConnectedWorkContext> {
  return request("/api/workspace/connected-work/items", "GET", undefined, ContextListSchema);
}

export async function startGoogleConnection(redirectUri: string) {
  return request(
    "/api/workspace/connected-work/google/start",
    "POST",
    { redirectUri },
    z
      .object({
        mode: z.enum(["synthetic", "live"]),
        synthetic: z.boolean(),
        authorizationUrl: z.url(),
      })
      .strict(),
  );
}

export async function completeGoogleConnection(input: {
  readonly nonce: string;
  readonly redirectUri: string;
  readonly state: string;
}) {
  const query = new URLSearchParams(input).toString();
  return request(
    `/api/workspace/connected-work/google/callback?${query}`,
    "GET",
    undefined,
    z
      .object({
        mode: z.enum(["synthetic", "live"]),
        synthetic: z.boolean(),
        connected: z.literal(true),
        synchronizedProviders: z.array(z.enum(["GOOGLE_GMAIL", "GOOGLE_CALENDAR"])),
      })
      .strict(),
  );
}

export async function disconnectGoogleConnection() {
  return request(
    "/api/workspace/connected-work/google",
    "DELETE",
    undefined,
    z
      .object({
        mode: z.enum(["synthetic", "live"]),
        synthetic: z.boolean(),
        connected: z.literal(false),
      })
      .strict(),
  );
}

export async function setContextExclusion(id: string, excluded: boolean) {
  return request(
    `/api/workspace/connected-work/items/${UuidSchema.parse(id)}/exclusion`,
    "PATCH",
    { excluded },
    z.object({ id: UuidSchema, excluded: z.boolean() }).strict(),
  );
}

export async function setContextSourceExclusion(id: string, excluded: boolean) {
  return request(
    `/api/workspace/connected-work/items/${UuidSchema.parse(id)}/source-exclusion`,
    "PATCH",
    { excluded },
    z.object({ id: UuidSchema, sourceExcluded: z.boolean() }).strict(),
  );
}

export async function linkContextProject(input: {
  readonly id: string;
  readonly projectId: string;
  readonly reason: string;
}) {
  return request(
    `/api/workspace/connected-work/items/${UuidSchema.parse(input.id)}/project-link`,
    "PUT",
    { projectId: UuidSchema.parse(input.projectId), reason: input.reason },
    z.object({ id: UuidSchema, projectId: UuidSchema, linked: z.literal(true) }).strict(),
  );
}

export async function unlinkContextProject(input: {
  readonly id: string;
  readonly reason: string;
}) {
  return request(
    `/api/workspace/connected-work/items/${UuidSchema.parse(input.id)}/project-link`,
    "DELETE",
    { reason: input.reason },
    z.object({ id: UuidSchema, linked: z.literal(false) }).strict(),
  );
}

async function request<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("CONNECTED_CONTEXT_REQUEST_FAILED");
  return schema.parse(await response.json());
}
