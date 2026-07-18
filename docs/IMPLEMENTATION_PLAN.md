# IMPLEMENTATION_PLAN.md

## Evidence-Based Performance Evaluation System

**Status:** Approved implementation direction  
**Pilot:** LeapAI AI Department  
**Architecture style:** Modular monolith with separate web, API, and worker processes  
**Implementation objective:** Build the complete integrated product in ordered phases  
**Parent references:** `PROJECT_REFERENCE.md`, `EVALUATION_RUBRIC.md`  
**Revision:** 1.2 — Phase 0 closure, English-only pilot permission, deferred Arabic semantic approval, and fast controlled execution

---

# 1. Implementation Objective

Build a production-capable internal platform that connects project and workstream documentation, continuous updates, evidence, GitHub activity, quarterly employee evaluation, identified upward manager evaluation for the pilot, coaching insights, leave, delegation, versioning, AI routing, permissions, and audit.

The first deployment serves one organization and one department, but core entities and configuration boundaries must support later expansion to other departments and organizations without rewriting the product.

Implementation phases define dependency order. They are not permission to omit approved product capabilities from the completed system.

---

# 2. Architecture Decision

## 2.1 Chosen Pattern

Use a **modular monolith** in a TypeScript monorepo, deployed as three primary processes:

1. **Web application** — user interface.
2. **API application** — domain logic and transactional APIs.
3. **Worker application** — asynchronous AI, document, GitHub, notification, and aggregation jobs.

This avoids premature microservices while maintaining explicit module boundaries and independent worker scaling.

## 2.2 Recommended Stack

Use current supported stable releases at implementation time.

- **Frontend:** Next.js App Router, React, TypeScript.
- **Backend:** NestJS with domain feature modules.
- **Database:** PostgreSQL.
- **ORM and migrations:** Prisma ORM.
- **Background jobs:** Redis and BullMQ.
- **Object storage:** S3-compatible storage; MinIO for local development.
- **Authentication:** OIDC abstraction; Keycloak is the recommended pilot identity provider.
- **Authorization:** Application-level RBAC and scoped resource policies.
- **API contract:** REST/OpenAPI for the first build.
- **Validation:** Shared schemas using Zod or an equivalent typed validation layer.
- **GitHub integration:** GitHub App, webhooks, and GitHub APIs.
- **AI integration:** Provider-neutral AI Router with adapters for external and local OpenAI-compatible endpoints.
- **Observability:** Structured logs, OpenTelemetry-compatible tracing, metrics, and error reporting.
- **Deployment:** Docker Compose for pilot; deployment manifests must not block future Kubernetes use.
- **Testing:** Unit, integration, contract, end-to-end, privacy, and AI-evaluation test suites.

## 2.3 Monorepo Structure

```text
/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── packages/
│   ├── contracts/
│   ├── database/
│   ├── auth/
│   ├── permissions/
│   ├── ai-routing/
│   ├── document-processing/
│   ├── github-integration/
│   ├── audit/
│   ├── notifications/
│   ├── ui/
│   └── test-utils/
├── docs/
├── project-state/
├── infra/
│   ├── docker/
│   └── deployment/
├── scripts/
├── AGENTS.md
└── TASKS.md
```

---

# 3. Architectural Boundaries

The API is organized into feature modules. Each module owns its use cases, domain rules, repository interfaces, and authorization checks.

## 3.1 Identity and Organization

Owns:

- Organizations.
- Departments.
- Users.
- Status and archive state.
- Role assignments.
- Manager relationships.
- Eligibility for evaluation.
- Account deactivation references.

## 3.2 Authorization

Owns:

- Roles.
- Scoped permissions.
- Department and project access.
- Separate manager and system-administrator authority.
- Sensitive upward-evaluation access.
- Acting-owner temporary authority.

No UI visibility check is sufficient by itself. Every protected API operation requires server-side authorization.

## 3.3 Projects and Workstreams

Owns:

- Projects.
- Workstreams.
- Primary owners.
- Contributors.
- Membership periods.
- Responsibility windows.
- Status.
- Reassignment Required.
- Parent-child relationships.

## 3.4 Documents and Templates

Owns:

- Project document templates.
- Workstream document templates.
- Protected and configurable sections.
- Uploaded and linked documents.
- GitHub document sources.
- Document versions.
- Readiness validation.
- Material-change classification.
- Version-to-criteria linkage.

## 3.5 Dynamic Criteria

Owns:

- Project criteria.
- Workstream criteria.
- AI proposals.
- Employee review.
- Contributor acknowledgments and objections.
- Versioning.
- Effective dates.
- Retrospective-protection rules.

