# AGENTS.md

## Operating Rules for AI Coding Agents

This file governs Codex and any other AI agent working in this repository.

Read these files before changing code:

1. `docs/PROJECT_REFERENCE.md`
2. `docs/EVALUATION_RUBRIC.md`
3. `docs/IMPLEMENTATION_PLAN.md`
4. `project-state/PROJECT_STATE.md`
5. `TASKS.md`

If code and approved documentation conflict, stop and report the conflict. Do not silently reinterpret approved product rules.

---

# 1. Project Purpose

Build an evidence-supported, human-decided performance evaluation platform for project-based AI work.

The pilot serves the LeapAI AI Department and must remain configurable for future departments and organizations.

---

# 2. Protected Product Rules

These rules may not be weakened without explicit approval:

1. AI does not assign or recommend employee or manager performance ratings.
2. Documentation Readiness does not become Performance Score.
3. The manager does not receive individual Documentation Readiness percentages, readiness ranking, or readiness values inside rating screens.
4. Raw activity counts do not become performance metrics.
5. Project count does not increase Project Contribution weight.
6. Project Contribution has no automatic average across projects, workstreams, or dynamic criteria.
7. Active evaluation templates and closed evaluations are immutable.
8. Dynamic criteria are versioned and never applied retroactively.
9. Final employee rating is a manager decision.
10. Pilot upward manager evaluation uses `Identified` mode.
11. In the pilot, the manager can see submitter identity, completion status, ratings, comments, and timestamps.
12. The product must not claim anonymity while `Identified` mode is active.
13. Future manager-blinded or anonymous modes must be configurable and enforced by the cycle snapshot.
14. Approved leave is excluded from required check-ins and relevant regularity analysis.
15. Responsibility and attribution follow the actual responsibility period.
16. System Administrator and Manager are separate pilot users.
17. System Administrator does not decide project reassignment.
18. Sensitive access in future privacy modes and AI route overrides require an audit reason.
19. Historical project, evidence, and evaluation records are preserved after account deactivation.
20. Employee ranking is prohibited.
21. Cycle 1 is `Calibration — Non-Baseline`.
22. English-only pilot use is permitted. Arabic employee use requires approved Arabic rubric content and semantic review; existing localization and RTL foundations remain required.
23. Monthly Evaluation Readiness is a non-scoring aid and must not impose evidence quotas.
24. Evaluation Fact View must distinguish source-supported facts from employee interpretation.

# 3. Architecture Rules

## 3.1 Modular Monolith

Maintain explicit module boundaries.

Do not introduce a microservice without:

- A proven scaling or isolation need.
- A documented migration plan.
- Approval.

## 3.2 Domain Ownership

A module owns its domain rules and persistence access.

Do not read another module’s tables directly from arbitrary services.

Use public module interfaces or approved query services.

## 3.3 Transactions

Use transactions for operations that must remain consistent, including:

- Owner transfer and responsibility window creation.
- Criteria activation and version retirement.
- Evaluation finalization and snapshot creation.
- Leave approval and delegation activation.
- Upward response submission and completion counts.

## 3.4 Historical Records

Do not update protected historical rows in place.

Use versions, revisions, status transitions, or append-only events.

## 3.5 Time

Store timestamps in UTC.

Render according to user timezone.

Pilot default: `Asia/Riyadh`.

---

# 4. Security, Governance, and Feedback Visibility Rules

