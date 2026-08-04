# Phase 1 Projects, Workstreams, Documents, and Criteria Design

**Status:** Approved for internal execution under the 2026-07-17 Fast Controlled Execution decision. This design applies only requirements already approved in `docs/PROJECT_REFERENCE.md`, `docs/IMPLEMENTATION_PLAN.md`, `TASKS.md`, and `AGENTS.md`; it does not change a protected product rule.

## 1. Goal and Boundary

Phase 1 delivers an end-to-end governed project with multiple workstreams, historical responsibility, versioned source documents, readiness analysis, prospective dynamic criteria, and a simple bilingual user interface.

The phase covers T018–T029. It does not implement activity updates, evidence, check-ins, GitHub integration, evaluation scoring, or Arabic rubric activation. English-only pilot use remains permitted. Arabic and RTL interface foundations remain supported, but no unapproved Arabic rubric content is imported or activated.

## 2. Approaches Considered

### Recommended: three bounded domain modules with controlled vertical bundles

Use separate `projects`, `documents`, and `criteria` domain packages. Each package owns its rules and persistence adapter, while API modules expose shared contracts. Execute the phase in four dependency-ordered bundles: responsibility, documents, AI criteria, then UI.

This approach keeps ownership, document history, and criteria history independently testable without introducing services or unnecessary deployment boundaries. It also supports small reviewable pull-request increments within one phase branch.

### Rejected: one large Phase 1 package

A single package would reduce initial files, but it would couple owner transfer, object storage, AI readiness, and criteria activation. Those areas have different security and transaction risks and will evolve independently in later phases.

### Rejected: one package per task

Task-level packages would maximize isolation but create excessive interfaces and dependency management for a modular monolith. The task boundaries are execution and review units, not deployment or package boundaries.

## 3. Architecture

### 3.1 Domain packages

- `packages/projects` owns projects, workstreams, memberships, responsibility windows, ownership transfers, lifecycle rules, and project/workstream query services.
- `packages/documents` owns template versions, protected sections, document records, uploaded sources, document versions, readiness results, material-change results, and object-storage access.
- `packages/criteria` owns AI proposals, human review, approved criteria sets, acknowledgments, objections, effective dates, revision, and retrospective-protection rules.
- `packages/contracts` owns the public request/response schemas, stable enums, error codes, and AI output schemas consumed across modules.
- `apps/api` composes controllers, authentication, policy enforcement, correlation, and the package services. Controllers do not query Prisma directly.
- `apps/web` consumes only the API contracts and localization catalogs.

PostgreSQL remains authoritative. S3-compatible storage contains file bytes; database records contain object keys, integrity hashes, content metadata, and history. Redis is used only for existing durable background execution where analysis is asynchronous.

### 3.2 Dependency direction

`criteria` may consume read-only public interfaces from `projects` and `documents`. `documents` may consume read-only project/workstream identity interfaces. `projects` does not depend on either module. Cross-module reads never bypass a public interface.

No microservice, alternate database, or second source of truth is introduced.

## 4. Execution Bundles

### Bundle A — Project responsibility (T018–T020)

Implement projects, workstreams, memberships, ownership, contributors, responsibility windows, and atomic transfer. This bundle establishes the resource scopes used by later bundles.

### Bundle B — Documents (T021–T023)

Implement versioned templates, protected template sections, secure upload and signed access, document records, versions, sources, and optimistic concurrency.

### Bundle C — Analysis and criteria (T024–T028)

Implement readiness checks, version comparison, material-change review, project/workstream criteria proposals, human approval, contributor acknowledgment and objection, and prospective revision.

### Bundle D — User interface (T029)

Implement responsive project/workstream list and detail screens for status, members, documents, readiness, criteria, acknowledgment, and objection. The interface supports English and Arabic catalogs, RTL layout, mixed-direction technical content, and role-scoped actions. Arabic rubric content remains outside this phase.