## 3.6 Updates and Weekly Check-ins

Owns:

- Event updates.
- Voice transcript confirmation.
- Activity classification.
- Thursday check-ins.
- Workstream aggregation.
- Project-level summary.
- Missing-update operational state.

## 3.7 Evidence and Attribution

Owns:

- Files, images, links, and GitHub suggestions.
- Evidence metadata.
- Verification status.
- Evidence inbox.
- Individual and team contributions.
- Peer acknowledgment.
- Attribution disputes.
- Claim-to-source links.

## 3.8 Evaluation Templates and Rubrics

Owns:

- Organization templates.
- Department templates.
- Mandatory global criteria.
- Weight ranges.
- Rating scales.
- Behavioral anchors.
- Template versions.
- Cycle snapshots.

The approved pilot rubric must be seeded from `EVALUATION_RUBRIC.md`.

## 3.9 Employee Evaluation

Owns:

- Evaluation cycles.
- Assignments.
- Evidence preparation.
- Self-assessment.
- Independent manager draft.
- Comparison.
- Discussion.
- Final ratings.
- Acknowledgment and reservation.
- Closure and historical snapshots.

## 3.10 Upward Manager Evaluation

Owns:

- Manager evaluation cycles.
- Eligible evaluator set.
- Configurable visibility mode.
- Identified pilot submissions.
- Employee-level completion status.
- Individual ratings and comments.
- Optional AI topic aggregation and trends.
- Future manager-blinded and anonymous-aggregated modes.
- Visibility-mode cycle snapshot.

The pilot mode is `Identified`.

Privacy isolation, topic suppression, and restricted-original workflows are activated only for future configurations that require them.

## 3.11 Coaching and Development

Owns:

- Coaching insights.
- Source explanations and confidence.
- Optional personal actions.
- Private/shared state.
- Manager support comments.
- Formal development plans.

## 3.12 Leave, Delegation, and Continuity

Owns:

- Leave records.
- Manager approval.
- Handover.
- Delegate confirmation.
- Emergency activation.
- Acting-owner authority.
- Return Handover.
- Return or extension.
- Evaluation and check-in suspension.

## 3.13 GitHub Integration

Owns:

- GitHub App installation.
- Repository access.
- Document synchronization.
- Webhook ingestion.
- PR, commit, check, and test suggestions.
- Evidence inbox source references.
- Idempotency and replay.

## 3.14 AI Routing and Runs

Owns:

- Providers and credentials.
- Model configurations.
- System, department, and project routes.
- Overrides and mandatory reasons.
- Fallbacks.
- AI run trace.
- Prompt and output version.
- Cost and latency metadata.
- Local/external endpoint adapters.

## 3.15 Localization and Content Governance

Owns:

- Arabic-first UI content.
- English content.
- RTL and mixed-direction behavior.
- Versioned bilingual criterion and anchor text.
- Translation approval state.
- Arabic AI fixtures.
- Arabic report and export rendering.
- Locale-specific date, number, and timezone presentation.

## 3.16 Audit and Export

Owns:

- Immutable audit events.
- Sensitive-data access logs.
- Template and rating changes.
- Export tracking.
- Administrative operations.
- Investigation access.

---

# 4. Data Architecture

## 4.1 Primary Storage

Use PostgreSQL for transactional and relational state.

Use S3-compatible object storage for:

- Uploaded documents.
- Images.
- Audio.
- Raw evidence.
- Exported reports.
- Large AI input/output artifacts when database storage is inappropriate.

Use Redis for:

- Background job queues.
- Short-lived locks.
- Idempotency assistance.
- Non-authoritative caching.

PostgreSQL remains the authoritative system of record.

## 4.2 Event History

Do not implement full event sourcing in the first build.

Use:

- Normalized current-state tables.
- Version tables for documents, criteria, templates, and model configuration.
- Append-only `audit_events`.
- Append-only operational timeline events.

Silent overwrites of protected historical state are prohibited.

## 4.3 Core Logical Entities

### Organization and Identity

- `organizations`
- `departments`
- `users`
- `user_status_history`
- `role_definitions`
- `role_assignments`
- `manager_relationships`

### Projects and Workstreams

- `projects`
- `project_members`
- `workstreams`
- `workstream_members`
- `responsibility_windows`
- `ownership_transfers`

### Documents and Templates

- `document_templates`
- `document_template_versions`
- `document_template_sections`
- `project_documents`
- `workstream_documents`
- `document_versions`
- `document_sources`
- `document_readiness_checks`

