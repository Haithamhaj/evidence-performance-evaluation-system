import {
  AppError,
  ListPrivateInboxInputSchema,
  PrivateInboxItemSchema,
} from "@evaluation/contracts";
import { z } from "zod";

type DatabaseClient = import("@evaluation/database").DatabaseClient;

const ActorSchema = z.object({ userId: z.string().uuid(), active: z.boolean() }).strict();
const ListCommandSchema = z
  .object({
    actor: ActorSchema,
    input: ListPrivateInboxInputSchema,
  })
  .strict();

export class PrivateInboxQueryService {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async list(command: unknown): Promise<{
    items: import("@evaluation/contracts").PrivateInboxItem[];
    nextCursor: string | null;
  }> {
    const parsed = ListCommandSchema.parse(command);
    if (!parsed.actor.active) throw forbiddenError();
    const rows = await this.client.privateInboxItem.findMany({
      where: {
        employeeId: parsed.actor.userId,
        status: parsed.input.status,
        ...(parsed.input.cursor === null ? {} : { id: { lt: parsed.input.cursor } }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsed.input.limit + 1,
    });
    const hasMore = rows.length > parsed.input.limit;
    const visible = hasMore ? rows.slice(0, parsed.input.limit) : rows;
    return {
      items: visible.map(serializeInboxItem),
      nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
    };
  }
}

export function serializeInboxItem(item: {
  id: string;
  employeeId: string;
  text: string;
  projectId: string | null;
  status: import("@evaluation/contracts").PrivateInboxStatus;
  promotedWorkItemId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): import("@evaluation/contracts").PrivateInboxItem {
  return PrivateInboxItemSchema.parse({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  });
}

export function forbiddenError(): AppError {
  return new AppError("PRIVATE_INBOX_FORBIDDEN", "errors.privateInbox.forbidden", 403);
}
