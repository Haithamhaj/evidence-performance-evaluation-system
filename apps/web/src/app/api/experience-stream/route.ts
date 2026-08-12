import { NextResponse } from "next/server";

import {
  ExperienceStreamProxyError,
  openExperienceStream,
} from "../../../server/experience-stream/open-experience-stream";

export const dynamic = "force-dynamic";

const CURSOR_PATTERN = /^[1-9]\d*$/u;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => key !== "afterCursor") || keys.length > 1) return notFound();
  const afterCursor = url.searchParams.get("afterCursor");
  const lastEventId = request.headers.get("last-event-id");
  if (
    (afterCursor !== null && !CURSOR_PATTERN.test(afterCursor)) ||
    (lastEventId !== null && !CURSOR_PATTERN.test(lastEventId))
  ) {
    return notFound();
  }

  try {
    const upstream = await openExperienceStream({
      afterCursor,
      lastEventId,
      signal: request.signal,
    });
    if (!upstream.ok || upstream.body === null) {
      const status = [401, 403, 503].includes(upstream.status) ? upstream.status : 503;
      return NextResponse.json({ messageKey: "errors.internal" }, { status });
    }
    return new Response(upstream.body, {
      headers: {
        "cache-control": "no-cache, no-transform",
        "content-type": "text/event-stream",
        "x-accel-buffering": "no",
      },
      status: 200,
    });
  } catch (error) {
    if (error instanceof ExperienceStreamProxyError) {
      return NextResponse.json(
        { correlationId: error.correlationId, messageKey: "errors.internal" },
        { status: error.status },
      );
    }
    return NextResponse.json({ messageKey: "errors.internal" }, { status: 503 });
  }
}

function notFound() {
  return NextResponse.json({ messageKey: "errors.notFound" }, { status: 404 });
}
