export type CriteriaDatabase = import("@evaluation/database").DatabaseClient;
export type CriteriaTransaction = import("@evaluation/database").DatabaseTransaction;
export type CriteriaAuditWriter = import("@evaluation/contracts").AuditWriter<CriteriaTransaction>;
export type CriteriaAiRouter = Pick<
  import("@evaluation/ai-routing").AiRouter<CriteriaTransaction>,
  "run"
>;

export type CriteriaKind = "project" | "workstream";
export type ContributorResponse = "acknowledge" | "object";
export type ManagerResolution = "request_revision" | "accept_with_objections";
export type CriteriaProposalState =
  | "owner_review"
  | "contributor_review"
  | "manager_resolution"
  | "approved"
  | "rejected"
  | "superseded"
  | "activated";
