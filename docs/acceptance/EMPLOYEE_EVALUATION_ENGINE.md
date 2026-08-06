# Employee Evaluation Engine — E4 Technical Acceptance

**Status:** local technical checkpoint verified; final product UX not accepted

**Date:** 2026-08-06
**Capabilities:** CAP-028–CAP-032
**Tasks:** T045–T054

## Outcome

The bounded employee-evaluation engine now exposes protected APIs for template activation, cycle
opening and transitions, eligibility decisions, self and independent manager assessments, discussion,
post-rating AI wording help, final human manager decisions, acknowledgment/reservation, closure, and
immutable employee/department report projections.

The implementation preserves the protected boundaries: Cycle 1 is `Calibration — Non-Baseline`,
Fact View precedes employee interpretation, the manager cannot read the self submission before the
manager submission, the System Administrator cannot finalize, no AI route emits a rating, no project
average is calculated, and a reservation does not alter the final manager judgment.

The route at `/{locale}/evaluations/{cycleId}` is a technical verification surface, not the final
employee or manager UX. English exercises the approved rubric. Arabic exercises the localized RTL
shell and explicitly blocks evaluation content because the Arabic rubric and semantic review remain
unapproved.

## Real PostgreSQL lifecycle

Run from the repository root with the normal local environment:

```bash
pnpm exec tsx scripts/seed-employee-evaluation-acceptance.ts
```

The rerunnable seed creates one real employee/assigned-manager Cycle 1 and drives it only through the
public template, cycle, assessment, discussion, and finalization services after fixture foundation
setup. It saves and submits both assessments, proves the manager independence gate, records a
source-bound discussion, creates the human final snapshot, preserves an employee reservation, and
closes the cycle. The verified receipt was:

```json
{
  "cycleId": "4f5a823b-b2f2-434c-9ac5-f34fde8e2c2f",
  "assignmentId": "9baf7f6d-2711-4704-b207-eb93102a71b6",
  "state": "CLOSED",
  "fixture": "postgresql-domain-services"
}
```

The seed contains no ranking, productivity score, Documentation Readiness value, automatic project
average, provider credential, or AI-produced rating.

## Authorization and privacy evidence

- every assignment request reloads the frozen employee/manager assignment from PostgreSQL;
- configuration actions reload role assignments and enforce System Administrator or
  department-scoped manager access server-side;
- another employee cannot read the assignment;
- the employee cannot read the manager draft;
- the System Administrator has no implicit finalization authority;
- malformed identifiers and strict-body failures return a safe validation error;
- finalization and report reads reauthorize through the domain reader after the guard;
- justification wording uses `evaluation.justification` through the AI Router only;
- manager views contain no individual Documentation Readiness percentage or ranking.

## Browser evidence boundary

The three Playwright journeys use the deterministic workspace API fixture. They prove the rendered
contract and authorization behavior, but they do not claim that the browser itself drove the real
PostgreSQL lifecycle. The separate seed and integration suite provide that evidence.

The browser verifies:

1. Fact View is visually before employee interpretation;
2. self and independent manager submissions, comparison/discussion, final human decision,
   reservation, and immutable closure are present;
3. the assigned manager uses a separate authenticated session;
4. an unrelated employee is denied;
5. Arabic is RTL at 390 px and displays the explicit unapproved-rubric gate;
6. no recommended rating, employee rank, or productivity score is rendered.

Screenshots:

- `docs/product/screenshots/engine/employee-evaluation/01-en-employee-closed-cycle.png`
- `docs/product/screenshots/engine/employee-evaluation/02-en-assigned-manager-closed-cycle.png`
- `docs/product/screenshots/engine/employee-evaluation/03-ar-rubric-unavailable-rtl.png`

## Reporting boundary

E4 owns immutable employee and department report projections from the closed snapshot. Generation,
delivery, expiration, and download of export files remain in E6B by approved design. Arabic
evaluation exports remain blocked by the T016 content and semantic-review gate.

## Verification evidence

- focused Employee Evaluation unit/integration/AI/database/API set — 13 files, 56 tests passed;
- protected production API/PostgreSQL authorization suite — 5 tests passed;
- deterministic Employee Evaluation Playwright suite — 3 tests passed;
- API, web, and `@evaluation/employee-evaluation` typechecks — passed;
- acceptance seed — passed through source-bound discussion and immutable closure.

Repository-wide checkpoint results are recorded in the Task 6 report after fresh execution.

## Remaining work

- The final frontend program must design the everyday employee and manager journeys from these
  contracts; this verification route is not product acceptance.
- English export generation/delivery remains E6B. Arabic evaluation content/export remains gated by
  T016.
- Live model quality, provider availability, and deployment monitoring remain operational concerns;
  they do not relax the human-rating boundary.
