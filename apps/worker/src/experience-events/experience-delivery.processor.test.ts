import { describe, expect, it, vi } from "vitest";

import { ExperienceDeliveryProcessor } from "./experience-delivery.processor.js";

const receiptId = "40000000-0000-4000-8000-000000000001";
const correlationId = "40000000-0000-4000-8000-000000000002";

function harness(initialState: "queued" | "delivered" | "acknowledged" | "error") {
  const row = {
    id: receiptId,
    correlationId,
    deliveryState: initialState,
    deliveryAttemptCount: initialState === "queued" ? 0 : 1,
    replayCount: 0,
  };
  const update = vi.fn(async ({ where, data }) => {
    const allowedState =
      typeof where.deliveryState === "string"
        ? row.deliveryState === where.deliveryState
        : where.deliveryState.in.includes(row.deliveryState);
    if (!allowedState) return { count: 0 };
    Object.assign(row, {
      ...data,
      deliveryAttemptCount:
        "increment" in (data.deliveryAttemptCount ?? {})
          ? row.deliveryAttemptCount + data.deliveryAttemptCount.increment
          : row.deliveryAttemptCount,
      replayCount:
        "increment" in (data.replayCount ?? {})
          ? row.replayCount + data.replayCount.increment
          : row.replayCount,
    });
    return { count: 1 };
  });
  const database = {
    workSignalReceipt: {
      findUnique: vi.fn(async () => row),
      updateMany: update,
    },
    $transaction: async (operation: (transaction: unknown) => unknown) => operation(database),
  };
  return {
    row,
    update,
    processor: new ExperienceDeliveryProcessor(
      database as never,
      () => new Date("2026-08-12T10:00:00.000Z"),
    ),
  };
}

const job = {
  schemaVersion: 1 as const,
  jobType: "experience.deliver" as const,
  receiptId,
  correlationId,
};

describe("ExperienceDeliveryProcessor", () => {
  it("delivers a queued receipt once and replays without duplicate effects", async () => {
    const { processor, row, update } = harness("queued");

    await expect(processor.process(job)).resolves.toEqual({ state: "delivered", replay: false });
    await expect(processor.process(job)).resolves.toEqual({ state: "delivered", replay: true });

    expect(row.deliveryAttemptCount).toBe(1);
    expect(update).toHaveBeenCalledOnce();
  });

  it("recovers a failed receipt once and records the replay transition", async () => {
    const { processor, row, update } = harness("error");

    await expect(processor.process(job)).resolves.toEqual({ state: "delivered", replay: true });
    await expect(processor.process(job)).resolves.toEqual({ state: "delivered", replay: true });

    expect(row.deliveryAttemptCount).toBe(2);
    expect(row.replayCount).toBe(1);
    expect(update).toHaveBeenCalledOnce();
  });

  it("leaves an acknowledged receipt immutable", async () => {
    const { processor, update } = harness("acknowledged");
    await expect(processor.process(job)).resolves.toEqual({ state: "acknowledged", replay: true });
    expect(update).not.toHaveBeenCalled();
  });

  it("fails closed for a mismatched correlation id", async () => {
    const { processor, update } = harness("queued");
    await expect(
      processor.process({ ...job, correlationId: "40000000-0000-4000-8000-000000000099" }),
    ).rejects.toThrow("EXPERIENCE_DELIVERY_CORRELATION_MISMATCH");
    expect(update).not.toHaveBeenCalled();
  });

  it("persists only a safe delivery error code for a retryable receipt", async () => {
    const { processor, row } = harness("queued");

    await processor.markError(job, "delivery_failed");

    expect(row).toMatchObject({ deliveryState: "error", lastErrorCode: "delivery_failed" });
    expect(JSON.stringify(row)).not.toContain("provider");
  });
});
