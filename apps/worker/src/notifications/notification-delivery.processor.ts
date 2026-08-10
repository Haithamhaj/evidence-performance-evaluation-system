export const NOTIFICATION_DELIVERY_SERVICE = Symbol("NOTIFICATION_DELIVERY_SERVICE");

export class NotificationDeliveryProcessor {
  private readonly delivery: import("@evaluation/notifications").NotificationDeliveryService;

  constructor(delivery: import("@evaluation/notifications").NotificationDeliveryService) {
    this.delivery = delivery;
  }

  process(job: Readonly<{ intentId: string; correlationId: string }>) {
    return this.delivery.deliver(job.intentId, job.correlationId);
  }
}
