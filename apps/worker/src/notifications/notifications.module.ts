import { Module } from "@nestjs/common";

import { createDatabaseClient } from "@evaluation/database";
import {
  InMemoryEmailAdapter,
  NotificationDeliveryService,
  NotificationPreferenceService,
} from "@evaluation/notifications";

import {
  NOTIFICATION_DELIVERY_SERVICE,
  NotificationDeliveryProcessor,
} from "./notification-delivery.processor.js";

export class NotificationsWorkerModule {}

Module({
  providers: [
    {
      provide: NOTIFICATION_DELIVERY_SERVICE,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL?.trim();
        if (!databaseUrl) throw new Error("DATABASE_URL is required for notification delivery");
        const database = createDatabaseClient(databaseUrl);
        return new NotificationDeliveryService(
          database,
          new NotificationPreferenceService(database),
          new InMemoryEmailAdapter(),
        );
      },
    },
    {
      provide: NotificationDeliveryProcessor,
      inject: [NOTIFICATION_DELIVERY_SERVICE],
      useFactory: (delivery: NotificationDeliveryService) =>
        new NotificationDeliveryProcessor(delivery),
    },
  ],
  exports: [NotificationDeliveryProcessor],
})(NotificationsWorkerModule);
