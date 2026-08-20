import {
  ExperienceOrchestrationJobSchema,
  PreparedExperienceCompositionSchema,
} from "@evaluation/contracts";

type Composer = Readonly<{
  compose(
    input: Readonly<{
      employeeId: string;
      correlationId: string;
      idempotencyKey: string;
    }>,
  ): Promise<unknown>;
}>;

export class ExperienceOrchestrationProcessor {
  private readonly composer: Composer;

  constructor(composer: Composer) {
    this.composer = composer;
  }

  async process(input: unknown) {
    const job = ExperienceOrchestrationJobSchema.parse(input);
    return PreparedExperienceCompositionSchema.parse(
      await this.composer.compose({
        employeeId: job.employeeId,
        correlationId: job.correlationId,
        idempotencyKey: job.idempotencyKey,
      }),
    );
  }
}

export async function processExperienceOrchestrationJob(
  processor: Pick<ExperienceOrchestrationProcessor, "process">,
  job: Readonly<{ name: string; data: unknown; discard(): void }>,
) {
  if (job.name !== "experience.prepare-next") {
    job.discard();
    throw new Error("EXPERIENCE_ORCHESTRATION_JOB_TYPE_MISMATCH");
  }
  const parsed = ExperienceOrchestrationJobSchema.safeParse(job.data);
  if (!parsed.success) {
    job.discard();
    throw new Error("EXPERIENCE_ORCHESTRATION_JOB_INVALID");
  }
  return processor.process(parsed.data);
}
