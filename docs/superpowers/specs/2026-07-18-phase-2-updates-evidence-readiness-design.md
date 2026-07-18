# Phase 2 Updates, Evidence, GitHub, Check-ins, and Monthly Readiness Design

> **SUPERSEDED — DO NOT EXECUTE**
>
> This design is retained as draft history only. It was superseded on 2026-07-18 by the approved Product Direction Reset and must not be used to resume T030–T044 or to authorize production Work Item backend implementation. The active prototype design is `docs/superpowers/specs/2026-07-18-product-direction-reset-prototype-design.md`.

**Status:** Superseded draft; retained for historical reference only.

## 1. Goal and Boundary

Phase 2 delivers an append-only activity timeline, human-confirmed text and voice updates, source-linked evidence, contribution attribution, weekly workstream and project check-ins, a minimum-permission GitHub App integration, a suggested-evidence inbox, bilingual responsive screens, and a monthly evaluation-readiness review.

The phase covers T030–T043. T044 Arabic and dialect fixture expansion remains a later task; Phase 2 may use the existing synthetic Fusha, Gulf, Levantine, and mixed-language fixtures required by T032 but does not expand their approved corpus. Phase 2 does not implement employee or manager evaluation, rating recommendations, rankings, evidence quotas, automatic contribution scoring, leave approval, formal handover, payroll, promotion, or disciplinary automation. T016 remains draft and inactive. Arabic/RTL screens are built and tested, but Arabic employee rollout remains gated by T016's approved semantic review.

## 2. Approaches Considered

### Recommended: three domain modules with six dependency-ordered vertical bundles

Use separate `updates`, `evidence`, and `github` domain packages. `updates` owns activity, confirmation, and check-ins. `evidence` owns sources, verification, claims, and attribution. `github` owns installations, repositories, webhook receipts, reconciliation, synchronization, and suggestions. Public package interfaces connect them without cross-table reads.

Execute six bounded bundles: timeline/text, voice/evidence/attribution, check-ins, GitHub, UI, then monthly readiness. This keeps AI, uploads, credentials, webhooks, historical immutability, and privacy independently testable while preserving one modular monolith.

### Rejected: one combined activity package

A single package initially reduces files, but it couples employee-authored history, untrusted uploads, contribution disputes, GitHub credentials, webhook replay, and monthly manager projections. Those areas have different authorization, transaction, retention, and review risks and will evolve independently.

### Rejected: full event sourcing

An event-sourced platform could reconstruct every state from one ledger, but it would introduce replay, projection, and migration complexity beyond the approved requirements. Phase 2 uses append-only domain records and explicit state transitions in PostgreSQL, consistent with the existing modular monolith.

## 3. Architecture and Dependency Direction

### 3.1 Domain ownership

- `packages/updates` owns update submissions, transcript revisions, structured drafts, confirmed activity events, timeline pagination, substantive-update qualification, weekly check-in obligations, workstream check-ins, and project aggregation.
- `packages/evidence` owns evidence items and immutable source revisions, claim links, criterion links, verification results, contribution claims, participants, acknowledgments, objections, and attribution state.
- `packages/github` owns GitHub App installations, repository grants, webhook receipts, delivery idempotency, reconciliation cursors, document-source bindings, synchronization state, and suggested evidence.
- `packages/contracts` owns public schemas, stable enums, error codes, AI output schemas, and cursor contracts.
- `packages/documents` continues to own private file storage, safe upload inspection, document versions, and authorized source reads. Phase 2 consumes only its public interfaces.
- `packages/projects` continues to own project/workstream identity, current and historical responsibility, membership, and scope reads.
- `packages/criteria` continues to own versioned dynamic criteria. Evidence links resolve the criterion version active at the activity time through its public historical query.
- `packages/ai-routing` remains the only provider boundary.
- `apps/api` composes authentication, authorization, controllers, policy guards, transactions, and domain services. Controllers do not query Prisma directly.
- `apps/worker` runs transcription, structured-update, evidence-analysis, webhook-dispatch, reconciliation, document-sync, and monthly-readiness jobs through existing durable job infrastructure.
- `apps/web` uses the same-origin server gateway and localized view models. Sessions and provider or GitHub credentials never enter Client Components.

