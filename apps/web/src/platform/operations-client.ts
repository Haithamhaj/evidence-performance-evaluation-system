import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../auth/oidc";

export async function operationsRequest(path: string, init: RequestInit = {}) {
  if (!/^\/[a-z0-9/:?&=._-]+$/iu.test(path)) throw new Error("Invalid operations API path");
  const token = sessionAccessToken(
    (await cookies()).get(OIDC_SESSION_COOKIE)?.value ?? "",
    oidcSettings(),
  );
  const base = process.env.INTERNAL_API_BASE_URL?.replace(/\/$/u, "");
  if (!base) throw new Error("INTERNAL_API_BASE_URL must be configured");
  const response = await fetch(`${base}/api/v1/operations${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-correlation-id": randomUUID(),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Operations request failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}
