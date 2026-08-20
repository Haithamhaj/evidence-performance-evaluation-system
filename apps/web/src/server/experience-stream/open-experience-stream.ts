import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { OIDC_SESSION_COOKIE, oidcSettings, sessionAccessToken } from "../../auth/oidc";

export class ExperienceStreamProxyError extends Error {
  readonly status: 401 | 500 | 503;
  readonly correlationId: string;

  constructor(status: 401 | 500 | 503, correlationId: string) {
    super("experience stream unavailable");
    this.status = status;
    this.correlationId = correlationId;
  }
}

export async function openExperienceStream(
  input: Readonly<{
    afterCursor: string | null;
    lastEventId: string | null;
    signal: AbortSignal;
  }>,
): Promise<Response> {
  const correlationId = randomUUID();
  const baseUrl = internalApiBaseUrl(correlationId);
  let settings: ReturnType<typeof oidcSettings>;
  try {
    settings = oidcSettings();
  } catch {
    throw new ExperienceStreamProxyError(500, correlationId);
  }
  const cookieStore = await cookies();
  let accessToken: string;
  try {
    accessToken = sessionAccessToken(cookieStore.get(OIDC_SESSION_COOKIE)?.value ?? "", settings);
  } catch {
    throw new ExperienceStreamProxyError(401, correlationId);
  }

  const query =
    input.afterCursor === null ? "" : `?afterCursor=${encodeURIComponent(input.afterCursor)}`;
  try {
    return await fetch(`${baseUrl}/api/v1/experience-stream${query}`, {
      cache: "no-store",
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${accessToken}`,
        ...(input.lastEventId === null ? {} : { "last-event-id": input.lastEventId }),
        "x-correlation-id": correlationId,
      },
      signal: input.signal,
    });
  } catch {
    throw new ExperienceStreamProxyError(503, correlationId);
  }
}

function internalApiBaseUrl(correlationId: string): string {
  const configured = process.env.INTERNAL_API_BASE_URL;
  if (configured === undefined || configured.trim() === "") {
    throw new ExperienceStreamProxyError(500, correlationId);
  }
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ExperienceStreamProxyError(500, correlationId);
  }
  const originOnly =
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  const local =
    url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  const validProtocol = process.env.APP_ENV === "local" ? local : url.protocol === "https:";
  if (!originOnly || !validProtocol) throw new ExperienceStreamProxyError(500, correlationId);
  return url.origin;
}
