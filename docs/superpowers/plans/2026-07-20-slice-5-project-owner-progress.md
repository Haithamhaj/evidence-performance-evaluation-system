# Slice 5 — Project Owner Progress and Manager Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for routine UI work and bounded independent reviews for authorization, audit, and official progress immutability. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Progress Contract governance out of the employee daily flow, give Project owners a simple guided setup, show employees a compact operational Project pulse, and give managers actionable queues instead of score-like dashboards.

**Architecture:** Keep the Progress Contract inside Projects and reuse its existing draft, revision, approval, activation, and append-only snapshot services. Refactor the oversized panel into an owner-only setup route. Daily Work consumes a compact authorized Project reader. Manager composition returns actions and exceptions, not rankings or readiness percentages.

**Tech Stack:** Existing Projects package, Daily Work composition, NestJS, Next.js/React, Vitest, Playwright.

## Global Constraints

- Project progress is not employee performance.
- No direct overall percentage entry or override.
- Work Item volume, update frequency, GitHub volume, files, commits, and lines changed are prohibited progress inputs.
- Each contract is versioned and human-approved with milestones, deliverables, operational KPIs, baseline, target, unit, direction, acceptance conditions, required evidence, optional approved weights, owner/approver, effective date, calculation rule, and audited manual condition confirmation.
- Manager views must not expose employee readiness percentages, ranking, productivity scores, completion leaderboards, or predicted ratings.
- Readiness and evaluation remain separate navigation and conceptual paths.

---

### Task 1: Strengthen owner-only setup authorization

**Files:**

- Modify: `apps/api/src/projects/progress-contract-drafts.controller.ts`
- Modify: `apps/api/src/projects/progress-contract-drafts.controller.test.ts`
- Modify: `apps/api/src/projects/progress-contract-drafts.controller.revise.test.ts`
- Modify: `apps/api/src/projects/progress-contract-drafts.controller.apply.test.ts`
- Modify: `packages/projects/src/progress-contract-draft-service.ts`
- Modify: `packages/projects/src/progress-contract-draft-service.integration.test.ts`
- Modify: `packages/projects/src/progress-contract-service.integration.test.ts`

- [ ] Add failing tests for contributor denial, expired owner responsibility, Project/Workstream boundary, reviewer/approver separation, stale revision, and active-version immutability.
- [ ] Preserve AI proposal as a versioned draft only; human revision and approval remain mandatory.
- [ ] Confirm audit events include actor, reason, source document version, draft revision, and applied contract version.
- [ ] Reject attempts to use prohibited raw-activity measures.
- [ ] Run focused Projects and API tests plus performance-input scan.
- [ ] Commit as `fix(projects): enforce owner progress setup boundaries`.

### Task 2: Replace the oversized owner panel with a guided setup

**Files:**

- Refactor: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/progress-contract-draft-panel.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/settings/progress-contract/page.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/settings/progress-contract/source-step.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/settings/progress-contract/components-step.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/settings/progress-contract/rules-step.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/settings/progress-contract/review-step.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/settings/progress-contract/progress-contract-setup.test.tsx`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`

- [ ] Test a four-step journey: choose approved source, review AI proposal, edit measurable rules, submit/approve/activate.
- [ ] Keep technical IDs, prompt versions, route traces, and internal implementation details out of the main interaction; expose safe audit details in a secondary panel.
- [ ] Use compact editable rows and focused drawers/sheets.
- [ ] Make incomplete baselines, targets, units, directions, acceptance conditions, and evidence requirements visibly actionable.
- [ ] Explain that activation governs Project progress and does not evaluate employees.
- [ ] Run focused web/localization tests and typecheck.
- [ ] Commit as `feat(web): simplify project progress setup`.

### Task 3: Build employee Project pulse

**Files:**

- Modify: `apps/api/src/daily-work/project-dashboard-query.service.ts`
- Modify: `apps/api/src/daily-work/daily-work.e2e.integration.test.ts`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/project-progress-panel.tsx`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/project-progress-panel.test.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/project-pulse.tsx`

**Read model:**