PostgreSQL is authoritative. Private audio, images, files, and large artifacts remain in S3-compatible storage. Redis/BullMQ carries durable commands, not authoritative domain state.

### 3.2 Cross-module interfaces

`updates` consumes:

- `ProjectActivityScopeReader.getActivityScope({ actorId, projectId, workstreamId, occurredAt })`
- `ApprovedLeaveExemptionReader.findApprovedLeave({ employeeId, startsAt, endsAt })`
- `CriteriaAtTimeReader.listCriteriaAt({ projectId, workstreamId, occurredAt })`

`evidence` consumes:

- `ProjectEvidenceScopeReader.getEvidenceScope(...)`
- `DocumentSourceAccess.createUploadedSource(...)`
- `DocumentSourceAccess.authorizeSourceRead(...)`
- `ActivityClaimReader.getConfirmedClaim(...)`
- `CriteriaAtTimeReader.listCriteriaAt(...)`

`github` consumes:

- `DocumentVersionWriter.appendGitHubVersion(...)`
- `EvidenceSuggestionWriter.upsertSuggestion(...)`
- `ProjectRepositoryScopeReader.getRepositoryBindingScope(...)`

The leave module does not yet exist. `ApprovedLeaveExemptionReader` is therefore an explicit port with an empty production adapter until the approved leave workflow is implemented in Phase 5. Tests use a deterministic adapter containing approved intervals. Phase 5 replaces the adapter without changing check-in rules. A client cannot claim its own leave exemption.

No module reads another module's tables through arbitrary Prisma access. No microservice, alternate database, or second source of truth is introduced.

## 4. Execution Bundles

### Bundle A — Timeline and text updates (T030–T031)

Implement append-only activity events, timeline pagination, text update submissions, AI structuring, human correction, and final confirmation. This establishes the stable event and claim identifiers consumed by later bundles.

### Bundle B — Voice, evidence, and attribution (T032–T035)

Implement audio transcription and transcript correction, evidence sources and many-to-many links, multimodal support analysis, contribution claims, participant acknowledgment, and retained objections. Voice and evidence reuse the safe private-upload boundary.

### Bundle C — Weekly coordination (T036–T037)

Implement Thursday workstream obligations, substantive-update substitution, approved-leave exemptions through the port, missing operational state, and project-level cross-workstream aggregation without duplicated details.

### Bundle D — GitHub integration (T038–T041)

Implement GitHub App installation, minimum repository permissions, verified and idempotent webhooks, reconciliation, document synchronization, and suggested evidence requiring employee context. GitHub volume never becomes a metric.

### Bundle E — Update, timeline, and evidence interface (T042)

Implement Arabic-first and English responsive screens for update composition, transcript correction, timeline, evidence, attribution, GitHub suggestions, and weekly check-ins. UI actions are derived from protected API responses and refreshed after mutations.

### Bundle F — Monthly Evaluation Readiness (T043)

Implement append-only monthly readiness snapshots, employee detail, manager operational-only projection, notifications, false-positive avoidance, and its localized screen. Execute this bundle after T041 even though T043's task dependency list does not name T041, because the approved output explicitly includes unreviewed GitHub suggestions.

Every bundle ends with focused tests, a commit, a push, and a stacked pull-request update. Critical authorization, privacy, audit, migrations, AI boundaries, GitHub credentials/webhooks, and historical immutability receive one specification review and one security/code-quality review with a single bounded P0/P1 remediation cycle. Routine UI and copy use self-review.

## 5. Activity and Update Model

### 5.1 Update submissions

An update begins as an `activity_submission` scoped to one employee and exactly one project or workstream. It records:

- `text` or `voice` input kind.
- Employee, project, optional workstream, and responsibility context.
- User-supplied occurred-at time in UTC plus the timezone used to interpret local input.
- Original text or immutable audio-source reference.
- Lifecycle state.
- Creation actor/time and correlation identifier.

Lifecycle states are `draft`, `transcribing`, `transcript_review`, `structuring`, `structured_review`, `confirmed`, `failed`, and `cancelled`. State transitions append transition rows. Retrying a failed AI operation creates another operation attempt and output revision; it does not overwrite the input or a prior output.

