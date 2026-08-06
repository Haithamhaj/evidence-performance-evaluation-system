# Complete Engine Program Design

**Status:** Product Owner approved on 2026-08-05  
**Scope:** Complete the pilot engine before final intelligent-frontend design  
**Authority:** `AGENTS.md`, `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, `docs/IMPLEMENTATION_PLAN.md`, `TASKS.md`, and the Engine Feature Register

## 1. Outcome

Complete every approved pilot engine capability through bounded, sequential subsystems; prove the full employee, manager, and System Administrator journeys; and hand stable versioned contracts to a separate final-frontend program.

The program does not design the final information architecture or visual system. Each subsystem may expose a small bilingual verification journey so real behavior, recovery, authorization, and human gates can be exercised without direct database changes.

## 2. Approved sequence

1. E3 — Research & Experiments.
2. E4 — Employee Evaluation.
3. E5A — Identified Upward Manager Evaluation.
4. E5B — Coaching & Development.
5. E6A — Leave, Delegation, Continuity, and Offboarding.
6. E6B — Notifications, Reporting, and Administration.
7. E6C — Security, Retention, Observability, Backup, and Recovery.
8. E7 — Full Engine Integration Audit and frontend handoff.

Each subsystem receives its own specification, TDD implementation plan, branch, focused tests, related integration tests, bounded review, durable push/PR checkpoint, and verified merge before its dependent subsystem begins.

## 3. Preserved foundations

- One modular monolith, PostgreSQL database, OIDC identity system, audit path, evidence lifecycle, and AI Router.
- Existing Projects, Workstreams, Documents, Criteria, Work Items, Connected Work Context, Context Intelligence, Updates & Evidence, GitHub Integration, Progress Contract, Daily Composition, and Evaluation Preparation domain ownership.
- Public module readers and commands instead of arbitrary cross-module table reads.
- UTC persistence and current locale/timezone rendering, with `Asia/Riyadh` as the pilot default.
- English-only evaluation is allowed for the pilot. Arabic employee evaluation remains behind T016 semantic approval; Arabic/RTL foundations remain continuously tested.

## 4. Protected separations

- Project progress is operational state calculated only through an approved Progress Contract. It is not employee performance.
- Documentation Readiness is an operational aid. It is not a rating, quota, ranking, or performance score.
- Source-supported facts and employee interpretation remain separately labelled.
- GitHub and connected context remain sources or suggestions. They do not create contribution evidence without the defined human gate.
- AI may draft, organize, compare, summarize, and explain. It never selects, recommends, predicts, normalizes, or challenges a performance rating.
- The manager makes the final employee rating. Employee reservation does not change it or block closure.
- Pilot upward manager feedback is `Identified`; no anonymity or confidentiality promise is shown.
- Leave and low activity never create a negative performance conclusion.
- Historical ownership, criteria, evaluations, feedback, delegations, and audit records are never rewritten or deleted to reflect later state.

## 5. Extensibility model

### 5.1 Configuration inheritance

Known variation is configured through explicit, versioned layers:

```text
System default
→ Organization
→ Department
→ Project where applicable
→ Immutable cycle or operation snapshot
```

Templates, criteria, weights, rating scales, cadence, notification schedules, privacy policy, retention policy, AI routes, connectors, and approval rules are data/configuration—not hardcoded feature branches.

### 5.2 Stable contracts

- Every public command, query, event, AI output, job envelope, and export payload has a stable name and explicit schema version.
- Breaking changes create a new version. Existing consumers are migrated deliberately.
- Unknown input fields fail strict validation; unknown future event versions remain quarantined rather than reinterpreted.
- State machines may grow prospectively, but historical rows retain the state semantics active when written.

### 5.3 Adapter boundaries

Google, GitHub, email delivery, object storage, AI providers, telemetry, and backup targets use narrow adapters. A new adapter does not change Project, Evaluation, Coaching, or Continuity rules. No generic plugin platform, microservice split, or second store is introduced without a proven requirement and approval.

### 5.4 Additive storage evolution

- Forward-only migrations after shared use.
- Append-only revisions/events for protected history.
- Compatibility verification from an empty database and the previous release snapshot.
- Backfills are idempotent or checkpointed and never silently reclassify history.

## 6. End-to-end information flow

1. Approved Project documents create versioned Project context, dynamic criteria, and Progress Contracts.
2. Tasks, Updates, Evidence, connected context, GitHub sources, and Research/Experiments create governed operational records.
3. Progress uses only approved measurable rules and authorized confirmations.
4. Evaluation Cycle creation freezes rubric, eligibility, visibility, dates, and relevant configuration.
5. Evaluation Fact View composes source-supported facts with responsibility periods while keeping employee interpretation separate.
6. Employee and manager assessments remain independent until both are submitted.
7. Comparison supports discussion; the manager records the final human rating; closure creates an immutable snapshot.
8. Identified upward feedback remains a separate evaluation model.
9. Coaching consumes authorized source facts and completed human decisions, then offers optional employee-controlled actions.
10. Leave/delegation changes eligibility and responsibility through time-bounded records, not retroactive attribution.
11. Domain events feed notification, reporting, operations, and audit projections without transferring domain authority.

## 7. Reliability and recovery laws

- User drafts survive AI, connector, queue, authentication, and network interruption.
- Idempotency keys and durable operation receipts prevent duplicate effects.
- Optimistic conflicts return the latest version and preserve both histories.
- Protected mutation and audit append succeed or roll back together.
- AI/provider failure permits manual continuation when product rules allow it.
- Connector failure never blocks manual work or fabricates a source result.
- Notification failure retries independently and never rolls back the originating domain action.
- Evaluation finalization, delegation activation/return, ownership transfer, and visibility snapshot changes are transactional.
- Destructive restore remains a protected human operation with preflight, confirmation, rollback, and post-restore integrity checks.

## 8. Verification surfaces

Each subsystem supplies a compact bilingual verification journey with realistic synthetic data. It must expose the primary human decision, loading/empty/draft/pending/stale/failed/confirmed states, recovery, server-side permission denial, keyboard focus, mobile 390 px behavior, RTL/LTR, and mixed-direction technical text.

These routes are not automatically retained in the final frontend. They must avoid internal identifiers, raw queue states, provider errors, model IDs, and backend terminology.

## 9. Execution and review policy

- Subagent-Driven Development executes the approved TDD plans task by task.
- Critical migration, privacy, authorization, audit, concurrency, immutability, AI boundary, and finalization work receives one specification-compliance review and one security/code-quality review.
- Confirmed P0/P1 findings receive one bounded remediation cycle and focused re-review.
- P2/P3 improvements are recorded without blocking unless they violate an approved criterion or protected rule.
- Focused tests run after each task, related integration tests at bundle completion, and the full repository suite after shared-foundation changes, major integration checkpoints, and before merge.

## 10. Engine completion gate

The engine is complete only when:

- no pilot-required capability remains `PLANNED`;
- every `COMPLETE` capability cites production code and executed verification;
- every external credential/consent/infrastructure dependency is an explicit `EXTERNAL_GATE` behind a tested adapter and recovery path;
- every migration passes empty-database and previous-snapshot verification;
- every public contract is versioned, authorized, and covered by positive and negative tests;
- complete employee, manager, and System Administrator technical journeys pass without direct database edits;
- AI/rating, privacy, readiness, progress, activity-volume, and historical-integrity prohibitions pass repository scans and behavioral tests;
- backup/restore and operational dry-run evidence exist;
- merged-main GitHub Actions is green and no P0/P1 remains;
- E7 publishes the reconciled Feature Register, Customer Journey Map, Engine Completion Audit, and frontend handoff.

Only then may the separate final intelligent-frontend design begin.

## 11. Bounded subsystem specifications

- `2026-08-05-research-experiments-engine-design.md`
- `2026-08-05-employee-evaluation-engine-design.md`
- `2026-08-05-identified-manager-evaluation-engine-design.md`
- `2026-08-05-coaching-development-engine-design.md`
- `2026-08-05-continuity-offboarding-engine-design.md`
- `2026-08-05-notifications-reporting-administration-engine-design.md`
- `2026-08-05-security-recovery-readiness-engine-design.md`
- `2026-08-05-engine-integration-audit-design.md`
