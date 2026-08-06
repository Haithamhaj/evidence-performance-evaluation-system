# Employee Evaluation Engine Design

**Status:** Product Owner approved as part of the Complete Engine Program on 2026-08-05  
**Program:** E4  
**Capability scope:** CAP-028–CAP-032 and T045–T054

## 1. Outcome

Run one complete quarterly `Calibration — Non-Baseline` employee-evaluation cycle without direct database changes: configure and activate a versioned template, freeze an immutable cycle snapshot, prepare neutral facts, collect independent employee and manager assessments, compare and discuss them, let the manager record the final human judgment, preserve acknowledgment/reservation, close immutably, and expose safe report projections.

## 2. Domain ownership

Add one bounded Employee Evaluation domain. It owns evaluation templates, template versions, cycle roots/snapshots, assignments, assessment drafts/submissions, comparison/discussion records, final decisions, acknowledgment/reservation, closure snapshots, and evaluation report projections.

It consumes only public readers from identity/organization, eligibility/leave, Evaluation Preparation, Criteria, Projects/responsibility, Evidence, Research & Experiments, notifications, localization, audit, and AI Router. It does not duplicate source facts or read owner-domain tables directly.

## 3. Template governance

- Organization template versions define protected sections, mandatory global criteria, rating scale, allowed weight ranges, and policies.
- Department template versions may add/adjust permitted criteria, wording, examples, anchors, and weights within organization rules.
- Activation validates 100% total section weight, 100% fixed-criterion weight within each applicable section, required criteria, stable IDs, locale state, and allowed ranges.
- Active versions are immutable. A change creates a new version for a future cycle.
- Pilot Version 1 is seeded exactly from `docs/EVALUATION_RUBRIC.md`; code never rewrites rubric wording.

## 4. Cycle and eligibility snapshot

A cycle stores cadence, start/end dates, type, template/rubric version, rating scale, visibility mode, participant assignments, manager relationships, eligibility/exclusion reason, leave treatment, locale availability, and configuration versions.

States are `DRAFT → OPEN_PREPARATION → SELF_ASSESSMENT → MANAGER_ASSESSMENT → COMPARISON → FINALIZATION → ACKNOWLEDGMENT → CLOSED`, with a reasoned `CANCELLED` path before closure. Cycle 1 must be `CALIBRATION_NON_BASELINE`; it cannot become an official baseline retrospectively.

Opening the cycle freezes the snapshot transactionally. Active-cycle template, anchors, weights, participants, and visibility mode cannot change. Approved leave may postpone or exclude an assignment only through an authorized append-only eligibility decision.

## 5. Evidence preparation and Fact View

The existing neutral Evaluation Fact View remains the source-composition boundary and expands through its public readers as E3 facts become available. It pins the cycle period and employee responsibility windows, distinguishes source facts from employee interpretation, and records neutral coverage notes for missing or disputed context.

Documentation Readiness values, readiness ranking, employee ranking, productivity scores, activity counts, automatic Project averages, and suggested/predicted ratings are absent from employee and manager evaluation projections.

## 6. Self-assessment

For each of the 12 fixed criteria and the single Project Contribution section judgment, the employee selects a 1–5 rating using the frozen anchors, writes or approves justification, selects relevant facts/evidence, and may record strengths and a development area.

AI assistance starts only after the employee selects a rating. It may structure wording using selected sources and the chosen anchor; it cannot recommend, challenge, normalize, or change the rating. Drafts autosave with optimistic versions. Submission validates completeness, freezes the assessment, records timestamp/source snapshot identity, and is idempotent.

## 7. Independent manager assessment

The assigned manager receives the same frozen criteria, anchors, period, and authorized Fact View plus an explicit direct-observation basis field. The employee rating, justification, and comparison remain unavailable until the manager submits the independent initial assessment.

AI wording help follows the same post-rating rule. Submission is immutable and records proof that the self-assessment projection was not accessed before manager submission.

## 8. Comparison and discussion

After both submissions, the engine calculates only explainable differences: rating gap, high-weight criterion gap, source difference, missing rationale, duration/consistency interpretation, and disputed attribution. It does not compute a recommended midpoint or compromise.

Discussion records are append-only, participant-scoped, and may cite facts or observations. AI may draft a neutral agenda after both ratings exist, with source references and explicit unresolved questions.

## 9. Finalization and closure

The manager selects the final rating per criterion and Project Contribution section, supplies justification, and may preserve or change the initial manager rating with a reason. No automatic average across Projects, Workstreams, or dynamic criteria is allowed.

Finalization transactionally writes final decisions, selected source references, the complete immutable evaluation snapshot, and audit. The employee then may acknowledge, acknowledge with reservation, or not respond. Reservation is preserved and never changes the final rating or blocks authorized closure.

Closed evaluations are immutable. The pilot has no second-level appeal or closed-record editing feature.

## 10. Reporting contracts

The domain exposes immutable projections for employee cycle and department reporting. They include cycle type, period, responsibility windows, Research/Experiments, work facts, self/manager/final assessments, differences, reservation, and development-plan reference when present.

Export generation/delivery belongs to E6B. Arabic evaluation export remains unavailable until T016 approval; English export is permitted. Department projections use distributions/trends without employee ranking or readiness values.

## 11. Authorization and privacy

- Employee reads/writes only their own assignment and sees comparison only after the independent-manager gate.
- Assigned manager reads/writes their employees only.
- System Administrator configures organization templates and cycles according to policy but does not act as manager unless separately assigned an authorized managerial role.
- Closed and cross-department data fail closed.
- Every rating change, submission, eligibility decision, finalization, acknowledgment/reservation, closure, export request, and sensitive access is audited.

## 12. Failure and recovery

- Draft recovery survives authentication/provider interruption.
- Stale versions never overwrite a newer draft.
- Failed AI assistance leaves the selected rating and manual justification path intact.
- Failed submission/finalization leaves the previous complete state intact.
- Retried submission/finalization/acknowledgment returns the original result.
- Missing Fact View sources become neutral coverage notes; they do not fabricate evidence or block all human observation.

## 13. Extensibility

Template, cadence, rating scale, locale availability, eligibility rule, discussion policy, and report projection are versioned configuration. Future organizations may use different templates and cadence, but an active cycle always uses its frozen snapshot. A future formal revision/appeal is a new approved state machine, not an edit to closed data.

## 14. Verification

- Template/weight/activation unit tests.
- Migration and transaction tests from empty/previous snapshots.
- Positive/negative authorization and independent-draft tests.
- AI post-rating and no-rating-output evaluations.
- Fact View neutrality and responsibility-window tests.
- Idempotency, concurrency, finalization, and closed-immutability tests.
- One English `Calibration — Non-Baseline` end-to-end journey, plus Arabic/RTL shell tests without activating the unapproved Arabic rubric.
- Report projection tests proving no rank/readiness/private leakage.

## 15. Exit gate

One realistic employee and manager complete the full cycle through protected APIs and the minimal verification surface; the immutable snapshot and audit are proven; no direct database edit, AI rating, automatic average, privacy leak, or unresolved P0/P1 remains.