Text input is retained verbatim as untrusted content. Voice input retains the original private audio source. Transcripts are append-only revisions containing text, editor, timestamp, and source operation. A user confirmation chooses one transcript revision for structuring; it never mutates the original transcript.

### 5.2 Structured drafts and confirmation

`update.structure` returns a versioned schema containing only approved descriptive fields:

- Event type.
- Summary.
- Claim.
- Contribution description.
- Participants.
- Result or current state.
- Impact.
- Learning.
- Decision.
- Next step.
- Candidate criterion and evidence references.
- Exact source references.

The schema contains no rating, suggested rating, rank, productivity score, readiness score, project average, or attribution decision. The employee may correct the structured draft. Every AI and human revision remains append-only.

Only explicit employee confirmation creates a durable `activity_event`. An event stores the chosen source and structured revisions, event type, confirmed descriptive fields, occurred-at timestamp, scope, creator, and immutable confirmation metadata. Corrections create a successor event revision linked to the prior event; timeline reads return the current revision while historical APIs preserve the chain.

Supported event types are exactly the approved types in `PROJECT_REFERENCE.md`: Research, Learning, Experiment, Implementation, Decision, Problem, Resolution, Documentation, Collaboration, Delivery, Scope Change, Blocker, Priority Change, Handover, Delegation, No-Change Confirmation.

### 5.3 Timeline and substantive updates

Timeline order is `(occurredAt DESC, id DESC)` with an opaque signed cursor. Reads enforce resource scope in the persistence query and support bounded page size. Historical contributors may read events within their actual responsibility periods and their own retained records; ended responsibility does not grant current private workspace access.

A substantive update is a confirmed event other than `No-Change Confirmation` whose human-confirmed record contains an activity plus at least one of result/current state, decision, conclusion, learning, blocker, scope change, or next step. This qualification is an operational scheduling rule, not a quality or performance score. It does not depend on activity counts, AI confidence, file counts, or commit volume.

## 6. Evidence and Verification Model

### 6.1 Evidence items and sources

An `evidence_item` is a stable record scoped to an employee or team and one project/workstream. Each item has one or more immutable source revisions. Sources may be private uploads, images, external links, GitHub artifacts, CI/check results, document versions, or other approved source kinds.

Files and images use the existing fail-closed upload pipeline: streamed size limit, extension/MIME/magic-byte agreement, archive checks where applicable, ClamAV, SHA-256, private storage, and authorized short-lived reads. External links store normalized HTTPS URLs and source metadata; fetching external content is a separate allowlisted worker operation and cannot access loopback, link-local, private-network, or cloud-metadata addresses.

`evidence_links` provide many-to-many links between evidence, confirmed activity claims, contribution claims, and the exact criteria versions active at the event timestamp. Link creation requires authorization to both sides and creates an audit event. A source is never automatically evidence for every participant or criterion.

### 6.2 Verification

`evidence.analyze.image` and `evidence.analyze.document` use the AI Router and versioned schemas. Uploaded or fetched content is untrusted and delimiter-isolated. Persisted output cites source references and classifies claim support as:

- `verified`
- `partially_verified`
- `self_reported`
- `additional_evidence_needed`
- `team_contribution`
- `unable_to_verify`
- `conflicting_evidence`
- `source_supported`
- `peer_acknowledged`
- `attribution_disputed`
- `attribution_clarified`
- `unable_to_attribute`

AI confidence describes support for a specific claim only. It does not describe employee quality and cannot become a rating, rank, or productivity value. AI never treats an image without context as automatic proof. The user confirms or corrects the claim-to-source link before it becomes an approved evidence relationship. Verification corrections append a new result.

## 7. Contribution Attribution

A contribution claim records the employee's statement, individual/team mode, confirmed activity and evidence references, actual responsibility period, and append-only participant set. Related participants can add their own contribution, acknowledge a bounded statement, propose a correction, or object with a required reason and evidence references.

No response is `pending`, never implied agreement. An acknowledgment applies only to the exact claim revision shown. Editing a claim creates a successor revision and requires a new participant disposition. Objections remain append-only with the original claim and both sides' sources.