Each bundle ends with fresh verification and bounded review. Security, migration, AI-boundary, and immutability work receives independent review; routine low-risk steps use inline execution.

## 5. Project, Workstream, and Responsibility Model

Projects use `draft`, `active`, `paused`, `completed`, and `archived` lifecycle states. Workstreams use `draft`, `active`, `paused`, `completed`, and `archived`. Activating either resource requires exactly one active primary owner. Pausing preserves ownership. Status changes take effect at the server transaction time and create append-only status-transition and audit records; Phase 1 does not schedule future status changes. Completion or archival closes current ownership, membership, and contributor windows through an explicit transition while retaining all history.

Membership and responsibility are distinct:

- Membership controls association and access eligibility.
- Responsibility windows record what a person was accountable for during a half-open UTC interval `[startsAt, endsAt)`.
- `original`, `acting`, `permanent`, and `contributor` are explicit responsibility kinds.
- Contributor windows may overlap.
- Primary project-owner and primary workstream-owner windows may not overlap for the same resource.

Each responsibility window records the employee, exactly one scope (`project` or `workstream` plus its ID), responsibility kind, `startsAt`, optional `endsAt`, required reason, manager-decision actor/time/reason when a manager decision applies, optional related-handover reference, and optional delegation-type key. The three manager-decision fields are all present or all absent; they are required for `original`, `acting`, and `permanent` owner windows and for any manager-directed contributor change. A contributor window may omit them when an authorized scoped operational actor adds the contributor, but the mutation actor and reason remain in audit. `relatedHandoverReference` is nullable until the later handover module exists and must not point to an invented Phase 1 handover record.

Acting ownership is always time-bounded: it requires a finite `endsAt` after `startsAt` and a delegation-type key. The transfer transaction closes the current owner at the acting start, creates the acting window, and creates the prior owner's prospective return window beginning at the acting end. Permanent ownership forbids delegation fields and remains open until a later transition. Database exclusion constraints prevent overlapping owner windows, and authorization checks the responsibility window active at request time rather than trusting a historical role assignment alone.

Adding a project member/co-contributor creates membership, scoped contributor authorization, and a contributor responsibility window together. Adding a workstream contributor does the same at workstream scope. Either period can be ended individually in one audited transaction; ending an active or scheduled owner membership is rejected until ownership is transferred. Owner transfer adds target membership atomically when absent and leaves the prior owner's membership unchanged unless a separate authorized end-membership command is executed.

Owner transfer is one database transaction that locks the resource, closes the previous window, opens the new window or bounded acting/return sequence, records an ownership-transfer row, updates resource-scope authorization inputs, and appends an audit event. A transfer never overwrites a historical row. System Administrators cannot decide reassignment; authorized managers manage department resources, and scoped owners manage only the operational actions permitted to them. A project cannot complete or archive while any child workstream is not completed or archived. A project or workstream cannot complete or archive while a current acting-owner window or future owner window exists; the transition is rejected unchanged rather than deleting or shortening a scheduled responsibility record.

All timestamps are UTC. Query boundaries use the user timezone only for presentation; the pilot display timezone is `Asia/Riyadh`.

## 6. Document and Template Model

A template has organization or department scope, an explicit `project` or `workstream` kind, and append-only versions. A version contains ordered sections with stable section keys, localized display content, required/optional state, and protected state. The six protected project requirements are always present in every activated project-template version and cannot be removed or made optional:

1. Project Definition and Ownership.
2. Problem and Context.
3. Objective and Expected Outcome.
4. Scope and Boundaries.
5. Expected Deliverables.
6. Definition of Success.

Activation retires the prior active version of the same scope and kind and activates the new version atomically. Existing documents retain their assigned template version unless a future formal migration is explicitly implemented.

Every activated workstream-template version requires purpose, scope, expected output, relationship to the parent project, dependencies, proposed approach or architecture, definition of success, responsible members, and relevant sources or repositories. Activation rejects a version missing any of these stable section keys. The document belongs to the workstream rather than any current owner, so an ownership transfer never recreates or relocates its history.

