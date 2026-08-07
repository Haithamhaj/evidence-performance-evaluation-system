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

The final E6C gate ran on 2026-08-07 against commit lineage
`b5e679e56d208f8734abcc3f013b62219c227915` →
`29da3975b2633fdd01093b2abc9b08d169f2e1f7`, the history represented by Pull
Request 5. The executable dry run used a freshly migrated isolated local test
database, not a shared or production database, and passed all eight stages.

| Verification | Result |
| --- | --- |
| Repository verification | Passed: task graph, formatting, 32 lint/typecheck/build tasks, boundary/copy/secret/performance-input scans, 215 test files and 1,377 tests |
| Unit coverage | Passed configured policy: 34.01% statements, 26.63% branches, 32.51% functions, 35.61% lines |
| Integration | 157 files passed, 2 skipped; 872 tests passed, 13 skipped |
| AI evaluations | 12 files passed; 188 tests passed, 1 intentionally skipped |
| Migrations | 37 migrations verified from empty, previous release snapshot, drift check, and rebuild equivalence; 77 database tests passed |
| Browser journeys | 54 passed, 4 intentionally skipped because superseded manual-update journeys moved to the approved later slice |
| Protected API matrix | 46 controllers classified against 25 policy rows |
| Backup and isolated restore | 4 tests passed: secret-free signed manifest, production guard, isolated restore, and runbook links |
| Resilience and pilot load | 3 tests passed: representative p95 below 500 ms, manual path during provider outage, and idempotent replay |
| Executable engine dry run | 8/8 stages passed, including encrypted backup and protected isolated restore |

The cross-engine browser evidence is
[`engine-technical-dry-run-ar.png`](../product/screenshots/engine/security-recovery/engine-technical-dry-run-ar.png).

One bounded self-review found and remediated two security/privacy gaps: a new
`/api/v1/*` controller can no longer inherit only the generic authenticated-root
classification, and future private modes now fail closed for an unsafe topic
support threshold or a sensitive identity read without a non-empty audit reason.
No P0/P1 finding remains. During the final integration gate, three legacy test
fixtures were also aligned with already-approved production behavior: the
continuity HTTP fixture now supplies its authoritative event publisher,
approved-leave fixtures now create real authoritative leave effects, and the
eligibility fixture allocates repeatable non-colliding version numbers. No
production rule was weakened.

## External and human gates

The truthful open gates are maintained in [the external gate register](../operations/EXTERNAL_GATE_REGISTER.md). Most importantly:

- production OIDC, providers, connectors, telemetry, email, storage, Redis, backup destination, key custody, and deployment configuration require accountable external owners;
- any shared or production restore is a destructive operation requiring direct human approval;
- T077 production pilot launch is not complete;
- the full frontend design and customer-journey acceptance begin only after E7 source-to-code integration audit;
- Arabic employee evaluation release remains gated by T016.

## Remaining decision

E6C can now hand off to E7. E7 must reconcile every implemented capability and source path before the dedicated intelligent frontend program starts.
