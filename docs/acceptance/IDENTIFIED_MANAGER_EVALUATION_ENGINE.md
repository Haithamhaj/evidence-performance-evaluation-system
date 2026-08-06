# Identified Manager Evaluation Engine — Technical Acceptance

**Program:** E5A  
**Scope:** T055–T059 / CAP-033–CAP-034  
**Status:** Local technical implementation complete; final bundle reviews and hosted checks are owned by the checkpoint integrator.

## Outcome

The pilot can run a separate quarterly upward manager evaluation in truthful `IDENTIFIED` mode:

- five approved manager criteria and their anchors are frozen with the cycle;
- eligible employees submit one immutable set of five human-selected ratings and comments;
- the employee must explicitly confirm that identity, completion, ratings, comments, and submission time are visible to the authorized manager;
- the frozen manager sees named originals immediately and sees submitted, pending, approved-leave, postponed, and excluded states from the frozen snapshot;
- employees cannot read peers, another manager cannot read the cycle, and System Administrator cannot read response content merely by role;
- future manager-blinded and anonymous-aggregated contracts remain disabled and fail closed;
- optional AI themes use `manager-evaluation.summary` v1 through the AI Router, cite at least two distinct response IDs, state limitations, and never rate, rank, score, or judge the manager.

No coaching or development behavior from E5B is included.

## Real PostgreSQL acceptance fixture

`scripts/seed-manager-evaluation-acceptance.ts` is safely rerunnable. It creates one manager and three frozen evaluators with:

- one immutable named submission;
- one pending evaluator;
- one approved-leave evaluator;
- one `IDENTIFIED` visibility snapshot;
- no anonymity/confidentiality promise, readiness percentage, employee rank, or AI judgment.

The seed consumes the public E4 frozen timing/manager/eligibility boundary and the E5A public cycle/submission services. Running it twice returns the same cycle and response without adding a second response or eligibility decision.

## Protected API evidence

The production NestJS module reauthorizes every request. The focused real Nest/PostgreSQL integration proves:

1. the frozen manager reads the named original immediately;
2. completion reports `1 submitted / 1 pending / 1 approved leave`;
3. a peer employee receives `403`;
4. System Administrator receives `403` for original response content;
5. another manager receives `403`;
6. the manager cannot submit on an employee's behalf.

## Technical verification surface

- English: `/{locale}/manager-feedback/{cycleId}` shows the identified notice, frozen completion, submitter name, original ratings/comments, and timestamps.
- Arabic: the RTL shell and identified disclosure render, while unapproved Arabic manager criteria/anchors remain explicitly gated by T016.
- This is bounded technical verification only. It is not the final employee/manager product UX.

## Verification evidence

- Manager-evaluation package: `2 files / 4 tests` passed.
- AI evaluation: `1 file / 1 test` passed.
- Protected API/PostgreSQL journey: `1 file / 5 tests` passed.
- Localization: `2 files / 24 tests` passed.
- Browser journey: `2 tests` passed (English identified manager view; Arabic RTL gate).
- API and manager-evaluation package typechecks passed.
- API, package, script, integration-test, and web focused lint passed.
- All 30 migrations deployed successfully to the real local database; the E5A seed passed twice with stable identifiers.

The final bundle checkpoint additionally runs the relevant migration verification, protected scans, task graph, formatting, and root-owned critical reviews before merge.

## Security and privacy impact

- Identified originals are visible only to the manager frozen in the cycle snapshot.
- System Administrator remains configuration/health only for this domain.
- Every cycle activation, eligibility decision, immutable submission, and manager read creates an audit record.
- Deactivation blocks new submission while historical foreign keys and responses remain intact.
- Unsupported visibility modes cannot create an identified projection.
- AI input is delimited as untrusted, output is strict/versioned/source-bounded, and failure does not affect originals or completion.

## Remaining gates

- Root-owned single specification/visibility review and single security/code-quality review.
- Hosted CI on the pushed branch.
- Arabic rubric content and semantic review remain behind T016.
- Full product UX is deferred until the complete engine reaches E7.
