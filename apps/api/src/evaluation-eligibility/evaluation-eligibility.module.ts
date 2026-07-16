import { Module } from "@nestjs/common";

import { databaseAuditWriter } from "@evaluation/audit";
import { createDatabaseClient } from "@evaluation/database";

import { createEligibilityService, EligibilityService } from "./eligibility.service.js";

const ELIGIBILITY_DATABASE = Symbol("ELIGIBILITY_DATABASE");
const ELIGIBILITY_DATABASE_LIFECYCLE = Symbol("ELIGIBILITY_DATABASE_LIFECYCLE");

export class EvaluationEligibilityModule {}

Module({
  providers: [
    {
      provide: ELIGIBILITY_DATABASE,
      useFactory: () => createDatabaseClient(process.env.DATABASE_URL ?? ""),
    },
    {
      provide: ELIGIBILITY_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [ELIGIBILITY_DATABASE],
    },
    {
      provide: EligibilityService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) =>
        createEligibilityService(client, databaseAuditWriter as never),
      inject: [ELIGIBILITY_DATABASE],
    },
  ],
  exports: [EligibilityService],
})(EvaluationEligibilityModule);
