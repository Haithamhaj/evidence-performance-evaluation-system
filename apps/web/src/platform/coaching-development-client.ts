import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";

const ActionSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    state: z.string(),
    targetDate: z.string().nullable(),
  })
  .passthrough();
export async function fetchDevelopmentAction(input: { actionId: string }) {
  const token = sessionAccessToken(
    (await cookies()).get(OIDC_SESSION_COOKIE)?.value ?? "",
    oidcSettings(),
  );
  const base = process.env.INTERNAL_API_BASE_URL?.replace(/\/$/u, "");
  if (!base) throw new Error("INTERNAL_API_BASE_URL must be configured");
  const response = await fetch(`${base}/api/v1/coaching/actions/${input.actionId}`, {
    cache: "no-store",
    headers: { authorization: `Bearer ${token}`, "x-correlation-id": randomUUID() },
  });
  if (!response.ok) throw new Error(`Development action request failed: ${response.status}`);
  return ActionSchema.parse(await response.json());
}
