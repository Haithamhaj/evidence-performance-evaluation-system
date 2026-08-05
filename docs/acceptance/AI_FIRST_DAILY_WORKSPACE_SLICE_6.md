# AI-first Daily Workspace — Slice 6 Technical Acceptance

**Status:** Local technical verification complete; hosted Pull Request checks pending

**Branch:** `codex/phase-2-slice-6-evaluation-preparation`

**Pull Request:** [#11](https://github.com/Haithamhaj/evidence-performance-evaluation-system/pull/11)

**Acceptance date:** 2026-08-05

**Confidence:** High for the implemented read contract, source composition, authorization, neutrality,
localization foundation, and deterministic browser journey. Medium for future evaluation-cycle
immutability because the complete Cycle Snapshot engine belongs to T045–T046 and is not implemented in
this slice.

## Outcome

Slice 6 adds a read-only Evaluation Fact View preparation layer. It composes source-supported work facts,
historical responsibility periods, confirmed evidence, effective dynamic criteria, check-ins, source
coverage notes, and employee interpretation without creating a score or making an assessment decision.

This is the final Phase 2 engine slice. It does **not** implement self-assessment, manager assessment,
comparison, discussion, final rating, or evaluation closure. The included page is a technical contract
verification surface, not the final employee experience.

## Source composition

The `evaluation-preparation` package composes public readers owned by the existing domains. It does not
read another module's tables directly and does not create another evidence store.

| Fact group                 | Authoritative source                          | Preparation behavior                                                                             |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Responsibility periods     | Projects responsibility history               | Uses half-open historical windows and preserves the source identity.                             |
| Project contribution facts | Confirmed Updates & Evidence timeline records | Keeps result, verification, attribution, Work Item link, and source references.                  |
| Confirmed evidence         | Confirmed evidence revisions                  | Includes the supported claim and contribution context only after the employee confirmation gate. |
| Dynamic criteria           | Criteria versions effective during the cycle  | Preserves stable criterion identity, exact version, locale, and effective dates.                 |
| Check-ins                  | Authorized check-in reader                    | Keeps operational status and source timing without converting regularity into performance.       |
| Employee interpretation    | Separate interpretation records               | Remains structurally and visually separate from source facts.                                    |

Duplicate source records are normalized by stable identity. No count, frequency, automatic average, or
Project-progress percentage is converted into employee performance.

## Protected API

```text
GET /api/v1/evaluation-cycles/:cycleId/employees/:employeeId/facts
```

The API requires an active authenticated principal and cycle eligibility. The employee may read only
their own view. The manager may read only an assigned employee in the authorized cycle. A different
employee, an unrelated manager, an inactive principal, and an administrator without the manager
relationship are denied server-side.

The response contains neither upward-feedback content nor an individual Documentation Readiness value.
Historical or deactivated source subjects do not weaken the requester's current authorization check.

## Neutrality boundaries

| Boundary                | Verified result                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Human decision          | The schema and page contain no rating control, recommendation, prediction, challenge, or final decision action.                 |
| Source versus narrative | Source-supported facts render before a separately labelled employee interpretation section.                                     |
| Traceability            | Every source fact requires at least one typed source reference with an ID and timestamp.                                        |
| Historical attribution  | Facts link to responsibility windows that overlap the fact time and cycle period.                                               |
| Dynamic criteria        | Stable IDs and effective criterion-version IDs are retained; no retroactive relabeling is performed.                            |
| Documentation Readiness | No individual readiness percentage or ranking is present in the manager projection.                                             |
| Raw activity            | Task, update, Project, commit, file, and line volume are not scoring or weighting inputs.                                       |
| Project progress        | Operational Project progress is not an employee rating and is not exposed as one.                                               |
| AI boundary             | Slice 6 makes no provider call. The AI evaluation verifies the persisted/read schema rejects prohibited judgment-shaped fields. |

## Deterministic acceptance journey

1. Codex, acting as the employee, opens the cycle Fact View.
2. Source-supported Project contribution, confirmed evidence, responsibility period, and effective
   criterion appear with traceable sources.
3. A neutral partial-period coverage note appears without a penalty or score.
4. The employee's interpretation appears later in its own labelled section.
5. The cycle's assigned manager receives the same deterministic source facts.
6. Another employee is denied by the API.
7. The Arabic route renders RTL at 390 px without an overflowing content element.

Technical review URLs follow this form after signing in:

```text
/en/evaluations/facts?cycle=<cycle-uuid>&employee=<employee-uuid>
/ar/evaluations/facts?cycle=<cycle-uuid>&employee=<employee-uuid>
```

## Visual evidence

- [English employee Fact View](../product/screenshots/ai-first-daily-workspace/slice-6/01-en-employee-fact-view.png)
- [English authorized-manager neutral view](../product/screenshots/ai-first-daily-workspace/slice-6/02-en-manager-neutral-fact-view.png)
- [Arabic employee Fact View at 390 px](../product/screenshots/ai-first-daily-workspace/slice-6/03-ar-employee-fact-view-mobile.png)

The first two images are intentionally identical in fact content. Role-specific permissions are enforced
by the API, while this technical view adds no manager-only judgment fields.

## Executed focused verification

| Check                                                     | Result                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Fact contract, normalizer, API policy, and web unit tests | Passed: 5 files, 18 tests.                                                                          |
| Fact composition and protected API integration tests      | Passed: 2 files, 7 tests.                                                                           |
| Neutrality AI evaluations                                 | Passed: 1 file, 7 tests, including Arabic and strict rejection cases.                               |
| Slice 6 browser acceptance                                | Passed: 3 employee, authorized-manager, denial, and Arabic-mobile journeys.                         |
| Affected package typechecks                               | Passed for Contracts, Evaluation Preparation, Projects, Updates & Evidence, Criteria, API, and Web. |
| Affected lint and protected scans                         | Passed locally; full checkpoint results are recorded below after execution.                         |

## Full Phase 2 checkpoint

All local checks ran with repository-pinned Node.js `24.18.0` and pnpm `11.13.0`.

| Check                                   | Result                                                                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository verification (`pnpm verify`) | Passed: task graph, 1,130-file secret scan, 585-file performance-input scan, formatting, 24 lint tasks, 24 typechecks, 1,025 unit/coverage tests, protected boundaries/copy checks, and 24 builds. |
| Related integration suite               | Passed: 593 tests; 13 intentional skips in two superseded test files.                                                                                                                              |
| AI evaluations                          | Passed: 179 tests; one intentional skip.                                                                                                                                                           |
| Migration verification                  | Passed: all 26 migrations on an empty database, previous snapshot upgrade, drift check, rebuild equivalence, and 49 database integration checks. Slice 6 adds no migration.                        |
| Complete browser suite                  | Passed: 41 journeys; four intentional skips for superseded Update flows.                                                                                                                           |
| Working-tree integrity                  | `git diff --check` passed; regenerated images from earlier slices were restored and are not part of this change.                                                                                   |

Hosted `integrity`, `quality`, `build`, and `integration` remain required on the exact Pull Request head
before merge.

## Bounded reviews

### Specification compliance

The implementation was checked against S6-T1 through S6-T5. The public contract, source readers,
protected endpoint, source-first rendering, role checks, localization, deterministic acceptance, and
explicit separation from the complete Phase 3 evaluation workflow are present. No unresolved P0/P1
specification deviation is known.

### Privacy and neutrality

The review covered self versus assigned-manager access, cross-employee and administrator denial,
inactive-principal denial, upward-feedback exclusion, manager readiness exclusion, strict response
schemas, source URL protocol filtering, source/narrative separation, and prohibited assessment fields.
No unresolved P0/P1 privacy or neutrality finding is known.

## Known limitations and later work

1. T045–T046 must implement and freeze the versioned Evaluation Template and Cycle Snapshot before an
   active or closed production evaluation can rely on immutable rubric and visibility configuration.
   The current preparation adapter resolves the rubric version active at cycle start; that is sufficient
   for this read-only preparation slice but is not the final immutable snapshot mechanism.
2. Employee interpretation authoring, autosave, and confirmation belong to the future self-assessment
   workflow. Slice 6 only reads already supplied interpretation records through its boundary.
3. The complete self-assessment, independent manager draft, comparison, discussion, manager final human
   decision, acknowledgment, reservation, and immutable closure remain T048–T053.
4. The current source model can expose confirmed operational check-ins, but the broader leave source and
   complete evaluation-cycle eligibility/snapshot engine remain later dependencies.
5. Arabic/RTL foundations are verified. Arabic employee evaluation release remains blocked until the
   approved Arabic rubric content and semantic review exist.
6. The page is intentionally minimal and must not be treated as the final frontend, information
   architecture, or product usability acceptance.

## Technical checkpoint decision

Slice 6 is ready for the full repository checkpoint and hosted Pull Request verification. It preserves
the protected evaluation boundary and supplies the read-only engine contract required by the later
human evaluation subsystem. Final product and UX acceptance remain deferred until the engine feature
register, remaining subsystems, and dedicated frontend program are complete.
