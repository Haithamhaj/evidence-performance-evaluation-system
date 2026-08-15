import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  WebHandoverConfirmationSchema,
  WebHandoverRevisionSchema,
  WebLeaveDecisionSchema,
  WebSubmitLeaveSchema,
} from "../../../../platform/continuity-contracts";
import { fetchProtectedUpstream, safeWorkspaceError } from "../../../../platform/workspace-api";

type Context = Readonly<{ params: Promise<{ path: string[] }> }>;
const Uuid = z.string().uuid();
const Receipt = z.object({}).passthrough();

export async function POST(request: Request, context: Context) {
  try {
    const path = await route(await context.params);
    const body = await request.json();
    const parsed = parse(path.kind, body);
    const result = await fetchProtectedUpstream({
      path: path.upstream,
      schema: Receipt,
      method: "POST",
      body: parsed,
    });
    return NextResponse.json(result);
  } catch (error) {
    const safe = safeWorkspaceError(error);
    return NextResponse.json(safe, { status: safe.status });
  }
}

async function route(input: { path: string[] }) {
  const parts = input.path;
  if (parts.length === 1 && parts[0] === "leaves") {
    return { kind: "leave" as const, upstream: "/api/v1/continuity/leaves" };
  }
  if (parts.length === 3 && parts[0] === "leaves" && parts[2] === "decision") {
    return {
      kind: "decision" as const,
      upstream: `/api/v1/continuity/leaves/${Uuid.parse(parts[1])}/decision`,
    };
  }
  if (parts.length === 3 && parts[0] === "handovers" && parts[2] === "confirm") {
    return {
      kind: "handover" as const,
      upstream: `/api/v1/continuity/handovers/${Uuid.parse(parts[1])}/confirm`,
    };
  }
  if (parts.length === 3 && parts[0] === "handovers" && parts[2] === "revisions") {
    return {
      kind: "revision" as const,
      upstream: `/api/v1/continuity/handovers/${Uuid.parse(parts[1])}/revisions`,
    };
  }
  throw Object.assign(new Error("not_found"), {
    status: 404,
    messageKey: "errors.notFound",
    correlationId: randomUUID(),
  });
}

function parse(kind: "leave" | "decision" | "handover" | "revision", body: unknown) {
  if (kind === "leave") return WebSubmitLeaveSchema.parse(body);
  if (kind === "decision") return WebLeaveDecisionSchema.parse(body);
  if (kind === "handover") return WebHandoverConfirmationSchema.parse(body);
  return WebHandoverRevisionSchema.parse(body);
}
