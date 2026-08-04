import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";
import { createProjectService } from "@evaluation/projects";
import {
  PrivateInboxQueryService,
  PrivateInboxService,
  WorkItemQueryService,
  WorkItemService,
} from "@evaluation/work-items";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PrivateInboxController } from "./private-inbox.controller.js";
import { WorkItemsController } from "./work-items.controller.js";
import { WorkItemsPolicyGuard } from "./work-items-policy.guard.js";

const WORK_ITEMS_DATABASE = Symbol("WORK_ITEMS_DATABASE");
const WORK_ITEMS_DATABASE_LIFECYCLE = Symbol("WORK_ITEMS_DATABASE_LIFECYCLE");

export class WorkItemsModule {}

Module({
  imports: [AuthModule],
  controllers: [WorkItemsController, PrivateInboxController],
  providers: [
    {
      provide: WORK_ITEMS_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: WorkItemService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new WorkItemService(
          client,
          databaseAuditWriter as never,
          () => new Date(),
          createProjectService(client, databaseAuditWriter as never),
        ),
      inject: [WORK_ITEMS_DATABASE],
    },
    {
      provide: WorkItemQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new WorkItemQueryService(client),
      inject: [WORK_ITEMS_DATABASE],
    },
    {
      provide: PrivateInboxService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new PrivateInboxService(client, databaseAuditWriter as never),
      inject: [WORK_ITEMS_DATABASE],
    },
    {
      provide: PrivateInboxQueryService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        new PrivateInboxQueryService(client),
      inject: [WORK_ITEMS_DATABASE],
    },
    {
      provide: WORK_ITEMS_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [WORK_ITEMS_DATABASE],
    },
    WorkItemsPolicyGuard,
  ],
  exports: [WorkItemQueryService, PrivateInboxQueryService],
})(WorkItemsModule);
