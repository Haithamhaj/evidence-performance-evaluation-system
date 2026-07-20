# Phase 2 AI-First Daily Workspace Backend Delta

**Status:** Approved production delta

**Authority:** `docs/superpowers/specs/2026-07-20-ai-first-daily-workspace-design.md`

**Execution plans:** `docs/superpowers/plans/2026-07-20-ai-first-daily-workspace-master-plan.md` and its six linked slice plans

## Purpose

This document states the smallest backend change required by the approved employee-experience reset. It preserves the existing modular monolith and adds no second identity, Project, Workstream, Task, activity, audit, queue, AI, or progress store.

## Preserved production capabilities

- OIDC sessions, deactivation, and server-side authorization.
- Projects, Workstreams, membership, responsibility windows, documents, readiness, and criteria.
- AI Router, worker, queue, audit, private uploads, and structured error model.
- Work Items lifecycle, history, dependencies, participants, and Project/Workstream validation.
- Updates & Evidence drafts, employee confirmation, source records, and Timeline readers.
- Project-owned versioned Progress Contracts and append-only official snapshots.
- Daily Work as an application composition layer.

The current employee My Work and long Update form are not preserved as the target experience.

## Capability delta

| User need                    | Existing base              | Smallest production delta                                                  | Owner                  | Slice |
| ---------------------------- | -------------------------- | -------------------------------------------------------------------------- | ---------------------- | ----: |
| Private quick capture        | Work Items                 | Employee-only Inbox aggregate with promote/dismiss lifecycle               | Work Items             |     1 |
| Normal Task detail           | Work Items                 | Update command, checklist, collaborators, focused query                    | Work Items             |     1 |
| Today                        | My Work query              | Needs My Action/Today/Overdue plus Inbox and Project pulse composition     | Daily Work             |     1 |
| List/Board/Calendar          | Work Item query            | Stable filters/layout projection over one Task identity                    | Work Items/Web         |     1 |
| Gmail/Calendar connection    | Auth/audit                 | Provider-neutral connection, credential reference, sync cursor, exclusions | Connected Work Context |     2 |
| Private source summary       | Private storage patterns   | Encrypted minimal normalized summary and owner-only reader                 | Connected Work Context |     2 |
| Manual source linking        | Projects permissions       | Reversible employee Project link with audit                                | Connected Work Context |     2 |
| Project matching             | Project/doc readers        | Deterministic/two-anchor policy, explanation, correction                   | Context Intelligence   |     3 |
| AI summaries and Task drafts | AI Router                  | Versioned schemas/prompts, source references, route trace                  | Context Intelligence   |     3 |
| Smart review queue           | Daily composition          | Private suggestions and confirmation actions                               | Daily Work/Web         |     3 |
| GitHub sources               | Worker/audit               | GitHub App binding, verified webhook, reconciliation, normalized facts     | GitHub connector       |     4 |
| Universal capture            | Updates & Evidence         | Compact draft-first text/image/file/code/link flow                         | Updates & Evidence     |     4 |
| Voice                        | Upload/AI Router           | Transcript revisions, dual confirmation, retention                         | Updates & Evidence     |     4 |
| Project owner setup          | Existing Progress Contract | Guided owner-only composition; no new progress engine                      | Projects/Web           |     5 |
| Project pulse                | Progress snapshots         | Compact explanation and missing-source actions                             | Projects/Daily Work    |     5 |
| Check-ins/readiness          | Updates/readiness          | Substantive-update query, leave exclusion, non-scoring projection          | Updates/Daily Work     |     5 |
| Manager operations           | Manager permissions        | Authorized action queues with forbidden score fields                       | Daily Work/Web         |     5 |
| Evaluation facts             | Domain public readers      | Neutral read-only composition                                              | Evaluation Preparation |     6 |

## New persisted concepts

### Migration `0017_task_workspace`

- `private_inbox_items`
- `work_item_checklist_items`
- indexes and constraints for employee/status/time and single promotion

`work_items.project_id` remains required.

### Migration `0018_connected_work_context`

- connected work accounts with opaque credential reference
- source items with protected title/summary ciphertext and key version
- source exclusions
- reversible source/Project links
- connector sync cursors

