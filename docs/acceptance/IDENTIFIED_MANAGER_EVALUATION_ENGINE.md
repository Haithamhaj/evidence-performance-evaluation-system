# Identified Manager Evaluation Engine — Technical Acceptance

**Program:** E5A
**Scope:** T055–T059 / CAP-033–CAP-034
**Status:** Local technical implementation and one bounded P1 remediation cycle complete; corrected-finding re-review and hosted checks are owned by the checkpoint integrator.

## Outcome

The pilot can run a separate quarterly upward manager evaluation in truthful `IDENTIFIED` mode:

- five approved manager criteria and their anchors are frozen with the cycle;
- eligible employees submit one immutable set of five human-selected ratings and comments;
- the employee must explicitly confirm that identity, completion, ratings, comments, and the server-recorded submission time are visible to the authorized manager;
- the frozen manager sees named originals immediately and sees submitted, pending, approved-leave, postponed, and excluded states from the frozen snapshot;
- employees cannot read peers, another manager cannot read the cycle, and System Administrator cannot read response content merely by role;
- future manager-blinded and anonymous-aggregated contracts remain disabled and fail closed;
- optional AI themes use `manager-evaluation.summary` v1 through the AI Router, cite at least two distinct response IDs, state limitations, and never rate, rank, score, or judge the manager.

No coaching or development behavior from E5B is included.

## Bounded P1 remediation

The single E5A remediation cycle closes the four confirmed findings without changing `IDENTIFIED`
mode or any protected product rule:

1. Submission timing now evaluates `startsAt <= serverNow < endsAt` inside the serializable write
   transaction and stores the same server instant for submission, immediate visibility, eligibility,
   and the append-only decision. A client `confirmedAt` cannot backdate an otherwise closed cycle.
2. `manager-evaluation.summary` now sends the prompt-aware runtime envelope only:
   `trustedInstruction` contains the registered route/artifact/version/SHA-256 descriptor, while all
   identified ratings and comments remain under `untrustedContent`. The service reloads and verifies
   the exact immutable prompt artifact before routing, and a real prompt-aware adapter test proves the
   trusted system/untrusted user separation. No trusted prompt body is accepted inline from the
   feature.
3. The manager cycle report composes completion, identified originals, the latest summary revision,
   source IDs, and its read audit from one repeatable-read transaction and one generated-at instant.
4. Standalone completion reads and persisted summary generations are audited transactionally. Their
   audit payloads contain only mode, counts, revision, and target identifiers—never employee display
   names, original comments, or other private response content.

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

- Manager-evaluation package: `5 files / 10 tests` passed.
- AI evaluation: `1 file / 1 test` passed.
- Protected API/PostgreSQL plus real prompt-aware adapter journeys: `2 files / 6 tests` passed.
- Localization: `2 files / 24 tests` passed.
- Browser journey: `2 tests` passed (English identified manager view; Arabic RTL gate).
- API and manager-evaluation package typechecks passed.
- API, package, script, integration-test, and web focused lint passed.
- AI boundary (`889` source files), protected performance-input (`723` files), and secret (`1,328`
  files) scans passed after remediation.
- All 30 migrations deployed successfully to the real local database; the E5A seed passed twice with stable identifiers.

The focused remediation run used the workstation's Node.js `22.23.1` and pnpm `11.13.0`; every
command passed with the repository's expected engine warning. The merge checkpoint must repeat the
affected commands on the repository-pinned Node.js `24.18.0`.

The final bundle checkpoint additionally runs the relevant migration verification, protected scans, task graph, formatting, and root-owned critical reviews before merge.

## Security and privacy impact

- Identified originals are visible only to the manager frozen in the cycle snapshot.
- System Administrator remains configuration/health only for this domain.
- Every cycle activation, eligibility decision, immutable submission, completion read, identified
  manager read, and persisted summary generation creates a content-safe audit record.
- Deactivation blocks new submission while historical foreign keys and responses remain intact.
- Unsupported visibility modes cannot create an identified projection.
- AI input uses a verified immutable prompt descriptor plus delimited untrusted content; output is
  strict/versioned/source-bounded, and failure does not affect originals or completion.

## Deferred P2

The E4-to-E5A API composition currently resolves an evaluator's display label from the live `User`
record while adapting the otherwise frozen eligibility boundary. Persisting and projecting a frozen
display-label snapshot is a non-blocking historical-display hardening item. Evaluator IDs,
eligibility, manager authority, submission content, and timestamps are already frozen or immutable.
It is recorded here only and was not implemented in this bounded P1 cycle.

## Remaining gates

- Root-owned corrected-finding re-review only; do not restart the full review.
- Hosted CI on the pushed branch.
- Arabic rubric content and semantic review remain behind T016.
- Full product UX is deferred until the complete engine reaches E7.