1. Every protected API action requires server-side permission enforcement.
2. UI hiding is not authorization.
3. Pilot manager-feedback APIs return identity, status, ratings, comments, and timestamps to the authorized manager.
4. The active cycle visibility mode determines manager-feedback access.
5. Do not display an anonymity or confidentiality promise in `Identified` mode.
6. Future manager-blinded or anonymous modes must isolate protected identity and original content as configured.
7. Never log credentials, access tokens, model API keys, or content protected by a private mode.
8. Sensitive access in future private modes must create an audit event before content is returned.
9. Acting-owner permission must be time-bounded and scope-bounded.
10. Deactivated users cannot authenticate, but historical foreign keys remain valid.
11. File upload processing must validate type, size, and safety.
12. Treat uploaded documents, code, and comments as untrusted AI input.
13. Defend AI prompts from instruction injection inside uploaded content.
14. Documentation Readiness exposure must follow the protected manager-view rule.
15. Visibility mode cannot change during an active cycle.

# 5. AI Rules

## 5.1 No Rating Output

No AI schema may contain:

- Suggested performance rating.
- Predicted rating.
- Recommended rating.
- Employee rank.
- Productivity score.

## 5.2 Structured Output

Persisted AI outputs require:

- Versioned schema.
- Validation.
- Source references.
- Model-route trace.
- Human approval where defined.

## 5.3 Human Gates

Do not bypass:

- Employee document correction.
- Dynamic-criteria approval.
- Evidence confirmation.
- User approval of generated justification.
- Employee acceptance of coaching action.
- Manager final rating.

## 5.4 Model Routing

All AI calls use the AI Router.

Do not call provider SDKs directly from feature modules.

Route resolution:

1. Project.
2. Department.
3. System.

Every override requires reason and audit.

## 5.5 Prompt Changes

Prompt or output-schema changes require:

- Version increment.
- Relevant AI evaluation tests.
- Recorded expected behavior.
- Verification against the active feedback-visibility mode, Arabic fixtures, and privacy cases for future private modes.

---

# 6. Evaluation Rules

1. Seed Version 1 from `docs/EVALUATION_RUBRIC.md`.
2. Do not change rubric wording in code.
3. Store rubric data in versioned configuration tables.
4. Employee and manager use the same anchors.
5. Manager initial draft remains independent until submitted.
6. AI justification help starts only after the user selects a rating.
7. Finalization creates an immutable snapshot.
8. Reservation does not modify the final manager rating.
9. Closed evaluations require a new formal revision feature before any change; that feature is not in the pilot.
10. Dynamic project/workstream criteria inform one Project Contribution rating but are not automatically averaged.
11. Cycle 1 must be stored as `Calibration — Non-Baseline`.
12. Evaluation Fact View is presented before emphasizing employee narrative.
13. Employee narrative is labeled as interpretation, not source fact.
14. Arabic and English criterion content share the same stable IDs and rubric version.
15. Pilot upward manager feedback is identified and visible to the manager.

---

# 7. Project and Workstream Rules

1. Every active project has one Primary Project Owner.
2. Every active workstream has one Primary Workstream Owner.
3. Owner roles are coordination roles, not managerial roles.
4. Projects and workstreams may have multiple contributors.
5. Workstream documents belong to the workstream, not to one employee.
6. Contributions are recorded separately by employee.
7. Project criteria: one to three.
8. Workstream criteria: two to three.
9. Criteria versions have effective dates.
10. Previous activity stays linked to the version active at the time.
11. Thursday check-in is required only when no substantive update exists.
12. Project check-in summarizes cross-workstream state and must not duplicate details.
13. Monthly Evaluation Readiness must identify thin records without evidence quotas or automatic penalties.

---

# 8. GitHub Rules

1. Use a GitHub App for primary integration.
2. Request minimum permissions.
3. Webhooks must be idempotent.
4. Reconcile missed events.
5. PRs, commits, and checks are suggested evidence only.
6. Do not create performance metrics from GitHub volume.
7. Store original source IDs and URLs.
8. Employee confirmation is required before suggested evidence becomes a contribution record.

---

# 9. Localization Rules