Live mode requires an approved credential vault and cryptographic key provider.

### Migration `0019_context_intelligence`

- context analyses
- Project-link suggestions
- Task drafts and revisions
- source-link corrections
- prompt/schema/route trace and human review status

### Migration `0020_github_integration`

- GitHub App installations and Project/repository bindings
- verified delivery receipt and normalized source events
- reconciliation cursor
- evidence/progress suggestions and disposition history

Slice 5 reuses existing Progress Contract persistence. Slice 6 is read-only unless implementation review proves an immutable preparation snapshot is required; it must not create an evaluation-rating table.

## Core contracts

```ts
type DailyWorkspaceSnapshot = {
  needsMyAction: DailyAction[];
  today: DailyAction[];
  overdue: DailyAction[];
  reviewQueue: ReviewQueueItem[];
  inbox: PrivateInboxItem[];
  projectPulse: ProjectPulseItem[];
  upcoming: UpcomingCommitment[];
};

type LinkDecision =
  | { kind: "AUTO_LINK"; projectId: string; anchors: ProjectAnchor[] }
  | { kind: "REVIEW"; candidates: ProjectCandidate[]; reasons: string[] }
  | { kind: "NO_MATCH"; reasons: string[] };
```

Automatic link policy never accepts a model confidence number as sufficient authority.

## Public module boundaries

- Work Items owns official Tasks, private Inbox, checklist, assignment, participant, dependency, and Task history.
- Connected Work Context owns private connector accounts, summaries, exclusions, and reversible source links.
- Context Intelligence consumes authorized public readers and AI Router; it owns analyses, suggestions, corrections, and drafts.
- Updates & Evidence owns manual/voice sources, confirmed Updates, Evidence, contribution context, and source-labelled events.
- GitHub connector owns external bindings, verified ingestion, and suggestions; Projects alone calculates official progress.
- Projects owns documents' progress interpretation, contract versions, conditions, and official snapshots.
- Daily Work composes reads only and does not write another module's tables.
- Evaluation Preparation composes authorized facts only and does not rate employees.

No arbitrary service may read another module's tables directly.

## Protected transactions

Use transactions for:

- Inbox promotion plus official Project-linked Task creation.
- Task update/assignment/status change plus append-only history.
- Connected-source link/correction plus audit.
- Task draft confirmation plus idempotent Work Item creation.
- Update confirmation plus accepted Timeline event.
- Evidence confirmation plus contribution context and audit.
- GitHub receipt idempotency and suggestion disposition.
- Contract condition confirmation plus official progress snapshot.

## Privacy and encryption

- Private Inbox and connected context are owner-only server-side resources.
- Managers do not receive Gmail/Calendar summaries or private Task drafts.
- Provider credentials are referenced through a vault; no plaintext token columns.
- Sensitive derived titles/summaries are encrypted with a recorded key version.
- Logs exclude tokens, source content, private URLs, uploaded content, and model credentials.
- Disconnect stops sync immediately and applies the approved retention/deletion policy.
- Connected content cannot train an external model unless an independently approved provider contract and route permit it.

## AI boundary

- Every AI call uses AI Router.
- Persisted output is schema-validated, versioned, source-referenced, and traced.
- Email, Calendar, documents, code, comments, and uploads are untrusted instructions.
- AI may draft; it cannot create/assign official Tasks, confirm Evidence, activate contracts, or assign/recommend ratings.
- AI failure preserves raw input and leaves manual Tasks, Projects, browsing, and linking usable.

## Progress and performance prohibitions

Neither contracts nor queries may derive Project progress or employee performance from:

- Task or Work Item count/completion.
- Update or check-in frequency.
- GitHub activity, commits, PRs, checks, files, or lines changed.
- Project count.
- Documentation Readiness.

Project progress comes only from the active human-approved measurable contract. Employee performance remains a later human evaluation decision.

## External gates

Live Google Workspace requires organization-approved OAuth configuration, scopes, consent, credential storage, retention, deletion, and administrator approval.

Live GitHub requires GitHub App creation/installation, minimum permission review, webhook secret, and organization/repository approval.

Deterministic adapters may support local acceptance before these gates, but cannot be described as live integration.
