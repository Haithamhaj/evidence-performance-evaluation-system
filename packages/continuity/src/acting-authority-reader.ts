/* eslint-disable no-unused-vars */
import { z } from "zod";

const Query = z
  .object({
    actorId: z.string().min(1),
    action: z.string().trim().min(1),
    resourceId: z.string().min(1),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ActingAuthority = Readonly<{
  delegationId: string;
  actorId: string;
  scopeType: "project" | "workstream";
  scopeId: string;
  action: string;
  startsAt: string;
  endsAt: string;
}>;

export interface ActingAuthoritySource {
  findActiveCandidates(actorId: string): Promise<readonly ActingAuthority[]>;
}

export class ActingAuthorityReader {
  constructor(private readonly source: ActingAuthoritySource) {}

  async readAt(input: unknown): Promise<ActingAuthority | null> {
    const parsed = Query.parse(input);
    const occurredAt = Date.parse(parsed.occurredAt);
    const candidates = await this.source.findActiveCandidates(parsed.actorId);
    return (
      candidates.find(
        (authority) =>
          authority.actorId === parsed.actorId &&
          authority.action === parsed.action &&
          authority.scopeId === parsed.resourceId &&
          Date.parse(authority.startsAt) <= occurredAt &&
          occurredAt < Date.parse(authority.endsAt),
      ) ?? null
    );
  }
}

export class PrismaActingAuthoritySource implements ActingAuthoritySource {
  constructor(private readonly database: import("@evaluation/database").DatabaseClient) {}

  async findActiveCandidates(actorId: string): Promise<readonly ActingAuthority[]> {
    const rows = await this.database.delegationScope.findMany({
      where: {
        responsibilityWindowId: { not: null },
        delegation: { delegateId: actorId, state: "ACTIVE" },
      },
      include: {
        delegation: {
          include: { periods: { orderBy: [{ startsAt: "asc" }, { id: "asc" }] } },
        },
        responsibilityWindow: { select: { id: true, startsAt: true, endsAt: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.flatMap((row) => {
      const period = row.delegation.periods[0];
      const lastPeriod = row.delegation.periods.at(-1);
      const window = row.responsibilityWindow;
      const scopeId = row.projectId ?? row.workstreamId;
      if (!period || !lastPeriod || !window || !scopeId || window.endsAt === null) return [];
      return [
        {
          delegationId: row.delegationId,
          actorId,
          scopeType: row.projectId ? ("project" as const) : ("workstream" as const),
          scopeId,
          action: row.action,
          startsAt: later(period.startsAt, window.startsAt).toISOString(),
          endsAt: lastPeriod.endsAt.toISOString(),
        },
      ];
    });
  }
}

function later(left: Date, right: Date) {
  return left > right ? left : right;
}