### Dynamic Criteria

- `dynamic_criteria_sets`
- `dynamic_criterion_versions`
- `criterion_acknowledgments`
- `criterion_objections`

### Updates and Evidence

- `activity_events`
- `weekly_checkins`
- `evidence_items`
- `evidence_links`
- `verification_results`
- `contribution_claims`
- `contribution_participants`
- `attribution_objections`

### Evaluation Configuration

- `evaluation_templates`
- `evaluation_template_versions`
- `evaluation_sections`
- `evaluation_criteria`
- `criterion_anchor_versions`
- `criterion_weight_rules`
- `rating_scales`

### Employee Evaluation

- `evaluation_cycles`
- `evaluation_assignments`
- `criterion_assessments`
- `project_section_assessments`
- `evaluation_comparisons`
- `evaluation_discussions`
- `final_evaluations`
- `employee_acknowledgments`
- `development_plans`

### Upward Manager Evaluation

- `manager_evaluation_cycles`
- `manager_evaluator_eligibility`
- `manager_evaluation_submissions`
- `manager_criterion_responses`
- `manager_comment_records`
- `manager_evaluation_aggregates`
- `manager_topic_summaries`
- `manager_feedback_visibility_configs`
- `manager_response_identity_links`
- `sensitive_access_events`

For the pilot `Identified` mode, the submission links directly to the employee and is visible to the manager.

For future manager-blinded or anonymous-aggregated modes, identity linkage is isolated and manager access is restricted according to the cycle snapshot.

### Coaching

- `coaching_insights`
- `coaching_insight_sources`
- `personal_development_actions`
- `development_action_comments`

### Leave and Delegation

- `leave_records`
- `delegations`
- `handover_records`
- `handover_items`
- `delegate_confirmations`
- `return_handovers`

### Integration and AI

- `github_installations`
- `github_repositories`
- `github_webhook_events`
- `github_evidence_suggestions`
- `ai_providers`
- `ai_model_configs`
- `ai_routing_rules`
- `ai_routing_overrides`
- `ai_runs`

### Audit

- `audit_events`
- `export_events`

## 4.4 Database Constraints

Enforce at database or transactional-service level:

- One active Primary Project Owner per active project.
- One active Primary Workstream Owner per active workstream.
- Responsibility-window validity and nonnegative duration.
- No dynamic-criterion effective date before approval.
- Active-cycle template snapshot cannot be edited.
- Closed evaluation cannot be edited.
- Section weights total 100% before template activation.
- Criterion weights total 100% inside each fixed section.
- Mandatory criterion range constraints.
- Manager-feedback visibility behavior is frozen in the cycle snapshot.
- In `Identified` mode, the manager can access employee identity, ratings, comments, status, and timestamp.
- In manager-blinded or anonymous modes, the manager cannot access protected identity-link records.
- Visibility-mode rules must be enforced server-side, not only in the UI.
- New criteria cannot be linked retroactively to older activity.
- Account deactivation does not delete historical ownership or contribution.

---

# 5. API and Contract Design

## 5.1 API Style

Use REST with generated OpenAPI documentation.

Use shared typed request/response schemas in `packages/contracts`.

## 5.2 API Groups

- `/auth`
- `/organizations`
- `/departments`
- `/users`
- `/roles`
- `/projects`
- `/projects/:id/workstreams`
- `/documents`
- `/document-templates`
- `/dynamic-criteria`
- `/updates`
- `/checkins`
- `/evidence`
- `/contributions`
- `/evaluation-templates`
- `/evaluation-cycles`
- `/employee-assessments`
- `/manager-evaluations`
- `/coaching`
- `/development-actions`
- `/leave`
- `/delegations`
- `/github`
- `/ai-config`
- `/audit`
- `/exports`

## 5.3 Concurrency

Use optimistic concurrency for:

- Document revisions.
- Criteria revisions.
- Template editing.
- Evaluation draft editing.
- Handover editing.

Return a clear conflict response when a stale version is submitted.

---

# 6. AI Architecture

## 6.1 AI Router

Create one internal AI Router interface.

It resolves model configuration in this order:

1. Project override.
2. Department override.
3. System default.

Every function declares a route key, such as:

- `document.analyze`
- `document.compare`
- `criteria.generate.project`
- `criteria.generate.workstream`
- `update.structure`
- `evidence.analyze.image`
- `evidence.analyze.document`
- `code.summarize`
- `coaching.generate`
- `evaluation.prepare`
- `manager-feedback.aggregate`
- `speech.transcribe`