Each project has exactly one Project Master Document record, and each workstream has exactly one shared Workstream Document record. Unique database constraints on the parent foreign keys prevent a second document; all changes create versions beneath the stable record. Each version stores the template version, source references, object key when uploaded, SHA-256 digest, detected type, byte size, creator, creation time, and monotonically increasing version number. New versions require the current version token; stale writes return `VERSION_CONFLICT` and do not create a partial version.

Supported Phase 1 inputs are Markdown, plain text, DOCX, PDF, PNG, JPEG, WebP, WAV, MP3, M4A, external links, and GitHub sources. T022 resolves configurable maximum file sizes and supported media limits as environment-backed policy values; this design does not invent product ceilings. Uploads are streamed through those limits, extension/MIME/magic-byte agreement, archive safety limits where applicable, malware scanning, SHA-256 calculation, and generated object keys before permanent storage. Safety failure is fail-closed. Download uses short-lived signed URLs after server-side authorization; buckets are not public. Credentials and signed URLs are never logged.

## 7. Readiness and Material-Change Analysis

Document analysis always uses the AI Router and versioned structured-output schemas. Inputs are treated as untrusted content and delimited from system instructions. Persisted results include schema version, prompt version, model-route trace, source version, source references, and validation outcome.

Readiness states are the approved states: `draft`, `incomplete`, `ready_for_criteria_generation`, `criteria_approved`, `revision_required`, and `superseded`. Detailed missing items and correction instructions are visible to authorized document participants. Manager-facing summaries expose only operational states, never individual readiness percentages, ranking, or values inside rating screens. The result does not become a performance score and imposes no evidence quota.

Missing answers are not accepted as an internal substitute for the source document. The user must correct the original, upload or synchronize a new version, and rerun analysis.

Material-change analysis classifies a version transition as `editorial`, `routine_execution_update`, or `material_scope_or_goal_change`. The result cites both source versions and relevant passages. Human review can confirm or correct the classification before it triggers a criteria-revision workflow.

## 8. Dynamic Criteria Lifecycle

AI proposal schemas contain only criterion name, reason, link to success, expected behavior/result, evaluation method, suggested evidence, and source references. They contain no suggested rating, predicted rating, productivity score, employee rank, or automatic project average.

Project proposals contain one to three criteria. Workstream proposals contain two to three. A proposal remains inactive until the required human flow completes:

- Project owner can correct understanding, reject with reason, request an alternative, improve wording without weakening substance, and approve.
- Primary workstream owner reviews the proposal before contributors see it.
- Contributors acknowledge understanding or object with a reason.
- Unanimity is not required; objections remain append-only and visible in the operating record.

Publishing the owner-reviewed workstream proposal freezes a response-eligibility snapshot of the active Primary Workstream Owner and active contributors. Every eligible contributor must submit exactly one append-only response: acknowledgment or objection. An objection counts as a completed response, so consensus is not required; a missing response does not count and blocks activation. Zero eligible contributors completes collection immediately after owner approval.

When all responses exist, a proposal with no objections can proceed to activation. Any objection moves the proposal to `manager_resolution`. The authorized department manager records one of two operating decisions with a required reason: `request_revision`, which supersedes the proposal and requires a new document version or criteria proposal and a new eligibility snapshot; or `accept_with_objections`, which preserves every objection and permits activation without editing or inventing technical criteria. The manager cannot change criterion substance in this transition.

Activation is one transaction that rechecks the frozen snapshot and responses, owner approval, objection resolution, criterion-count bounds, current document version, and non-retroactive effective date; creates the immutable criteria-set version; retires the previously active version prospectively; links document and prior criteria versions; and appends the audit event. Any failed check rolls back the entire transition.

Approval creates an immutable criteria-set version with an effective date no earlier than approval. Revision creates a new version linked to the prior document and criteria versions. Existing activity can reference only the version effective at the activity timestamp; retrospective links are rejected by domain validation and database constraints.

