import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it, vi } from "vitest";

import {
  ActivationService,
  CriteriaVersionResolver,
  ProposalService,
  RevisionService,
  WorkstreamReviewService,
} from "@evaluation/criteria";
import { ComparisonService, ReadinessService } from "@evaluation/documents";

import {
  AnalysisCriteriaModule,
  createAnalysisCriteriaApiServices,
  createTransactionalAnalysisOutbox,
} from "./analysis-criteria.module.js";
import { AnalysisJobEnqueuer } from "./analysis-job-enqueuer.js";
import { CriteriaController } from "./criteria.controller.js";
import { DocumentAnalysisController } from "./document-analysis.controller.js";

describe("AnalysisCriteriaModule", () => {
  it("composes only API request/read services and both guarded controllers", () => {
    const services = createAnalysisCriteriaApiServices({} as never, {
      enqueue: vi.fn(async () => "queued"),
    });

    expect(services.jobs).toBeInstanceOf(AnalysisJobEnqueuer);
    expect(services.readiness).toBeInstanceOf(ReadinessService);
    expect(services.comparisons).toBeInstanceOf(ComparisonService);
    expect(services.proposals).toBeInstanceOf(ProposalService);
    expect(services.reviews).toBeInstanceOf(WorkstreamReviewService);
    expect(services.activation).toBeInstanceOf(ActivationService);
    expect(services.revisions).toBeInstanceOf(RevisionService);
    expect(services.versions).toBeInstanceOf(CriteriaVersionResolver);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AnalysisCriteriaModule)).toEqual([
      DocumentAnalysisController,
      CriteriaController,
    ]);
  });

  it("writes the enqueue receipt through the caller's transaction so rollback removes it", async () => {
    const durable: unknown[] = [];
    const database = {
      async transaction(work: (transaction: unknown) => Promise<unknown>) {
        const staged: unknown[] = [];
        const transaction = {
          operationEffectReceipt: {
            create: vi.fn(async (input: unknown) => {
              staged.push(input);
              return input;
            }),
          },
        };
        const result = await work(transaction);
        durable.push(...staged);
        return result;
      },
    };
    const outbox = createTransactionalAnalysisOutbox();
    const input = {
      operationId: "50000000-0000-4000-8000-000000000001",
      idempotencyKey: "proposal-v1",
      jobType: "analysis-criteria.process",
    };

    await expect(
      database.transaction(async (transaction) => {
        await outbox.append(transaction as never, input);
        throw new Error("request transaction rolled back");
      }),
    ).rejects.toThrow("rolled back");
    expect(durable).toEqual([]);

    await database.transaction((transaction) => outbox.append(transaction as never, input));
    expect(durable).toEqual([
      {
        data: {
          operationId: input.operationId,
          effectName: "outbox-enqueued",
          idempotencyKey: "outbox:proposal-v1",
          receiptReference: `analysis-criteria.process:${input.operationId}`,
        },
      },
    ]);
  });
});