```ts
type ProjectPulse = {
  officialProgress: number | null;
  previousOfficialProgress: number | null;
  sourceCoverage: "SUFFICIENT" | "INSUFFICIENT";
  milestoneStates: MilestoneState[];
  nextRequiredEvidence: RequiredEvidenceAction[];
  explanation: ProgressExplanation[];
};
```

- [ ] Test retained official percentage when source coverage is insufficient.
- [ ] Test source-explained decreases and append-only snapshot comparison.
- [ ] Present “what changed,” “what is blocked,” “what evidence is needed,” and “next milestone” before charts.
- [ ] Avoid large metric-only cards and avoid assigning progress to an employee.
- [ ] Run focused Daily Work/Projects/web tests.
- [ ] Commit as `feat(daily-work): add compact project progress pulse`.

### Task 4: Add check-ins and monthly readiness as non-scoring aids

**Files:**

- Create: `packages/updates-evidence/src/check-in-service.ts`
- Create: `packages/updates-evidence/src/check-in-service.integration.test.ts`
- Create: `apps/api/src/daily-work/readiness-query.service.ts`
- Modify: `apps/api/src/daily-work/daily-work.controller.ts`
- Modify: `apps/api/src/daily-work/daily-work.e2e.integration.test.ts`
- Create: `apps/web/src/app/[locale]/my-work/check-in-card.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/readiness/page.tsx`

- [ ] Test Thursday check-in is required only when no substantive update exists.
- [ ] Test approved leave exclusion and actual responsibility periods.
- [ ] Test monthly readiness identifies thin records without evidence quotas or automatic penalties.
- [ ] Test managers do not receive individual readiness percentages or rankings.
- [ ] Keep check-in capture short and route it through the same Updates & Evidence lifecycle.
- [ ] Run focused Updates & Evidence/Daily Work/web tests and protected scan.
- [ ] Commit as `feat(readiness): add non-scoring check-ins and readiness`.

### Task 5: Replace manager metrics with operational queues

**Files:**

- Create: `apps/api/src/daily-work/manager-operations-query.service.ts`
- Create: `apps/api/src/daily-work/manager-operations-query.service.integration.test.ts`
- Create: `apps/web/src/app/[locale]/manager/operations/page.tsx`
- Create: `apps/web/src/app/[locale]/manager/operations/manager-operations-client.tsx`
- Create: `apps/web/src/app/[locale]/manager/operations/action-queue.tsx`
- Create: `apps/web/src/app/[locale]/manager/operations/manager-operations.test.tsx`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`

- [ ] Return actionable queues: approvals waiting, blocked Projects, ambiguous progress evidence, ownership gaps, and upcoming commitments.
- [ ] Test absence of ranking, readiness percentage, productivity score, predicted rating, and employee completion leaderboard fields.
- [ ] Hide employee quick-add/update actions unless the principal is also an authorized contributor or owner.
- [ ] Link readiness and evaluation to separate routes without blending them into operations.
- [ ] Run focused manager query/UI tests and performance-input scan.
- [ ] Commit as `feat(manager): add actionable operations queues`.

### Task 6: Progress and operations acceptance checkpoint

**Files:**

- Create: `tests/e2e/project-owner-manager-operations.spec.ts`
- Create: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_5.md`
- Create screenshots under: `docs/product/screenshots/ai-first-daily-workspace/slice-5/`

- [ ] Demonstrate owner draft/revision/approval/activation with deterministic AI and no automatic activation.
- [ ] Demonstrate employee Project pulse, missing evidence action, check-in, and monthly readiness.
- [ ] Demonstrate manager operational queues and negative assertions for protected fields.
- [ ] Run focused tests, related integration tests, AI evaluations if prompt/schema changed, affected lint/typechecks, and protected scans.
- [ ] Complete bounded specification and authorization/immutability reviews; remediate confirmed P0/P1 only.
- [ ] Commit as `test: verify owner progress and manager operations`.
- [ ] Push, update Pull Request #5, publish URLs/screenshots, then stop.

## Product Owner Stop Gate

The Product Owner reviews whether Project setup is understandable to an owner, whether employees see useful operational progress without evaluation pressure, and whether managers can act without receiving score-like employee dashboards.
