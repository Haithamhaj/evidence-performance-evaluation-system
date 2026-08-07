/* eslint-disable no-unused-vars */
export class AuthoritativeOperationsEventPublisher {
  constructor(
    private readonly database: import("@evaluation/database").DatabaseClient,
    private readonly events: import("@evaluation/notifications").NotificationEventProducer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async publishDueCheckIns(
    recipientId: string,
    obligations: readonly Readonly<{
      workstreamId: string;
      weekStartsAt: string;
      state: string;
    }>[],
  ) {
    await Promise.all(
      obligations
        .filter(({ state }) => state === "required")
        .map((obligation) =>
          this.events.publish({
            type: "CHECK_IN_DUE",
            eventId: `check-in:${recipientId}:${obligation.workstreamId}:${obligation.weekStartsAt}`,
            eventVersion: 1,
            recipientId,
            obligationId: obligation.workstreamId,
            dueAt: new Date(
              new Date(obligation.weekStartsAt).getTime() + 4 * 24 * 60 * 60 * 1_000,
            ).toISOString(),
          }),
        ),
    );
  }

  async publishReassignments(caseIds: readonly string[]) {
    if (caseIds.length === 0) return;
    const items = await this.database.reassignmentQueueItem.findMany({
      where: { caseId: { in: [...caseIds] }, state: "REASSIGNMENT_REQUIRED" },
      select: { caseId: true, departmentId: true },
    });
    for (const item of items) {
      const managers = await this.database.roleAssignment.findMany({
        where: {
          role: "manager",
          scopeType: "department",
          scope: { departmentId: item.departmentId },
          user: { active: true },
        },
        select: { userId: true },
      });
      await Promise.all(
        managers.map(({ userId }) =>
          this.events.publish({
            type: "REASSIGNMENT_REQUIRED",
            eventId: `reassignment:${item.caseId}`,
            eventVersion: 1,
            recipientId: userId,
            caseId: item.caseId,
            occurredAt: this.now().toISOString(),
          }),
        ),
      );
    }
  }

  async publishHealth(
    recipientId: string,
    health: Readonly<{
      dependencies: readonly Readonly<{ dependency: string; state: string }>[];
    }>,
  ) {
    const supported = new Set([
      "WORKER",
      "QUEUE",
      "OBJECT_STORAGE",
      "OIDC",
      "AI_ROUTE",
      "CONNECTOR",
      "EMAIL",
      "BACKUP",
    ]);
    await Promise.all(
      health.dependencies
        .filter(({ dependency, state }) => state === "ACTION_REQUIRED" && supported.has(dependency))
        .map(({ dependency }) =>
          this.events.publish({
            type: "SYSTEM_HEALTH_ACTION_REQUIRED",
            eventId: `system-health:${dependency}:${this.now().toISOString().slice(0, 10)}`,
            eventVersion: 1,
            recipientId,
            dependency,
            occurredAt: this.now().toISOString(),
          }),
        ),
    );
  }
}
