export type AuditActor =
  Readonly<{ kind: "human"; id: string }> | Readonly<{ kind: "service"; id: "bootstrap" }>;

export type AuditScopeType =
  "system" | "organization" | "department" | "project" | "workstream" | "cycle";

export type AuditSource = "api" | "worker" | "seed" | "admin_replay";

export interface AuditEventInput {
  readonly eventType: string;
  readonly actor: AuditActor;
  readonly effectiveSubjectId: string;
  readonly scopeType: AuditScopeType;
  readonly scopeId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly reason?: string | undefined;
  readonly safeDiff?: Readonly<Record<string, unknown>> | undefined;
  readonly correlationId: string;
  readonly source: AuditSource;
}

export interface AuditEventRef {
  readonly id: string;
  readonly createdAt: string;
}

export interface AuditWriter<TTransaction> {
  append(transaction: TTransaction, input: AuditEventInput): Promise<AuditEventRef>;
}
