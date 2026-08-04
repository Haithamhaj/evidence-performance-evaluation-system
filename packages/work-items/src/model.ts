export interface WorkItemScopeReader {
  getScope(input: {
    actorId: string;
    projectId: string;
    workstreamId: string | null;
    occurredAt: string;
  }): Promise<{ projectId: string; workstreamId: string | null; allowed: true }>;
}

export interface WorkItemReader {
  getAuthorizedWorkItem(input: {
    actorId: string;
    workItemId: string;
  }): Promise<import("@evaluation/contracts").WorkItemDetail>;
}

export type WorkItemDatabase = import("@evaluation/database").DatabaseClient;
export type WorkItemTransaction = import("@evaluation/database").DatabaseTransaction;
export type WorkItemAuditWriter = import("@evaluation/contracts").AuditWriter<WorkItemTransaction>;
