# Identified Upward Manager Evaluation Engine Design

**Status:** Product Owner approved as part of the Complete Engine Program on 2026-08-05  
**Program:** E5A  
**Capability scope:** CAP-033–CAP-034 and T055–T059

## 1. Outcome

Run the pilot’s separate quarterly upward manager evaluation truthfully in `Identified` mode: eligible employees submit named ratings/comments against the five approved manager criteria; the manager immediately sees authorized identity, completion, ratings, comments, and timestamps; optional summaries remain source-linked and do not replace originals or assign a manager judgment.

## 2. Domain ownership

Add one bounded Manager Evaluation domain. It owns manager-evaluation template/cycle snapshots, evaluator eligibility, identified submissions, criterion responses, immutable comment records, completion projection, optional aggregate/theme revisions, visibility-policy snapshots, isolated future-mode identity-link contracts, and sensitive-access hooks.

It consumes employee-evaluation cycle timing, approved leave/eligibility, identity/manager relationships, localization, notifications, audit, and AI Router through public interfaces. It never stores employee technical-assessment responses in this domain.

## 3. Pilot configuration

- Five manager criteria and anchors are seeded exactly from `docs/EVALUATION_RUBRIC.md`.
- The pilot cycle visibility mode is `IDENTIFIED` and is frozen when the cycle opens.
- The interface and API metadata state clearly that submissions are identified; no anonymity, manager-blinding, confidential-original, or delayed-publication promise is made.
- Future `MANAGER_BLINDED` and `ANONYMOUS_AGGREGATED` modes exist only as fail-closed versioned policy contracts and tests. They are not selectable or active in the pilot.

## 4. Eligibility and completion

Cycle creation snapshots the manager, eligible employees, relationship/department scope, leave state, dates, rubric version, and visibility mode. States per employee are `ELIGIBLE_PENDING`, `SUBMITTED`, `APPROVED_LEAVE`, `POSTPONED`, or `EXCLUDED_BY_AUTHORIZED_MANAGER`.

Approved leave may postpone or exclude that employee before cycle closure; it does not delay or hide other submitted responses. Completion counts derive from the frozen eligibility snapshot and never from current organization membership.

## 5. Submission

Each employee submits one response per cycle with a 1–5 rating and optional/required configured comment for every criterion. The submission explicitly confirms the Identified notice. It validates the frozen rubric, records identity and timestamp, and becomes immutable in one transaction.

Submission is idempotent. Employees cannot read peer status or content. A manager cannot submit on behalf of an employee. AI does not select or rewrite ratings and is not required for submission.

## 6. Manager response and completion view

The authorized manager sees:

- the frozen eligible employee list;
- submitted/pending/approved-leave/postponed/excluded state;
- every submitted employee name;
- criterion ratings and written comments;
- submission timestamp;
- optional source-linked aggregate/theme revisions when available.

Responses become visible immediately after each submission. The manager does not wait for a full-team publication threshold.

## 7. Optional summaries

AI may calculate criterion distributions and draft repeated strengths, improvement themes, and cross-cycle themes from submitted records. Every theme cites the contributing response IDs and period, declares support count/limits, and does not invent consensus, suppress an identified original, recommend a rating, or label the manager successful/failed.

Low-support or unique-sensitive content remains visible only as the original identified response in the pilot and is not generalized as a repeated theme. Historical summary revisions remain traceable to prompt/schema/model route versions.

## 8. Future-mode isolation foundation

Visibility behavior is selected by a versioned policy object pinned to the cycle. Projection factories, identity-link interfaces, topic-suppression contracts, and pre-access audit hooks are designed so a future private mode cannot reuse the Identified response projection accidentally.

Private modes remain disabled until an explicit product/security approval defines governance, independent role, sensitive-access approval, aggregation thresholds, and incident procedures. Unknown/private modes fail closed.

## 9. Authorization, privacy, and audit

- Employee: own eligibility and own submission only.
- Pilot manager: identified originals and completion for their frozen cycle only.
- System Administrator: configuration/health, not response content merely by role.
- Other manager/employee: no cycle or response access.
- Every cycle activation, eligibility decision, submission, manager read, summary run, export projection, visibility configuration, and future sensitive access is audited as required.

## 10. Failure and recovery

- Draft remains local/private until immutable submit succeeds.
- Duplicate submit returns the original receipt.
- Leave updates after snapshot require an authorized eligibility event; current state never silently rewrites the snapshot.
- AI summary failure leaves originals and completion fully usable.
- Unsupported visibility modes and missing policy versions fail closed.
- Deactivated employees cannot authenticate, but their historical identified response remains intact and readable under the cycle policy.

## 11. Extensibility

Rubric, cadence, comment requirement, eligibility rule, visibility mode, summary schema, and report projection are versioned. New privacy modes add distinct projections and authorization policies instead of conditionally removing fields from the Identified payload.

## 12. Verification

- Seed/rubric and cycle-snapshot tests.
- Employee self-only and peer-isolation tests.
- Manager positive/negative identified visibility tests.
- Immediate visibility and leave-aware completion tests.
- Immutable/idempotent submission and deactivation-history tests.
- AI source-grounding/no-judgment tests.
- Future-mode contract tests proving identity/originals cannot leak.
- English end-to-end Identified journey and bilingual notice/RTL shell verification.

## 13. Exit gate

One realistic cycle proves named submission, peer isolation, manager completion/original access, leave handling, optional grounded summaries, immutable history, truthful copy, and no unresolved P0/P1.