## 9. API, Authorization, and Errors

REST controllers use strict Zod contracts and generated OpenAPI metadata for:

- `/projects`
- `/projects/:projectId/workstreams`
- `/projects/:projectId/responsibilities`
- `/document-templates`
- `/documents`
- `/documents/:documentId/versions`
- `/documents/:documentId/readiness-checks`
- `/documents/:documentId/comparisons`
- `/dynamic-criteria`
- `/dynamic-criteria/:setId/acknowledgments`
- `/dynamic-criteria/:setId/objections`

Every protected action is enforced server-side with RBAC plus organization, department, project, or workstream scope. UI visibility is not authorization. Reads verify active membership/responsibility or authorized management scope. Mutations verify both action permission and current resource state. Project-owner and workstream-owner roles grant coordination permissions only; negative authorization tests prove they cannot access manager-only supervision, employee evaluation, rating, or department-management actions.

Managers read resources only in their department. Active project owners and project members read their project; a project owner also reads child workstreams for coordination. Active workstream owners and contributors read their workstream and its parent-project summary. Unassigned, inactive, or cross-department users are denied. List queries apply these filters in persistence and never load all resources before authorization.

Expected domain errors use the existing error envelope and stable codes including `RESOURCE_NOT_FOUND`, `SCOPE_MISMATCH`, `RESOURCE_STATE_INVALID`, `PRIMARY_OWNER_REQUIRED`, `OWNER_WINDOW_CONFLICT`, `VERSION_CONFLICT`, `UPLOAD_TYPE_REJECTED`, `UPLOAD_SIZE_REJECTED`, `UPLOAD_SAFETY_REJECTED`, `AI_OUTPUT_INVALID`, and `RETROACTIVE_CRITERIA_FORBIDDEN`. Logs contain identifiers and safe metadata, never uploaded content, credentials, provider keys, or signed URLs.

## 10. Verification Strategy

- Unit tests cover lifecycle transitions, separate project/workstream template invariants, protected sections, time-window boundaries, criterion counts, response-snapshot completion, objection resolution, effective dates, and prohibited AI fields.
- Migration verification covers empty database, previous release `0008`, drift, rebuild equivalence, partial uniqueness, date constraints, and historical-row protection.
- Integration tests cover atomic owner transfer, complete responsibility-window fields, cross-department denial, owner-role non-supervision, rejection of a second project/workstream document, rejection of incomplete template activation, stale document writes, signed access authorization, append-only versions, AI trace persistence, acknowledgment/objection completion, manager resolution, atomic criteria activation, and retrospective-link rejection.
- Object-storage tests cover type spoofing, oversize streams, unsafe archives, malware scanner rejection, private objects, short-lived signed URLs, and cleanup after failed writes.
- AI evaluations cover complete/incomplete documents, editorial/material changes, prompt injection, invalid schemas, English and approved non-rubric Arabic fixtures, privacy boundaries, and absence of rating/ranking/productivity output.
- End-to-end tests cover creating one project with multiple workstreams, assigning owners and contributors, uploading a new document version, resolving readiness, approving prospective criteria, acknowledging or objecting, and verifying role-scoped UI actions in English and RTL layout.

Phase completion requires repository verification, migration checks, integration tests, deterministic AI evaluations, end-to-end tests, hosted CI, no unresolved P0/P1 findings, and no protected-rule change.

## 11. Operational and Product Risks

- Ownership races are controlled by transaction locks plus database uniqueness; application checks alone are insufficient.
- Uploaded content is untrusted and remains inaccessible until validation and scanning succeed.
- AI results are advisory structured records with source references and human gates, never hidden authority.
- Criteria history and document history are append-only; correction creates a new version.
- The known T013 recovered-running attempt-count telemetry issue remains non-blocking and is not expanded into Phase 1 scope.
- T016 remains isolated on `deferred/arabic-rubric-v1`; no Phase 1 dependency may import or activate it.