## 6.2 Provider Adapters

Implement adapters behind a common contract:

- External API provider adapter.
- OpenAI-compatible local endpoint adapter.
- Speech-to-text adapter.
- Multimodal adapter.

Do not expose model choice to employees or managers.

## 6.3 AI Run Record

Every run stores:

- Route key.
- Resolved configuration version.
- Provider and model.
- Project and department scope.
- Input source references.
- Prompt-template version.
- Structured output schema version.
- Output reference.
- Start/end time.
- Latency.
- Token or usage metadata when available.
- Cost estimate when available.
- Error and fallback state.
- Human approval state where required.

## 6.4 Structured Outputs

AI operations that affect stored domain records must return schema-validated structured output.

Reject or quarantine output that fails validation.

## 6.5 Human Approval Gates

Required approval:

- Document-readiness correction remains employee action.
- Dynamic criteria require employee/workstream review.
- Evidence record requires employee confirmation.
- AI justification requires user approval.
- Coaching action requires employee acceptance.
- Manager feedback publication uses privacy rules and completion gate.

AI never writes a rating field.

## 6.6 AI Evaluation Tests

Maintain a versioned evaluation dataset containing:

- Complete and incomplete project documents.
- Material and nonmaterial document changes.
- Good and weak dynamic criteria.
- Text, voice, and image updates.
- Evidence that supports, partly supports, or conflicts with claims.
- Shared contribution cases.
- Identified manager-feedback submissions.
- Unique and repeated manager-feedback themes for future private modes.
- Privacy leakage traps for manager-blinded and anonymous modes.
- Arabic Fusha, Gulf, and Levantine text and speech.
- Mixed Arabic/English technical content.
- Leave and delegation context.
- Thin-evidence and monthly-readiness cases.
- Evaluation Fact View normalization cases.

Every prompt or model-route change must run the relevant evaluation suite.

---

# 7. GitHub Integration Design

## 7.1 Authentication Model

Use a GitHub App rather than personal access tokens for the primary integration.

Request only required repository permissions.

## 7.2 Ingestion

Use:

- Webhooks for push, pull request, check, and installation events.
- API reconciliation jobs to recover missed events.
- Idempotency keys based on GitHub delivery and source identifiers.

## 7.3 Document Sync

A project or workstream can link:

- Installation.
- Repository.
- Branch.
- File path.

Store commit SHA for every synchronized version.

A source change triggers document comparison and readiness analysis.

It does not automatically activate revised criteria.

## 7.4 Suggested Evidence

PRs, commits, checks, and test results become `Suggested Evidence`.

The employee must:

- Select the item.
- Add work context.
- Describe contribution.
- Identify individual or team work.
- Confirm project/workstream link.

No activity count is used in performance calculation.

---

# 8. File, Image, Audio, and Document Processing

## 8.1 First-Build Formats

Support:

- Markdown.
- Plain text.
- DOCX.
- PDF.
- PNG.
- JPEG.
- WebP.
- WAV.
- MP3.
- M4A.
- External links.
- GitHub sources.

## 8.2 Processing Pipeline

1. Virus and file-safety validation.
2. Object storage.
3. Metadata extraction.
4. Text extraction when available.
5. Multimodal analysis when needed.
6. Structured AI result.
7. Human confirmation.
8. Evidence linkage.

## 8.3 Voice Updates

1. Upload or record audio.
2. Transcribe.
3. Show transcript to employee.
4. Employee confirms or edits transcript.
5. AI structures the update.
6. Employee confirms the final record.

The original audio and transcript version must remain traceable.

---

# 9. Security, Governance, and Feedback Visibility

## 9.1 Authentication

- OIDC authentication.
- MFA supported by identity provider.
- Separate accounts for manager and system administrator.
- Session revocation on deactivation.
- Service credentials stored in a secret manager or encrypted deployment secret system.

## 9.2 Authorization

Use both RBAC and resource-scope checks.

Examples:

- Manager can manage only the assigned department.
- Project members access assigned projects and workstreams according to role.
- System Administrator manages technical configuration.
- Acting Owner receives time-bounded authority.
- Manager-feedback access follows the visibility mode frozen in the cycle.

## 9.3 Pilot Manager Feedback — Identified

In the pilot:

- The manager sees who submitted and who did not.
- The manager sees each employee’s ratings, comments, and timestamp.
- Submitted feedback is visible without a full-team publication gate.
- Approved leave is shown as a status and does not block other responses.
- Employees are informed clearly that feedback is identified.

The product must not display an anonymity promise in this mode.

