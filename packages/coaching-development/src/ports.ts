export type CoachingFact = Readonly<{
  sourceId: string;
  kind:
    | "EVIDENCE"
    | "UPDATE"
    | "RESEARCH"
    | "EXPERIMENT"
    | "EVALUATION_FACT"
    | "MANAGER_FEEDBACK_THEME";
  text: string;
}>;

export interface CoachingFactReader {
  readEmployeeFacts(
    input: Readonly<{ employeeId: string; startsAt: string; endsAt: string }>,
  ): Promise<readonly CoachingFact[]>;
}

export interface CoachingRepository {
  createInsight(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  findInsight(id: string): Promise<Record<string, unknown> | null>;
  appendInsightDecision(input: Record<string, unknown>): Promise<void>;
}

export interface CoachingAuditWriter {
  append(transaction: unknown, event: Record<string, unknown>): Promise<void>;
}