The attribution state is `self_reported`, `peer_acknowledged`, `disputed`, `clarified`, or `unable_to_attribute`. `clarified` requires participant agreement on a successor claim; neither AI nor a manager can rewrite the historical dispute as resolved fact. AI may summarize agreement and disagreement without deciding credit. A disputed record may still support verified team contribution.

## 8. Thursday and Project Check-ins

### 8.1 Workstream obligation

Check-in weeks use the configured organization timezone, with `Asia/Riyadh` as the pilot default. The deadline is Thursday at configured local times; UTC instants are stored. One deterministic obligation row exists per active workstream and week.

The obligation is `satisfied_by_update` when a substantive confirmed update exists within the local week from an eligible responsible participant. If no such update exists, the Primary Workstream Owner submits one approved status:

- Work continues with no material change.
- Temporarily paused.
- Priority moved to another project.
- Waiting for data, access, decision, or external party.
- Work is in progress but has not produced a result.
- Completed but not yet closed.
- No longer active.
- A substantive update will be added now.

The check-in becomes `satisfied_by_checkin`, `exempt_approved_leave`, or `missing`. An approved-leave interval overlapping the obligation excludes the employee only through `ApprovedLeaveExemptionReader`. If all responsible owners are exempt or a future approved delegation supplies an acting owner, the obligation follows the actual responsibility period. Missing state is operational and cannot reduce a rating automatically.

Check-in creation, satisfaction, exemption, and missing transitions are idempotent and append-only. Reconciliation can safely rebuild obligations from project status, responsibility windows, leave exemptions, and confirmed events.

### 8.2 Project aggregation

The Primary Project Owner receives one aggregate of child workstream states and confirms only overall project state, cross-workstream dependencies, shared risks, timeline/scope change, and integration concerns. The aggregate references workstream check-ins rather than copying their details. Project confirmation is append-only and does not alter workstream history.

## 9. GitHub App, Webhooks, Sync, and Suggestions

### 9.1 Installation and credentials

The primary integration is a GitHub App, never a personal access token. Request only metadata plus the repository contents, pull request, commit-status/check, and webhook permissions required by T038–T041. Repository grants are explicit and revocable.

GitHub App ID, private key reference, webhook secret reference, installation identifiers, permission snapshot, creator, and lifecycle state are retained. Secrets live only in the approved secret resolver and are never logged or returned by APIs. Installation callbacks use signed, expiring, single-use state bound to the authenticated administrator and organization. Uninstall suspends access and retains historical source identifiers and URLs.

### 9.2 Webhook ingestion and reconciliation

The webhook controller reads raw bytes, enforces a configured body-size limit, verifies the GitHub signature with constant-time comparison before JSON parsing, validates event and delivery headers, and writes one receipt per delivery ID under a unique constraint. Unsupported events are acknowledged and retained only as safe metadata.

Accepted installation, repository, push, pull request, and check events create an outbox command in the same transaction as the receipt. Duplicate deliveries return success without duplicating commands. Workers validate a versioned event schema and use source identifiers for downstream idempotency. Reconciliation jobs use installation-scoped cursors to recover missed repository, branch, PR, commit, and check state without rewriting history.

### 9.3 Document synchronization

A document binding stores installation, repository, branch, path, resource kind/ID, and last synchronized commit. The worker fetches the exact allowed repository object, validates size/type and commit identity, and calls the public document-version interface. Changed content appends a document version with repository/path/commit source metadata. Move and deletion append synchronization-state events; they do not delete historical versions.

Every synchronized version triggers existing comparison and readiness jobs. It never activates revised criteria automatically. Reconciliation is idempotent by `(bindingId, commitSha, path, sourceObjectId)`.

### 9.4 Suggested evidence

PRs, commits, checks, and test results create `suggested_evidence` records keyed by installation and original source ID. The record contains source URL, repository, safe title/summary, authorship metadata, timestamp, and candidate project/workstream scope. It contains no performance weight or score.

The employee must accept, reject, ignore, reassign, or merge a suggestion. Acceptance requires context, contribution mode, project/workstream confirmation, and AI-assisted execution mode (`manual`, `ai_assisted`, `agent_generated`, or `mixed`). Acceptance creates an evidence item and contribution draft in one transaction but does not auto-confirm either. Rejection and reassignment retain the original suggestion and disposition history.