## 9.4 Future Privacy Modes

Support later configuration for:

- `Manager-Blinded`.
- `Anonymous Aggregated`.

When enabled, the architecture may use:

- Isolated identity links.
- Restricted original access.
- Topic suppression.
- Completion thresholds.
- Independent HR or governance roles.
- Sensitive-access audit.

These controls must be conditional capabilities, not hardcoded pilot restrictions.

## 9.5 Documentation Readiness Visibility

Employee view may include detailed percentages, dimensions, gaps, and trends.

Manager view includes only operational states:

- `Ready`.
- `Needs Attention`.
- `Missing Critical Information`.

The manager does not receive individual readiness percentages, readiness ranking, or readiness values inside the rating screen.

## 9.6 Encryption

- TLS in transit.
- Database and object-storage encryption at rest.
- Credential encryption and rotation support.
- Application-level encryption for content protected by future privacy modes.
- Secure storage for AI-provider and GitHub credentials.

## 9.7 Audit Integrity

Audit records are append-only through application permissions.

No ordinary user can update or delete audit events.

Visibility-mode changes, upward-feedback access, rubric changes, and final ratings are audited.

# 10. User Experience and Navigation

## 10.1 Design Principle

The interface must hide architectural complexity.

Use role-specific navigation, progressive disclosure, and Arabic-first RTL presentation.

## 10.2 Employee Navigation

- Home.
- My Projects.
- My Workstreams.
- Updates.
- Evidence Inbox.
- Thursday Check-in.
- Monthly Readiness.
- Coaching.
- Evaluations.
- Development.
- Leave and Handover.

## 10.3 Manager Navigation

- Team Overview.
- Projects and Workstreams.
- Check-in Status.
- Evidence Readiness.
- Blockers.
- Leave and Delegations.
- Employee Evaluations.
- Template Management.
- Coaching Trends.
- My Manager Evaluation.
- Reassignment Required.

## 10.4 System Administrator Navigation

- Users and Roles.
- Organizations and Departments.
- Global Templates.
- Localization.
- Integrations.
- GitHub.
- AI Providers and Routing.
- Overrides.
- Audit.
- Feedback Visibility Modes.
- Retention and Exports.
- System Health.

## 10.5 Key Screens

- Project list and detail.
- Workstream detail.
- Document readiness review.
- Dynamic criteria review.
- Update composer.
- Evidence inbox.
- Timeline.
- Weekly check-in.
- Monthly Evaluation Readiness Review.
- Evaluation Fact View.
- Employee evaluation workspace.
- Assessment comparison.
- Discussion and finalization.
- Identified manager evaluation form.
- Manager submission-status and response view.
- Optional aggregate manager report.
- Coaching insight detail.
- Leave and delegation flow.
- Handover and Return Handover.
- Template editor.
- Localization editor or import flow.
- AI routing editor.
- Audit viewer.

## 10.6 RTL and Bilingual Requirements

All product screens must support:

- Arabic as pilot default.
- Full RTL layout.
- English locale.
- Mixed-direction technical content.
- Arabic and Latin search terms.
- Arabic date and number formatting where appropriate.
- Bidirectional code, URLs, model names, and repository paths.
- Accessible focus order in RTL.
- Mirrored layout only where semantically appropriate.

---

# 11. Notification Design

## 11.1 Channels

First build:

- In-app notifications.
- Email notifications.

Future:

- Slack, Teams, or WhatsApp connectors.

## 11.2 Thursday Schedule

Default pilot behavior:

- Thursday morning: remind owners whose active workstream has no substantive update.
- Thursday afternoon: remind remaining incomplete owners.
- End of Thursday: record missing check-in state.

Exact times remain configuration values.

## 11.3 Monthly Evaluation Readiness

Once per month, notify employees when the current record may be too thin to represent their work.

The review checks:

- Workstreams without substantive updates.
- Artifact-based criteria without support.
- Experiments without baselines or conclusions.
- Learning without application.
- Claims without results.
- Unreviewed GitHub suggestions.
- Unresolved attribution.

It must not impose evidence quotas or produce a performance score.

## 11.4 Other Notifications

- Document incomplete.
- Criteria ready for review.
- Contributor acknowledgment required.
- Evidence suggestion available.
- Attribution objection.
- Evaluation phase opened or due.
- Manager evaluation submission pending.
- Leave approval.
- Handover incomplete.
- Delegate confirmation required.
- Return Handover required.
- Reassignment Required.
- AI job failure requiring action.

---

# 12. Reporting and Exports

## 12.1 Employee Report

