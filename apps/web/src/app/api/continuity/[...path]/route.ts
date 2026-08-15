import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  WebDelegationApprovalSchema,
  WebDelegationConfirmationSchema,
  WebHandoverConfirmationSchema,
  WebHandoverRevisionSchema,
  WebLeaveDecisionSchema,
  WebReturnConfirmationSchema,
  WebReturnDraftSchema,
  WebReturnFinalizationSchema,
  WebSubmitLeaveSchema,
} from "../../../../platform/continuity-contracts";
import { fetchProtectedUpstream, safeWorkspaceError } from "../../../../platform/workspace-api";

type Context = Readonly<{ params: Promise<{ path: string[] }> }>;
const Uuid = z.string().uuid();
const Receipt = z.object({}).passthrough();
const Empty = z.object({}).strict();

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
  if (parts.length === 2 && parts[0] === "delegations" && parts[1] === "approve") {
    return {
      kind: "delegationApproval" as const,
      upstream: "/api/v1/continuity/delegations/approve",
    };
  }
  if (parts.length === 2 && parts[0] === "delegations" && parts[1] === "confirm") {
    return {
      kind: "delegationConfirmation" as const,
      upstream: "/api/v1/continuity/delegations/confirm",
    };
  }
  if (
    parts.length === 3 &&
    parts[0] === "delegations" &&
    ["activate", "expire"].includes(parts[2]!)
  ) {
    return {
      kind: "delegationTransition" as const,
      upstream: `/api/v1/continuity/delegations/${Uuid.parse(parts[1])}/${parts[2]}`,
    };
  }
  if (parts.length === 3 && parts[0] === "delegations" && parts[2] === "return") {
    return {
      kind: "returnDraft" as const,
      upstream: `/api/v1/continuity/delegations/${Uuid.parse(parts[1])}/return`,
    };
  }
  if (
    parts.length === 4 &&
    parts[0] === "delegations" &&
    parts[2] === "return" &&
    ["confirm", "finalize"].includes(parts[3]!)
  ) {
    return {
      kind:
        parts[3] === "confirm" ? ("returnConfirmation" as const) : ("returnFinalization" as const),
      upstream: `/api/v1/continuity/delegations/${Uuid.parse(parts[1])}/return/${parts[3]}`,
    };
  }
  throw Object.assign(new Error("not_found"), {
    status: 404,
    messageKey: "errors.notFound",
    correlationId: randomUUID(),
  });
}

function parse(kind: Awaited<ReturnType<typeof route>>["kind"], body: unknown) {
  if (kind === "leave") return WebSubmitLeaveSchema.parse(body);
  if (kind === "decision") return WebLeaveDecisionSchema.parse(body);
  if (kind === "handover") return WebHandoverConfirmationSchema.parse(body);
  if (kind === "revision") return WebHandoverRevisionSchema.parse(body);
  if (kind === "delegationApproval") return WebDelegationApprovalSchema.parse(body);
  if (kind === "delegationConfirmation") return WebDelegationConfirmationSchema.parse(body);
  if (kind === "delegationTransition") return Empty.parse(body);
  if (kind === "returnDraft") return WebReturnDraftSchema.parse(body);
  if (kind === "returnConfirmation") return WebReturnConfirmationSchema.parse(body);
  return WebReturnFinalizationSchema.parse(body);
}