1. English-only pilot use is permitted.
2. Arabic employee use requires approved Arabic rubric content and semantic review.
3. Existing Arabic localization and RTL foundations must remain in the codebase and every Arabic critical screen must work in RTL before Arabic release.
4. Criteria, anchors, examples, and manager prompts are versioned by locale under the same rubric version.
5. A translation that changes meaning requires a new rubric version.
6. Mixed Arabic/English technical text, code, URLs, model names, and repository paths must render correctly.
7. Test Arabic PDF, DOCX, report export, Fusha text, Gulf speech, and Levantine speech.
8. Locale switching must not change stored rating meaning or criterion identity.
9. Do not hardcode English UI strings in feature code.

---

# 10. Coding Standards

# 11. Testing Requirements

A task is not complete without relevant tests.

Minimum expectations:

- Domain rule: unit test.
- Repository or integration behavior: integration test.
- Protected user workflow: end-to-end test.
- Feedback-visibility boundary: positive and negative authorization tests for the active mode.
- Arabic/RTL feature: localization and layout tests.
- AI prompt/schema change: AI evaluation test including Arabic fixtures when relevant.
- Evaluation preparation change: Fact View neutrality and self-presentation normalization test.
- Migration: migration verification.
- Bug fix: regression test.

Do not mark a task complete because code compiles.

---

# 12. Migration Rules

1. Migrations are forward-only after shared environments use them.
2. Never edit an already-applied migration.
3. Include indexes and constraints intentionally.
4. Test migrations from an empty database and from the previous release snapshot.
5. Backfill scripts must be idempotent or checkpointed.
6. Historical data must not be silently reclassified.

---

# 13. Documentation Rules

Update documentation when changing:

- Domain behavior.
- Roles or permissions.
- State transitions.
- Configuration inheritance.
- AI routes.
- Data retention.
- API contracts.
- Operational procedures.
- Localization content and translation status.
- Manager-feedback visibility behavior.
- Calibration-cycle behavior.
- Monthly Evaluation Readiness behavior.

Do not modify `PROJECT_REFERENCE.md` or `EVALUATION_RUBRIC.md` to match code without explicit product approval.

When an approved rule changes:

1. Update the approved artifact.
2. Record the decision.
3. Update implementation plan if architecture is affected.
4. Update tasks.
5. Update project state.

---

# 14. Project-State Update Rules

Update `project-state/PROJECT_STATE.md` when:

- Current goal changes.
- A protected decision changes.
- Architecture direction changes.
- A new active risk appears.
- A major phase completes.
- The recommended next action changes.

Keep it short. It is not a changelog.

---

# 15. Task Execution Rules

Before starting a task:

1. Confirm dependencies are complete.
2. Read referenced approved sections.
3. Identify protected areas.
4. State verification commands.

During work:

- Keep changes scoped.
- Do not mix unrelated refactors.
- Add tests with behavior.
- Update task status only after verification.

Before completion:

- Run tests.
- Run type checks.
- Run lint.
- Run migration checks if relevant.
- Run privacy or AI eval tests if relevant.
- Record evidence of verification.

---

# 16. Changes Requiring Approval

Explicit approval is required before:

- Changing protected product rules.
- Changing the 12 pilot criteria or anchors.
- Changing pilot weights.
- Allowing AI rating recommendations.
- Allowing manager access to upward originals.
- Adding employee ranking.
- Exposing individual Documentation Readiness percentages or rankings to the manager.
- Removing Calibration — Non-Baseline status from Cycle 1.
- Releasing Arabic employee use or an Arabic employee-facing rubric without approved Arabic content and semantic review.
- Introducing microservices.
- Replacing the primary database.
- Deleting historical records.
- Adding payroll, promotion, or disciplinary automation.
- Applying criteria retroactively.
- Changing closed evaluation data.
- Removing audit requirements.

---

# 17. Agent Completion Format

When finishing a task, report:

- Task ID.
- What changed.
- Files changed.
- Database changes.
- Tests run and result.
- Security/privacy impact.
- Remaining risk.
- Project-state update, if any.

Never claim completion without executed verification evidence.