Generate Arabic or English PDF/document export containing:

- Period.
- Cycle type: Calibration or Official Baseline.
- Projects and workstreams.
- Responsibility windows.
- Evidence summary.
- Self-assessment.
- Manager assessment.
- Final ratings.
- Reservation.
- Development plan.

## 12.2 Manager Upward Report — Pilot

Contains:

- Employee name.
- Completion status.
- Individual criterion ratings.
- Individual comments.
- Submission timestamp.
- Aggregated criterion results.
- Repeated themes.
- Strengths.
- Improvement areas.
- Trends.
- Development actions.

Future visibility modes produce different report views according to the frozen cycle configuration.

## 12.3 Department Report

Contains:

- Criterion distributions.
- Trend by cycle.
- Skills and development patterns.
- Project blockers.
- Operational documentation states.
- Training needs.

It does not include employee ranking or individual Documentation Readiness percentages.

# 13. Nonfunctional Requirements

## 13.1 Availability

Pilot target:

- Business-hours availability with recoverable background processing.
- AI provider failure does not block access to stored records.
- Failed jobs retry safely and surface clear state.

## 13.2 Performance

Target initial experience:

- Normal list/detail API requests under 500 ms at pilot scale.
- User actions acknowledge quickly while heavy processing moves to background jobs.
- Timeline and evidence lists use pagination.
- Large document analysis is asynchronous.

## 13.3 Scalability

The modular monolith must allow:

- Additional organizations and departments.
- Additional worker replicas.
- Separate AI worker scaling.
- Object-storage growth.
- Partitioning or archiving of large audit and activity tables later.

## 13.4 Backup and Recovery

- Automated PostgreSQL backups.
- Object-storage versioning or backup.
- Restore procedure tested.
- Audit and upward-evaluation data included in recovery planning.
- Recovery test before production launch.

## 13.5 Localization

English-only pilot use is permitted. Arabic employee use requires approved Arabic rubric content and semantic review. Existing localization and RTL foundations remain required for the future Arabic release.

Requirements:

- English support.
- Approved English rubric content for English pilot use and approved Arabic rubric content before Arabic employee use.
- RTL layout.
- Mixed Arabic/English technical text.
- Arabic PDF and DOCX processing.
- Arabic report generation.
- Gulf and Levantine Arabic speech fixtures.
- Fusha and conversational Arabic update fixtures.
- Locale-aware date and number presentation.

Store timestamps in UTC and render in user timezone.

Pilot timezone: Asia/Riyadh.

---

# 14. Implementation Phases

## Phase 0 — Repository, Governance, AI, and Localization Foundations

Build:

- Monorepo and CI.
- Local Docker environment.
- PostgreSQL, Redis, MinIO, identity provider.
- Logging and error handling.
- Shared contracts.
- Migration workflow.
- Baseline RBAC and audit.
- AI Router and AI evaluation harness.
- Evaluation-eligibility snapshot foundation.
- Arabic/English localization architecture and RTL foundation.
- Seed organization, roles, and Version 1 rubric.
- Automated task dependency validation.

Exit criteria:

- All applications start locally.
- Authentication and role checks work.
- AI calls cannot bypass the Router.
- Arabic and English shell layouts render correctly.
- Rubric seed matches the approved source.
- No task depends on a task in a later phase.

Status: **Complete.** English Pilot Readiness is available. T016 is deferred, draft, and inactive; it is a future Arabic-release gate rather than a Phase 0 or engineering-phase blocker.

## Phase 1 — Projects, Workstreams, Documents, and Responsibility

Build:

- Projects.
- Workstreams.
- Membership.
- Primary owners.
- Responsibility windows.
- Document templates.
- Uploads and versions.
- Readiness analysis.
- Dynamic criteria.
- Contributor acknowledgment and objection.

Exit criteria:

- A project with multiple workstreams can be created and governed end to end.
- Document and criteria history is preserved.
- Retrospective criteria are prevented.

## Phase 2 — Updates, Evidence, GitHub, and Readiness

**Approved Product Direction Reset:** The original T030–T044 execution order is superseded. Use `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`, `docs/product/PHASE_2_FEATURE_MAP.md`, and `docs/superpowers/plans/2026-07-18-phase-2-daily-work-progress-plan.md`.

Build through seven visible vertical slices:

1. My Work, Work Items, and the Project/Workstream Progress Contract foundation.
2. Interactive text updates, live AI through the existing AI Router, Timeline, and manual evidence.
3. GitHub suggested evidence.
4. Voice updates.
5. Thursday check-ins and Monthly Evaluation Readiness.
6. Manager operational queues.
7. Evaluation Fact View preparation only.

