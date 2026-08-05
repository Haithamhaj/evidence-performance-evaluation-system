# Slice 6 — Evaluation Fact View Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for bounded implementation. Complete one bounded specification-compliance review and one bounded privacy/neutrality review because this slice prepares protected evaluation inputs. Re-review only confirmed P0/P1 corrections. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a neutral, source-supported view of work facts for later quarterly self-assessment and manager assessment without implementing the complete evaluation workflow or recommending a rating.

**Architecture:** Add one read-only Evaluation Preparation package that composes authorized public readers from Projects, Work Items, Updates & Evidence, Documents, criteria, and responsibility history. It does not read foreign tables directly and does not create a second evidence store. Source facts and employee interpretation remain structurally distinct.

**Tech Stack:** Existing modular packages, NestJS, Zod, Next.js/React, Vitest, Playwright.

## Global Constraints

- Phase 2 stops at Fact View preparation.
- Employee and manager ratings remain Phase 3 human workflows.
- AI does not assign, predict, recommend, normalize, or challenge a rating.
- Manager final rating remains a human decision under the approved rubric.
- The Fact View distinguishes source-supported facts from employee interpretation.
- Project count, task count, activity volume, GitHub volume, readiness, and Project progress do not become performance scores.
- Historical responsibility windows and active-at-the-time criteria versions govern attribution.
- Documentation Readiness stays separate and individual readiness percentages remain hidden from managers.

---

### Task 1: Define a neutral Fact View contract

**Files:**

- Create: `packages/evaluation-preparation/package.json`
- Create: `packages/evaluation-preparation/tsconfig.json`
- Create: `packages/evaluation-preparation/src/index.ts`
- Create: `packages/contracts/src/evaluation-fact-view.ts`
- Create: `packages/contracts/src/evaluation-fact-view.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `pnpm-workspace.yaml`

**Contract:**

```ts
type EvaluationFactView = {
  cycleId: string;
  subjectEmployeeId: string;
  responsibilityWindows: ResponsibilityWindowFact[];
  projectFacts: ProjectContributionFact[];
  confirmedEvidence: EvidenceFact[];
  checkInFacts: CheckInFact[];
  dynamicCriteriaVersions: CriterionVersionFact[];
  employeeInterpretations: EmployeeInterpretation[];
  sourceCoverageNotes: CoverageNote[];
};
```

- [x] Write failing schema tests that require source IDs, timestamps, effective versions, responsibility windows, and fact/interpretation labels.
- [x] Add a prohibited-field scan test for rating suggestions, predictions, ranks, productivity scores, readiness percentages, and automatic Project averages.
- [x] Keep criterion stable IDs and locale/version identity.
- [x] Run contract tests and protected scans.
- [x] Commit as `feat(evaluation): define neutral fact view contract`.

### Task 2: Compose facts through public module readers

**Files:**

- Create: `packages/evaluation-preparation/src/fact-view-service.ts`
- Create: `packages/evaluation-preparation/src/fact-view-service.integration.test.ts`
- Create: `packages/evaluation-preparation/src/fact-normalizer.ts`
- Create: `packages/evaluation-preparation/src/fact-normalizer.test.ts`
- Modify: `packages/projects/src/index.ts`
- Modify: `packages/work-items/src/index.ts`
- Modify: `packages/updates-evidence/src/index.ts`
- Modify: `packages/documents/src/index.ts`

**Reader boundary:**

```ts
export interface EvaluationSourceReader {
  readAuthorizedFacts(input: {
    subjectEmployeeId: string;
    cycleStart: Date;
    cycleEnd: Date;
    requester: AuthorizedActor;
  }): Promise<readonly SourceFact[]>;
}
```

- [x] Write failing tests for actual responsibility periods, deactivated historical users, prospective criterion versions, approved leave, and immutable source references.
- [x] Write tests that deduplicate the same source without counting volume or creating averages.
- [x] Normalize self-presentation differences by organizing facts consistently, not by scoring or judging them.
- [x] Use public readers only; add the smallest missing read interface to each owning package.
- [x] Run package integration tests and typecheck.
- [x] Commit as `feat(evaluation): compose authorized source facts`.

### Task 3: Add protected Fact View API

**Files:**

- Create: `apps/api/src/evaluation-preparation/evaluation-preparation.module.ts`
- Create: `apps/api/src/evaluation-preparation/evaluation-fact-view.controller.ts`
- Create: `apps/api/src/evaluation-preparation/evaluation-fact-view-policy.guard.ts`
- Create: `apps/api/src/evaluation-preparation/evaluation-fact-view.e2e.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

