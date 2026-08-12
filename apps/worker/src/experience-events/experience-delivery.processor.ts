import { ExperienceDeliveryJobSchema } from "@evaluation/contracts";

type Database = import("@evaluation/database").DatabaseClient;

export class ExperienceDeliveryProcessor {
  private readonly database: Database;
  private readonly now: () => Date;

  constructor(database: Database, now: () => Date = () => new Date()) {
    this.database = database;
    this.now = now;
  }

  async process(input: unknown): Promise<{
    state: "delivered" | "acknowledged";
    replay: boolean;
  }> {
    const job = ExperienceDeliveryJobSchema.parse(input);
    const receipt = await this.database.workSignalReceipt.findUnique({
      where: { id: job.receiptId },
    });
    if (!receipt) throw new Error("EXPERIENCE_DELIVERY_RECEIPT_NOT_FOUND");
    if (receipt.correlationId !== job.correlationId) {
      throw new Error("EXPERIENCE_DELIVERY_CORRELATION_MISMATCH");
    }
    if (receipt.deliveryState === "acknowledged") {
      return { state: "acknowledged", replay: true };
    }
    if (receipt.deliveryState === "delivered") {
      return { state: "delivered", replay: true };
    }
    const recovered = receipt.deliveryState === "error";
    const result = await this.database.workSignalReceipt.updateMany({
      where: { id: receipt.id, deliveryState: receipt.deliveryState },
      data: {
        deliveryState: "delivered",
        deliveryAttemptCount: { increment: 1 },
        ...(recovered ? { replayCount: { increment: 1 } } : {}),
        deliveredAt: this.now(),
        lastErrorCode: null,
      },
    });
    if (result.count === 0) {
      const concurrent = await this.database.workSignalReceipt.findUnique({
        where: { id: receipt.id },
      });
      if (concurrent?.deliveryState === "acknowledged") {
        return { state: "acknowledged", replay: true };
      }
      if (concurrent?.deliveryState === "delivered") {
        return { state: "delivered", replay: true };
      }
      throw new Error("EXPERIENCE_DELIVERY_CONCURRENT_STATE_INVALID");
    }
    return { state: "delivered", replay: recovered };
  }
}
