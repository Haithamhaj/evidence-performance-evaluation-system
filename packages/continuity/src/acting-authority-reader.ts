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
