import { Module } from "@nestjs/common";

import {
  createExperienceDeliveryQueueProducer,
  ExperienceDeliveryQueueProducer,
} from "./experience-delivery-queue.js";

const EXPERIENCE_QUEUE_LIFECYCLE = Symbol("EXPERIENCE_QUEUE_LIFECYCLE");

export class ExperienceTransportModule {}

Module({
  providers: [
    {
      provide: ExperienceDeliveryQueueProducer,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL?.trim();
        return redisUrl
          ? createExperienceDeliveryQueueProducer(redisUrl)
          : new ExperienceDeliveryQueueProducer({
              add: async (_name, data) => ({ id: data.receiptId }),
              close: async () => undefined,
            });
      },
    },
    {
      provide: EXPERIENCE_QUEUE_LIFECYCLE,
      inject: [ExperienceDeliveryQueueProducer],
      useFactory: (queue: ExperienceDeliveryQueueProducer) => ({
        onModuleDestroy: () => queue.close(),
      }),
    },
  ],
  exports: [ExperienceDeliveryQueueProducer],
})(ExperienceTransportModule);
