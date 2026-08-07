import type { NotificationCategory } from "@evaluation/contracts";

const REQUIRED_EMAIL_CATEGORIES = new Set<NotificationCategory>([
  "SECURITY_ALERT",
  "REASSIGNMENT_ACTION",
]);

export class NotificationPreferenceService {
  private readonly database: import("@evaluation/database").DatabaseClient;

  constructor(database: import("@evaluation/database").DatabaseClient) {
    this.database = database;
  }

  async set(
    input: Readonly<{ recipientId: string; category: NotificationCategory; emailEnabled: boolean }>,
  ) {
    return this.database.notificationPreference.upsert({
      where: {
        recipientId_category: { recipientId: input.recipientId, category: input.category },
      },
      update: { emailEnabled: input.emailEnabled, version: { increment: 1 } },
      create: input,
    });
  }

  async emailAllowed(recipientId: string, category: NotificationCategory) {
    if (REQUIRED_EMAIL_CATEGORIES.has(category)) return true;
    const preference = await this.database.notificationPreference.findUnique({
      where: { recipientId_category: { recipientId, category } },
    });
    return preference?.emailEnabled ?? true;
  }
}

export const PILOT_NOTIFICATION_SCHEDULES = Object.freeze([
  {
    schemaVersion: 1 as const,
    key: "THURSDAY_CHECK_IN" as const,
    timezone: "Asia/Riyadh" as const,
    cron: "0 9 * * 4",
    version: 1,
  },
  {
    schemaVersion: 1 as const,
    key: "MONTHLY_READINESS" as const,
    timezone: "Asia/Riyadh" as const,
    cron: "0 9 1 * *",
    version: 1,
  },
]);
