# Engine Technical Dry Run — E6C

## Outcome

The E6C checkpoint proves that the engine can be operated, observed, backed up, restored to an isolated target, and exercised across its existing technical surfaces without weakening protected product rules. It is technical acceptance only. It is not approval of the final employee frontend, production deployment, live provider credentials, or Arabic evaluation content.

## Simulated English quarter coverage

| Stage                   | Protected outcome                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily work              | Project-required Tasks, private Inbox, manual path, sources and governed operational progress; no activity-volume progress or employee score |
| Research & Experiments  | Explicit sources, retained failed experiment, confirmed conclusion, Evidence and Applied Learning                                            |
| Employee evaluation     | `Calibration — Non-Baseline`, Fact View before interpretation, independent assessments and final human manager judgment                      |
| Upward manager feedback | Pilot remains `Identified`; named originals and approved-leave exclusion are preserved                                                       |
| Coaching & development  | Employee-controlled actions and manual recovery; no AI rating or manager-forced acceptance                                                   |
| Continuity              | Leave, bounded delegation, return, immediate deactivation, manager reassignment and immutable history                                        |
| Operations              | Notification dedupe/retry, private reproducible export and revocation, safe administration and redacted observability                        |
| Recovery                | Signed encrypted backup, explicit recovery point, isolated restore, schema/hash/integrity comparison and production fail-closed guard        |

Non-evaluation Arabic/RTL remains supported. Arabic employee evaluation remains explicitly gated pending approved Arabic rubric content and semantic review.

## Verification evidence

The final E6C gate runs on the bounded Pull Request 25 branch. Its recovery proof uses a freshly migrated isolated local test database, not a shared or production database. The 2026-08-10 remediation replaced synthetic recovery counters and in-memory load/queue claims with live PostgreSQL, Redis, object-payload, configuration, and runtime-alert checks.

| Verification                | Result                                                                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository verification     | Passed: task graph, formatting, 32 lint/typecheck/build tasks, boundary/copy/secret/performance-input scans, 215 test files and 1,377 tests                                                  |
| Unit coverage               | Passed configured policy: 34.01% statements, 26.63% branches, 32.51% functions, 35.61% lines                                                                                                 |
| Integration                 | 157 files passed, 2 skipped; 872 tests passed, 13 skipped                                                                                                                                    |
| AI evaluations              | 12 files passed; 188 tests passed, 1 intentionally skipped                                                                                                                                   |
| Migrations                  | 38 migrations verified from empty, previous release snapshot, drift check, and rebuild equivalence; 77 database tests passed                                                                 |
| Browser journeys            | 54 passed, 4 intentionally skipped because superseded manual-update journeys moved to the approved later slice                                                                               |
| Protected API matrix        | 46 controllers classified against 25 policy rows; every row names and content-validates allow, deny, and audit/receipt evidence                                                              |
| Backup and isolated restore | PostgreSQL 17 custom dump restored to a new isolated database; object payload and configuration restored; protected rows, foreign keys, hashes, and append-only controls queried and matched |
| Resilience and pilot load   | Real PostgreSQL concurrent reads and 1,200-row protected-history pagination, real Redis queue pressure, persisted manual fallback during AI outage, and idempotent replay passed             |
| Runtime alerting            | Administration health now converts live dependency probes into engine signals and actionable alerts                                                                                          |
| Executable engine dry run   | 8/8 stages passed on 2026-08-10, including encrypted backup and actual protected isolated restore                                                                                            |

The cross-engine browser evidence is
[`engine-technical-dry-run-ar.png`](../product/screenshots/engine/security-recovery/engine-technical-dry-run-ar.png).

The bounded independent review identified five P1 gaps and the single authorized remediation cycle addressed them: structured-log allowlisting prevents unknown private fields from leaking; retention resolution is organization/resource/time scoped; protected API evidence now proves allow/deny/audit semantics; backup/restore uses real database and object state; and operational alert/load/outage proofs use runtime wiring and real dependencies. Only these corrected findings will be re-reviewed; the full review is not restarted. No production rule was weakened.

## External and human gates

The truthful open gates are maintained in [the external gate register](../operations/EXTERNAL_GATE_REGISTER.md). Most importantly:

- production OIDC, providers, connectors, telemetry, email, storage, Redis, backup destination, key custody, and deployment configuration require accountable external owners;
- any shared or production restore is a destructive operation requiring direct human approval;
- T077 production pilot launch is not complete;
- the full frontend design and customer-journey acceptance begin only after E7 source-to-code integration audit;
- Arabic employee evaluation release remains gated by T016.

## Remaining decision

E6C can now hand off to E7. E7 must reconcile every implemented capability and source path before the dedicated intelligent frontend program starts.
