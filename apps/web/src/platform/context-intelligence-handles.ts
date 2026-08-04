import "server-only";

import { oidcSettings, openAuthCookie, sealAuthCookie } from "../auth/oidc";

type HandlePayload = Readonly<{
  action: "project" | "project_suggestion" | "task_draft";
  id: string;
  revision?: number;
  sourceItemId?: string;
  projectId?: string;
  employeeId?: string;
  workstreamId?: string | null;
  dueAt?: string | null;
  acceptanceConditions?: readonly string[];
}>;

export function sealContextReviewHandle(input: HandlePayload): string {
  const settings = oidcSettings();
  return sealAuthCookie(
    { kind: "context_handle", expiresAt: Date.now() + 15 * 60_000, ...input },
    settings.sessionSecret,
  );
}

export function openContextReviewHandle(
  handle: string,
  action: HandlePayload["action"],
): HandlePayload {
  const settings = oidcSettings();
  const payload = openAuthCookie(handle, settings.sessionSecret, "context_handle") as Record<
    string,
    unknown
  >;
  if (
    payload.action !== action ||
    typeof payload.id !== "string" ||
    (payload.revision !== undefined && typeof payload.revision !== "number") ||
    (payload.sourceItemId !== undefined && typeof payload.sourceItemId !== "string") ||
    (payload.projectId !== undefined && typeof payload.projectId !== "string") ||
    (payload.employeeId !== undefined && typeof payload.employeeId !== "string")
  ) {
    throw new Error("CONTEXT_REVIEW_HANDLE_INVALID");
  }
  return payload as HandlePayload;
}
