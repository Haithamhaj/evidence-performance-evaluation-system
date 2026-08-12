type Database = import("@evaluation/database").DatabaseClient;

export class AuthoritativeExperienceRecipientAuthorizer {
  private readonly database: Database;
  private readonly now: () => Date;

  constructor(database: Database, now: () => Date = () => new Date()) {
    this.database = database;
    this.now = now;
  }

  async authorize(
    input: Parameters<
      import("./experience-event-runtime.js").ExperienceRecipientAuthorizer["authorize"]
    >[0],
  ) {
    if (input.entityRefs.length !== 1) return false;
    const [entity] = input.entityRefs;
    if (!entity) return false;
    if (input.originatingDomain === "work_items" && entity.entityType === "private_inbox_item") {
      return Boolean(
        await this.database.privateInboxItem.findFirst({
          where: {
            id: entity.entityId,
            employeeId: input.recipientId,
            version: entity.version,
            employee: { active: true },
          },
          select: { id: true },
        }),
      );
    }
    if (input.originatingDomain === "work_items" && entity.entityType === "work_item") {
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
                    startsAt: { lte: this.now() },
                    OR: [{ endsAt: null }, { endsAt: { gt: this.now() } }],
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
