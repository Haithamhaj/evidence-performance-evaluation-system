import "server-only";

import { z } from "zod";

import { fetchDailyWorkUpstream } from "../../platform/daily-work-api";

const PrincipalSchema = z
  .object({
    active: z.literal(true),
    roles: z.array(z.string().trim().min(1).max(100)).max(20),
    userId: z.uuid(),
  })
  .passthrough();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type PrincipalReader = () => Promise<unknown>;

export class ShellContextLoadError extends Error {
  readonly code = "SHELL_CONTEXT_UNAVAILABLE";
  readonly correlationId?: string;

  constructor(correlationId?: string) {
    super("The workspace shell could not load its authorized context");
    this.name = "ShellContextLoadError";
    if (correlationId !== undefined) this.correlationId = correlationId;
  }
}

export async function loadShellContext(reader: PrincipalReader = readCurrentPrincipal) {
  try {
    const result = PrincipalSchema.parse(await reader());
    return {
      principal: {
        active: result.active,
        roles: [...result.roles],
        userId: result.userId,
      },
    } as const;
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    throw new ShellContextLoadError(safeCorrelationId(error));
  }
}

async function readCurrentPrincipal() {
  return fetchDailyWorkUpstream({
    reauthenticateTo: "/",
    route: { kind: "me" },
    schema: { parse: (value: unknown) => value },
  });
}

function safeCorrelationId(error: unknown) {
  if (typeof error !== "object" || error === null || !("correlationId" in error)) return undefined;
  const value = error.correlationId;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : undefined;
}

function isNextRedirect(error: unknown) {
  if (!(error instanceof Error)) return false;
  const digest = "digest" in error && typeof error.digest === "string" ? error.digest : "";
  return error.message === "NEXT_REDIRECT" || digest.startsWith("NEXT_REDIRECT");
}