Commit count, lines changed, PR size, file count, and activity frequency are prohibited as performance inputs and are rejected by schemas and repository scans.

## 10. Monthly Evaluation Readiness

One snapshot per employee and local calendar month is generated idempotently after the configured review day. The snapshot records rule version, source cutoff, scope references, gap keys, source IDs, and generation time. It never stores a score, percentage, rank, quota target, penalty, or comparison with another employee.

Employee gap keys are:

- `silent_active_scope`
- `artifact_criterion_without_source`
- `claim_without_result_or_conclusion`
- `experiment_without_baseline_measure_or_conclusion`
- `learning_without_application`
- `unreviewed_github_suggestion`
- `unresolved_attribution`

Rules are boolean source checks, not minimum counts. False-positive avoidance excludes:

- Inactive scopes and periods outside actual responsibility.
- Approved leave through the exemption port.
- A scope with any substantive confirmed update in the month.
- Observation-based criteria that do not require file evidence.
- Claims explicitly recorded as still in progress with a next step.
- Team evidence already linked to the employee's acknowledged contribution.
- Reviewed or intentionally rejected GitHub suggestions.
- Clarified attribution.

The employee sees each gap, its scope, supporting source state, and a corrective action. The approved message is: “The current record may not be sufficient to represent this part of your work during evaluation.”

Managers receive only team-level operational states and project/workstream gaps. APIs do not return individual readiness percentages, rankings, comparative trends, or detailed employee correction instructions to managers, and readiness does not appear inside rating selection screens.

## 11. API, Authorization, Audit, and Errors

Public REST groups are:

- `/updates`
- `/activity-events`
- `/checkins`
- `/evidence`
- `/contributions`
- `/github/installations`
- `/github/repositories`
- `/github/webhooks`
- `/github/suggestions`
- `/monthly-readiness`

Every protected action enforces authentication and resource scope server-side. UI hiding is not authorization. Employees create and read their own submissions and authorized shared records. Current owners receive coordination actions only, never managerial evaluation authority. Managers receive only their department's approved operational projections. System Administrators manage GitHub installation and configuration but do not decide attribution or project reassignment.

Access follows actual responsibility periods. Historical records remain after deactivation; deactivated users cannot authenticate. Sensitive content, tokens, GitHub secrets, private URLs, raw webhook bodies, audio, and uploaded content are never logged. Protected changes create audit events in the same transaction as domain state. Webhook receipts, update inputs, confirmed activity, evidence sources, verification revisions, attribution responses, check-ins, suggestions, and monthly snapshots are append-only or successor-versioned.

Expected stable errors include `RESOURCE_NOT_FOUND`, `SCOPE_MISMATCH`, `RESPONSIBILITY_PERIOD_MISMATCH`, `UPDATE_STATE_INVALID`, `TRANSCRIPT_CONFIRMATION_REQUIRED`, `STRUCTURED_UPDATE_CONFIRMATION_REQUIRED`, `EVIDENCE_SOURCE_INVALID`, `EVIDENCE_LINK_SCOPE_MISMATCH`, `ATTRIBUTION_RESPONSE_FROZEN`, `CHECKIN_NOT_REQUIRED`, `CHECKIN_WINDOW_CLOSED`, `GITHUB_SIGNATURE_INVALID`, `GITHUB_DELIVERY_DUPLICATE`, `GITHUB_INSTALLATION_INACTIVE`, `GITHUB_PERMISSION_INSUFFICIENT`, `GITHUB_SYNC_CONFLICT`, `SUGGESTION_ALREADY_DISPOSED`, and `MONTHLY_READINESS_SOURCE_STALE`.

## 12. AI Boundaries

Phase 2 uses only these governed route keys:

- `update.structure`
- `speech.transcribe`
- `evidence.analyze.image`
- `evidence.analyze.document`

Every persisted AI result has a versioned prompt and schema, exact source references, model-route trace, validation, and the defined human gate. Uploaded content, transcript text, GitHub text, comments, and external pages are untrusted input. System instructions are immutable and separate from delimited untrusted content.

