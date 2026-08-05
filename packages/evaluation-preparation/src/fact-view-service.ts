import { AppError, EvaluationFactViewSchema, type EvaluationFactView } from "@evaluation/contracts";

import {
  normalizeEvaluationFactSources,
  type EvaluationFactSourceBundle,
} from "./fact-normalizer.js";

export type AuthorizedEvaluationActor = Readonly<{
  actorId: string;
  subjectEmployeeId: string;
  access: "self" | "assigned_manager";
  active: true;
}>;

export type EvaluationSourceReadInput = Readonly<{
  cycleId: string;
  subjectEmployeeId: string;
  cycleStart: string;
  cycleEnd: string;
  requester: AuthorizedEvaluationActor;
}>;

export interface EvaluationSourceReader {
  readAuthorizedFacts(input: EvaluationSourceReadInput): Promise<EvaluationFactSourceBundle>;
}

export type ReadEvaluationFactViewInput = Readonly<{
  cycle: EvaluationFactView["cycle"];
  subjectEmployeeId: string;
  requester: AuthorizedEvaluationActor;
}>;

export class EvaluationFactViewService {
  private readonly readers: readonly EvaluationSourceReader[];
  private readonly clock: () => Date;

  constructor(readers: readonly EvaluationSourceReader[], clock: () => Date = () => new Date()) {
    this.readers = readers;
    this.clock = clock;
  }

  async read(input: ReadEvaluationFactViewInput): Promise<Readonly<EvaluationFactView>> {
    assertAuthorizedRequest(input);
    const generatedAt = this.clock();
    if (!Number.isFinite(generatedAt.getTime())) {
      throw new Error("Evaluation Fact View clock returned an invalid date");
    }
    const bundles = await Promise.all(
      this.readers.map((reader) =>
        reader.readAuthorizedFacts({
          cycleId: input.cycle.id,
          subjectEmployeeId: input.subjectEmployeeId,
          cycleStart: input.cycle.startsAt,
          cycleEnd: input.cycle.endsAt,
          requester: input.requester,
        }),
      ),
    );
    const normalized = normalizeEvaluationFactSources(input.cycle, bundles);
    const view = EvaluationFactViewSchema.parse({
      schemaVersion: 1,
      cycle: input.cycle,
      subjectEmployeeId: input.subjectEmployeeId,
      generatedAt: generatedAt.toISOString(),
      ...normalized,
    });
    return deepFreeze(view);
  }
}

function assertAuthorizedRequest(input: ReadEvaluationFactViewInput): void {
  if (!input.requester.active || input.requester.subjectEmployeeId !== input.subjectEmployeeId) {
    throw authorizationError();
  }
  if (input.requester.access === "self" && input.requester.actorId !== input.subjectEmployeeId) {
    throw authorizationError();
  }
}

function authorizationError(): AppError {
  return new AppError("AUTHZ_SCOPE", "errors.authorization.denied", 403);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