Architecture:

- Preserve Phase 0/1 identity, authorization, audit, queue, AI Router, Projects, Workstreams, responsibility, documents, readiness, criteria, and history.
- Add one bounded `work-items` module.
- Add one bounded `updates-evidence` module.
- Keep versioned human-approved Progress Contracts and append-only official progress snapshots inside the Projects domain.
- Compose My Work, dashboards, Timeline, manager operations, and Fact View preparation through read-only application services using public module interfaces.
- Keep GitHub and voice as connectors to Updates & Evidence.
- Do not introduce a generic activity platform, second store, additional authentication system, microservice, or package-per-feature architecture.

Exit criteria:

- An employee completes the approved Arabic-first daily journey with English support: Work Item, dynamic multi-turn text/voice update, manual or suggested evidence, confirmation, source-labelled Timeline, and Project dashboard.
- Official Project/Workstream progress comes only from an approved measurable contract and confirmed source facts. It never comes from Work Item count, task/update/GitHub volume, commits, files, or lines changed.
- Missing source coverage preserves the previous official percentage; a decrease is source-explained and historically preserved; no direct percentage override exists.
- GitHub activity never becomes evidence, progress, contribution, or employee performance automatically.
- Thin evidence is surfaced without quotas, penalties, scores, or rankings, and manager readiness remains coarse.
- Phase 2 Fact View preparation contains no rating recommendation and does not implement the complete employee evaluation workflow.
- Every slice has focused tests, migration verification where applicable, a runnable local demo, Arabic/English desktop/mobile screenshots, commit/push checkpoint, and product-owner gate.

## Phase 3 — Employee Evaluation

Build:

- Organization and department templates.
- Fixed rubric seed and bilingual content.
- Weight validation.
- Cycle creation.
- Calibration-cycle flag.
- Evidence preparation.
- Evaluation Fact View.
- Self-assessment.
- Independent manager draft.
- Comparison.
- Discussion.
- Final rating.
- Acknowledgment and reservation.
- Closure snapshot.

Exit criteria:

- One complete `Calibration — Non-Baseline` cycle can run without manual database intervention.
- Closed evaluation is immutable.
- AI never writes a rating.
- The approved English rubric is preserved exactly; any future Arabic release must match the same stable IDs and version after T016 approval.

## Phase 4 — Identified Manager Evaluation and Coaching

Build:

- Manager rubric.
- Identified submissions.
- Employee-level completion view.
- Individual ratings and comments.
- Optional topic aggregation.
- Configurable future visibility-mode foundation.
- Coaching insights.
- Private/shared development actions.
- Manager support comments.
- Formal development plan.

Exit criteria:

- The manager can see pilot submission identity, status, ratings, and comments.
- The UI clearly states that pilot feedback is identified.
- Future privacy-mode boundaries are represented in configuration.
- Coaching contains no performance score or ranking.

## Phase 5 — Leave, Delegation, Offboarding, and Hardening

Build:

- Full leave workflow.
- Handover.
- Delegate confirmation.
- Acting ownership.
- Return Handover.
- Reassignment Required.
- Account deactivation.
- Retention and archive behavior.
- Exports.
- Security, load, recovery, and governance hardening.

Exit criteria:

- Planned and emergency continuity workflows pass end-to-end tests.
- Historical attribution remains correct.
- Production readiness checklist passes.

# 15. Verification Strategy

## 15.1 Unit Tests

Cover:

- Weight validation.
- Permission decisions.
- Responsibility-window calculations.
- Criteria effective-date rules.
- Evaluation state transitions.
- Leave and check-in exemptions.
- Manager-feedback visibility-mode enforcement.
- Identified completion status.
- Future private-mode topic suppression.
- AI route resolution.
- Override reason requirements.

## 15.2 Integration Tests

Cover:

- Database transactions.
- Object storage.
- Redis jobs.
- GitHub webhook ingestion.
- AI provider adapters.
- OIDC role mapping.
- Email notification.
- Export generation.

## 15.3 End-to-End Tests

Required flows:

1. Create project, workstreams, owners, and contributors.
2. Upload incomplete document and correct it.
3. Generate and approve dynamic criteria.
4. Add voice, text, image, and GitHub evidence.
5. Complete Thursday check-ins.
6. Record shared contribution and dispute.
7. Run full employee evaluation.
8. Run identified manager evaluation and verify visible completion, ratings, and comments.
9. Create coaching action.
10. Register leave, handover, delegate, and return.
11. Deactivate employee and reassign work.
12. Change AI route with mandatory reason.
13. Confirm closed-cycle immutability.
14. Run Monthly Evaluation Readiness Review.
15. Verify Evaluation Fact View normalization.
16. Run Cycle 1 as Calibration — Non-Baseline.
17. Switch locales and complete critical flows in Arabic RTL and English.

