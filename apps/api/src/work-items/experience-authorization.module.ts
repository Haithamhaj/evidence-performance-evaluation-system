import { Module } from "@nestjs/common";

import { createDatabaseClient } from "@evaluation/database";
import { WorkItemsExperienceRecipientAuthorizer } from "@evaluation/work-items";

const EXPERIENCE_AUTHORIZATION_DATABASE = Symbol("EXPERIENCE_AUTHORIZATION_DATABASE");
const EXPERIENCE_AUTHORIZATION_LIFECYCLE = Symbol("EXPERIENCE_AUTHORIZATION_LIFECYCLE");

export class WorkItemsExperienceAuthorizationModule {}

Module({
  providers: [
    {
      provide: EXPERIENCE_AUTHORIZATION_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: WorkItemsExperienceRecipientAuthorizer,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new WorkItemsExperienceRecipientAuthorizer(client),
      inject: [EXPERIENCE_AUTHORIZATION_DATABASE],
    },
    {
      provide: EXPERIENCE_AUTHORIZATION_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [EXPERIENCE_AUTHORIZATION_DATABASE],
    },
  ],
  exports: [WorkItemsExperienceRecipientAuthorizer],
})(WorkItemsExperienceAuthorizationModule);
