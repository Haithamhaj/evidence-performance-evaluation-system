import { CriteriaEvaluationFactReader } from "@evaluation/criteria";
import { createDatabaseClient } from "@evaluation/database";
import { EvaluationFactViewService } from "@evaluation/evaluation-preparation";
import { ProjectEvaluationFactReader } from "@evaluation/projects";
import { ResearchEvaluationFactReader } from "@evaluation/research-experiments";
import { UpdateEvidenceEvaluationFactReader } from "@evaluation/updates-evidence";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { EvaluationEligibilityCoverageReader } from "./evaluation-eligibility-coverage-reader.js";
import { EvaluationFactViewController } from "./evaluation-fact-view.controller.js";
import {
  EVALUATION_PREPARATION_DATABASE,
  EvaluationFactViewPolicyGuard,
} from "./evaluation-fact-view-policy.guard.js";

const EVALUATION_PREPARATION_DATABASE_LIFECYCLE = Symbol(
  "EVALUATION_PREPARATION_DATABASE_LIFECYCLE",
);

export class EvaluationPreparationModule {}

Module({
  imports: [AuthModule],
  controllers: [EvaluationFactViewController],
  providers: [
    {
      provide: EVALUATION_PREPARATION_DATABASE,
      useFactory: () => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) throw new Error("DATABASE_URL must be configured");
        return createDatabaseClient(url);
      },
    },
    {
      provide: EVALUATION_PREPARATION_DATABASE_LIFECYCLE,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => ({
        onModuleDestroy: () => client.$disconnect(),
      }),
      inject: [EVALUATION_PREPARATION_DATABASE],
    },
    {
      provide: EvaluationFactViewService,
      useFactory: (client: ReturnType<typeof createDatabaseClient>) => {
        const projectReader = new ProjectEvaluationFactReader(client);
        return new EvaluationFactViewService([
          projectReader,
          new UpdateEvidenceEvaluationFactReader(client),
          new CriteriaEvaluationFactReader(client, projectReader),
          new EvaluationEligibilityCoverageReader(client),
          new ResearchEvaluationFactReader(client),
        ]);
      },
      inject: [EVALUATION_PREPARATION_DATABASE],
    },
    EvaluationFactViewPolicyGuard,
  ],
})(EvaluationPreparationModule);