## 15.4 Governance and Privacy-Mode Tests

Pilot identified-mode tests:

- Manager can see employee identity, status, ratings, comments, and timestamp.
- Unauthorized employees cannot see other employees’ manager evaluations.
- The UI does not claim anonymity.
- Approved leave does not block other submissions.
- Visibility mode cannot change during an active cycle.

Future private-mode contract tests:

- Manager cannot access protected identity links.
- Aggregated mode does not leak originals.
- Unique-topic suppression works.
- Sensitive access requires the configured authorization and audit reason.

## 15.5 Localization Tests

Test:

- RTL navigation and focus order.
- Mixed Arabic/English technical text.
- Arabic criteria and anchors.
- Arabic PDF and DOCX extraction.
- Gulf and Levantine STT fixtures.
- Arabic report export.
- Locale switching without changing criterion version.
- Arabic AI structured-output validation.

## 15.6 AI Quality Tests

Test:

- Missing-document detection.
- Criteria quality.
- Material-change classification.
- Evidence support classification.
- Contribution extraction.
- Coaching non-scoring behavior.
- Manager-feedback mode compliance and aggregation quality.
- Prompt-injection resistance from uploaded documents.
- Schema-valid output.

---

# 16. Production Readiness Gates

Before pilot launch:

- Approved migrations.
- Seeded rubric matches `EVALUATION_RUBRIC.md`.
- Backup and restore tested.
- Manager/admin account separation verified.
- Governance and privacy-mode tests passed.
- Pilot manager-feedback screen clearly states `Identified`.
- GitHub permission review passed.
- AI model routes documented.
- Override audit tested.
- Employee and manager onboarding guide completed.
- Thursday schedule configured.
- One dry-run Calibration — Non-Baseline evaluation completed with test users.
- Approved Arabic rubric content loaded before Arabic employee release; this is not required for an English-only pilot launch.
- RTL and Arabic critical-flow testing passed before Arabic employee release; existing foundations remain continuously tested.
- Monthly Evaluation Readiness Review tested.
- Evaluation Fact View reviewed for neutrality.
- Export content reviewed.
- Monitoring and alerting active.

---

# 17. Delayed Capabilities

Do not implement before core workflow stability unless required by a real pilot blocker:

- Billing and subscription management.
- Template marketplace.
- Full self-service multi-tenancy.
- Google Drive automatic synchronization.
- HRIS integration.
- Formal multi-level employee appeal.
- Advanced manager-feedback privacy governance and multiple sensitive-access approvers.
- Employee ranking.
- Automated salary or promotion logic.
- Microservices split.
- Kubernetes-only deployment.
- Advanced vector search without a validated need.

---

# 18. Official Technical References

Implementation should consult current official documentation at execution time:

- Next.js App Router documentation.
- NestJS modules, queues, security, validation, and OpenAPI documentation.
- PostgreSQL documentation.
- Prisma ORM supported-database and migration documentation.
- GitHub Apps, webhooks, REST, and GraphQL documentation.
- Keycloak OIDC and authorization documentation.
- BullMQ and Redis documentation.
- Selected AI-provider official API documentation.

No implementation agent should assume an API signature or library version from memory when current official documentation is available.

---

# 19. Implementation Decision Summary

- Modular monolith.
- Separate web, API, and worker processes.
- TypeScript monorepo.
- PostgreSQL as authoritative data store.
- S3-compatible file storage.
- Redis/BullMQ asynchronous jobs.
- OIDC authentication and scoped RBAC.
- GitHub App integration.
- Provider-neutral AI Router.
- AI Router and localization foundations precede AI-dependent feature phases.
- Versioned records and append-only audit.
- No full event sourcing.
- No microservices in the pilot.
- English-only pilot availability with preserved Arabic/RTL foundations and a protected T016 gate before Arabic employee release.
- Cycle 1 is Calibration — Non-Baseline.
- Pilot upward manager evaluation is Identified.
- Future manager-feedback privacy modes remain configurable.
- Manager sees operational Documentation Readiness states, not employee percentages or ranking.
- Monthly Evaluation Readiness Review and Evaluation Fact View are core controls.
- Complete system delivered through ordered phases.