Prompt/schema changes run deterministic evaluations covering English, existing Arabic fixtures, mixed technical text, prompt injection, supported/partial/conflicting evidence, invalid schemas, privacy cases, and prohibited rating/rank/productivity/count fields. Live provider quality remains a deployment evaluation and is not required for deterministic Phase 2 completion.

## 13. User Interface and Localization

The same-origin Next.js gateway exposes exact GET and mutation routes. Server Actions strictly reject actor IDs, arbitrary paths, rating/rank/productivity fields, readiness percentages, raw tokens, and unknown FormData keys. Client view models contain only authorized data and `allowedActions`.

Screens cover:

- Update composer and human confirmation.
- Voice upload, transcript correction, and structured-review stages.
- Paginated timeline.
- Evidence upload/link/context and verification.
- Contribution participant responses and retained objections.
- Thursday workstream and project check-ins.
- GitHub installation administration and employee suggested-evidence inbox.
- Monthly readiness employee detail and manager operational projection.

All critical screens have English catalogs plus Arabic-first RTL layouts, logical CSS, accessible focus, mixed-direction isolation for code/URLs/SHAs/repository paths, 390px support, loading/error/empty states, and locale-aware date/number rendering. Building Arabic screens does not activate the unapproved Arabic rubric or authorize Arabic employee release.

## 14. Verification Strategy

- Unit tests cover update state machines, transcript/structured revision immutability, event types, substantive qualification, evidence source/link invariants, claim-support states, attribution freezing, check-in timezone boundaries, leave exemptions, aggregation, webhook signatures, delivery idempotency, suggestion dispositions, and monthly gap predicates.
- Migration verification covers empty database, the Phase 1 snapshot, drift, rebuild equivalence, append-only triggers, unique delivery/source keys, immutable source revisions, responsibility-period constraints, and monthly snapshot uniqueness.
- Integration tests cover employee/owner/manager/admin positive and negative scopes, historical responsibility, deactivation retention, safe upload reuse, AI trace persistence, one-response attribution, Thursday substitution, missing operational state, leave-port exemption, webhook duplicate/replay, uninstall, reconciliation, document sync, evidence acceptance, and manager readiness privacy.
- Object and network tests cover audio/image type spoofing, malware, size limits, private reads, signed URL expiry, external-link SSRF denial, GitHub permission narrowing, secret redaction, and webhook raw-body limits.
- AI evaluations cover text and voice structuring, Fusha/Gulf/Levantine fixtures already approved for T032, mixed Arabic/English terminology, prompt injection, supported/partial/conflicting evidence, source references, and absence of rating/rank/productivity/count outputs.
- End-to-end tests cover text update confirmation, voice transcript correction and recovery, evidence context, attribution acknowledgment/objection, Thursday substitution, project aggregation, GitHub suggestion acceptance/rejection/reassignment, timeline pagination, monthly readiness, manager privacy, Arabic/English routes, RTL, keyboard focus, and mobile layout.

Bundle completion requires focused tests and related integration. The full repository suite runs after shared-foundation changes, at major integration checkpoints, and before the Phase 2 pull request becomes ready. No task is complete because it only compiles.

## 15. Operational and Product Risks

- External content and GitHub text remain untrusted; prompt injection, SSRF, malware, type spoofing, and oversized payloads fail closed.
- GitHub permission or installation changes can invalidate access; reconciliation and uninstall handling preserve history and stop new reads.
- AI transcription and evidence support are advisory drafts with human confirmation, not authority.
- Check-in and monthly readiness are operational aids. They never become performance metrics, quotas, rankings, or automatic penalties.
- Attribution remains human-declared and dispute-preserving. AI and managers cannot rewrite credit as fact.
- The approved-leave port is deliberately present before the Phase 5 workflow. Until that workflow exists, no approved leave can be created in this product; test adapters prove exclusion behavior, and Phase 5 supplies the authoritative adapter.
- T013's recovered-running attempt-count telemetry issue remains a known non-blocking operational limitation and is not expanded into Phase 2 scope.
- T016 remains isolated and inactive; no Phase 2 migration, seed, localization catalog, or UI may import or activate its draft rubric content.
