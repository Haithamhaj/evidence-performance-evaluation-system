type Database = import("@evaluation/database").DatabaseClient;

export class WorkItemsExperienceRecipientAuthorizer {
  private readonly database: Database;
  private readonly now: () => Date;

  constructor(database: Database, now: () => Date = () => new Date()) {
    this.database = database;
    this.now = now;
  }

  async authorize(
    input: Readonly<{
      recipientId: string;
      entityRefs: readonly import("@evaluation/contracts").ExperienceEntityRefV1[];
      originatingDomain: import("@evaluation/contracts").WorkSignalV1["originatingDomain"];
    }>,
  ) {
    if (input.originatingDomain !== "work_items" || input.entityRefs.length !== 1) return false;
    const [entity] = input.entityRefs;
    if (!entity) return false;
    const recipient = await this.database.user.findUnique({
      where: { id: input.recipientId },
      select: { active: true },
    });
    if (recipient?.active !== true) return false;
    if (entity.entityType === "private_inbox_item") {
      return Boolean(
        await this.database.privateInboxItem.findFirst({
          where: {
            id: entity.entityId,
            employeeId: input.recipientId,
            version: entity.version,
          },
          select: { id: true },
        }),
      );
    }
    if (entity.entityType === "work_item") {
      const current = this.now();
      return Boolean(
        await this.database.workItem.findFirst({
          where: {
            id: entity.entityId,
            version: entity.version,
            OR: [
              { assigneeId: input.recipientId },
              { createdById: input.recipientId },
              {
                participants: {
                  some: {
                    employeeId: input.recipientId,
                    startsAt: { lte: current },
                    OR: [{ endsAt: null }, { endsAt: { gt: current } }],
                  },
                },
              },
            ],
          },
          select: { id: true },
        }),
      );
    }
    return false;
  }
}
