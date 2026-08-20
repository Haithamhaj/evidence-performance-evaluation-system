type ReceiptReader = Pick<
  import("../operations/experience-event-runtime.js").ExperienceEventRuntime,
  "listWhatChanged"
>;

export type ExperienceStreamNotification = Readonly<{
  cursor: string;
  event: "experience.changed";
  data: Readonly<{ cursor: string }>;
}>;

/**
 * Owns the authorized cursor for one live connection. The durable receipt
 * reader remains the source of truth; SSE only wakes the browser to replay it.
 */
export class ExperienceStreamSession {
  private readonly reader: ReceiptReader;
  private readonly actorId: string;
  private cursor: string | null;

  constructor(reader: ReceiptReader, actorId: string, afterCursor: string | null) {
    this.reader = reader;
    this.actorId = actorId;
    this.cursor = afterCursor;
  }

  async read(): Promise<readonly ExperienceStreamNotification[]> {
    const projection = await this.reader.listWhatChanged({
      actorId: this.actorId,
      afterCursor: this.cursor,
    });
    const notifications: ExperienceStreamNotification[] = [];

    for (const item of projection.items) {
      if (this.cursor !== null && BigInt(item.cursor) <= BigInt(this.cursor)) continue;
      this.cursor = item.cursor;
      notifications.push({
        cursor: item.cursor,
        event: "experience.changed",
        data: { cursor: item.cursor },
      });
    }

    return notifications;
  }
}