**Endpoint:**

```text
GET /api/v1/evaluation-cycles/:cycleId/employees/:employeeId/facts
```

- [x] Test employee self-access, authorized manager access for the active responsibility relation, administrator separation, inactive principal denial, and cross-team denial.
- [x] Test active cycle visibility mode does not leak protected upward-feedback data.
- [x] Test manager responses contain no individual Documentation Readiness percentages.
- [x] Preserve source authorization even when a fact refers to historical or deactivated records.
- [x] Run focused API integration tests and protected scans.
- [x] Commit as `feat(api): expose protected evaluation fact view`.

### Task 4: Build the neutral Fact View UI

This route is a technical contract-verification surface for the engine program. It proves authorized
composition, neutrality, localization, accessibility, and source traceability; it is not final
frontend or Product Owner UX acceptance. The dedicated full-frontend program starts only after the
engine inventory and handoff are complete.

**Files:**

- Create: `apps/web/src/platform/evaluation-fact-view-api.ts`
- Create: `apps/web/src/platform/evaluation-fact-view-api.test.ts`
- Create: `apps/web/src/app/[locale]/evaluations/facts/page.tsx`
- Create: `apps/web/src/app/[locale]/evaluations/facts/evaluation-fact-view.tsx`
- Create: `apps/web/src/app/[locale]/evaluations/facts/source-facts-section.tsx`
- Create: `apps/web/src/app/[locale]/evaluations/facts/employee-interpretation-section.tsx`
- Create: `apps/web/src/app/[locale]/evaluations/facts/coverage-notes.tsx`
- Create: `apps/web/src/app/[locale]/evaluations/facts/evaluation-fact-view.test.tsx`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`

- [x] Test facts appear before employee narrative.
- [x] Label employee narrative as interpretation, not source fact.
- [x] Organize by approved rubric areas and contribution context without deriving a score.
- [x] Show source links, effective criteria, time windows, and missing coverage neutrally.
- [x] Do not place rating controls in this Phase 2 route.
- [x] Keep evaluation navigation separate from Today, readiness, and manager operations.
- [x] Run focused web/localization tests and typecheck.
- [x] Commit as `feat(web): add neutral evaluation fact view`.

### Task 5: Neutrality and privacy acceptance checkpoint

**Files:**

- Create: `tests/e2e/evaluation-fact-view.spec.ts`
- Create: `tests/ai/evaluation-fact-view-neutrality.eval.test.ts`
- Create: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_6.md`
- Create screenshots under: `docs/product/screenshots/ai-first-daily-workspace/slice-6/`

- [x] Demonstrate the same source facts for employee and authorized manager, subject to lawful role-specific privacy fields.
- [x] Demonstrate explicit separation between source facts and employee interpretation.
- [x] Verify absence of AI rating language, ranking, productivity score, automatic Project average, and manager-visible readiness percentage.
- [x] Verify historical responsibility and dynamic criterion versions.
- [x] Run focused tests, related integration tests, neutrality evaluations, affected lint/typechecks, and protected scans.
- [x] Complete bounded specification and privacy/neutrality reviews; remediate confirmed P0/P1 only.
- [ ] Commit as `test: verify evaluation fact view neutrality`.
- [ ] Push, create or update the current Slice 6 Pull Request, and publish the technical verification URLs/screenshots.

## Technical Acceptance Checkpoint

Verify that the Fact View can support a fair later assessment while remaining visibly neutral. This
checkpoint does not authorize the complete self-assessment, manager-assessment, comparison,
discussion, or final-rating workflow, and it does not constitute final frontend acceptance.

## Phase Completion Checkpoint

After Slice 6 technical acceptance:

- [x] Run the full repository verification suite, migrations from empty and previous release snapshot, AI evaluations, and protected browser journeys.
- [x] Update operational documentation, `TASKS.md`, and `project-state/PROJECT_STATE.md`.
- [x] Record P2/P3 findings in backlog issues without hiding them.
- [ ] Make the current Slice 6 Pull Request ready only after all required CI checks pass.
- [ ] Merge only after the technical evidence and hosted CI are green, then continue the approved engine-first program.
