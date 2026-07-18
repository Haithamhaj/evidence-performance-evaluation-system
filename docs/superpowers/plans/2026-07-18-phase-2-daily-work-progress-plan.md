# Phase 2 Daily Work, Progress, Updates, and Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Phase 2 daily-work foundation through seven visible, production-backed vertical slices while preserving the Phase 0/1 modular monolith and every protected product boundary.

**Architecture:** Add only `@evaluation/work-items` and `@evaluation/updates-evidence`. Keep versioned Project/Workstream Progress Contracts and official progress snapshots inside `@evaluation/projects`, then compose authorized My Work, dashboard, Timeline, manager, and Fact View reads in `apps/api`. GitHub and voice are adapters to Updates & Evidence; the prototype store and mock percentage never enter production.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript, NestJS, Next.js App Router, React, Prisma/PostgreSQL, BullMQ/Redis, S3-compatible private storage, Vitest, Playwright, existing AI Router.

## Global Constraints

- Read `AGENTS.md`, `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, `docs/IMPLEMENTATION_PLAN.md`, `project-state/PROJECT_STATE.md`, `TASKS.md`, and `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md` before each slice.
- Do not modify a protected product rule, rubric wording, rating behavior, readiness privacy rule, or historical record.
- Do not call a provider SDK outside `@evaluation/ai-routing`.
- Never read, print, move, log, commit, or persist a provider credential.
- Project/Workstream progress is operational only and never becomes employee performance.
- Work Item count, task volume, update frequency, GitHub activity, commits, files, and lines changed never calculate progress.
- No direct overall-progress percentage override exists.
- GitHub remains suggested evidence until employee confirmation.
- The complete employee evaluation workflow is outside Phase 2.
- Arabic is the default locale; every visible slice ships English, RTL/LTR, keyboard, visible-focus, reduced-motion, mixed-direction, and 390px verification.
- Use forward-only migrations. Verify each migration from an empty database and the Phase 1 release snapshot.
- Use `superpowers:executing-plans` as the default Fast Controlled Execution mode. Use `superpowers:subagent-driven-development` only for the critical authorization, privacy, audit, migration/concurrency/immutability, AI Router, and evaluation-boundary work identified in the affected slice.
- Keep new domain files normally below 300 lines. Do not add Phase 2 behavior to `packages/projects/src/project-service.ts`, `packages/projects/src/workstream-service.ts`, or other existing high-complexity services.
- Run focused tests per task, related integration tests per slice, and the full repository suite only after shared-foundation changes, at a major integration checkpoint, and before the Phase 2 Pull Request becomes ready.
- At each declared product-owner gate: commit, push, update task/project state, provide the local demo and screenshots, then stop.

---

## Planned file ownership

### New domain packages

- `packages/work-items/src/invariants.ts`: Work Item scope, status, assignment, and transition rules.
- `packages/work-items/src/service.ts`: transactional commands and append-only history.
- `packages/work-items/src/query-service.ts`: authorized Work Item/My Work reads.
- `packages/work-items/src/model.ts`: database, audit, clock, and public reader ports.
- `packages/updates-evidence/src/update-service.ts`: update source, clarification, structuring, and confirmation.
- `packages/updates-evidence/src/evidence-service.ts`: manual/suggested evidence, attribution, verification, and confirmation.
- `packages/updates-evidence/src/activity-reader.ts`: source-labelled accepted-event reads.
- `packages/updates-evidence/src/github-adapter.ts`: GitHub suggestion ingestion/disposition.
- `packages/updates-evidence/src/voice-service.ts`: private audio/transcript lifecycle.
- `packages/updates-evidence/src/checkin-service.ts`: substantive-update and Thursday rules.
- `packages/updates-evidence/src/model.ts`: database, audit, AI Router, storage, and connector ports.

### Existing domain extensions

- `packages/projects/src/progress-contract-invariants.ts`: contract state, source, weights, effective-date, and rule validation.
- `packages/projects/src/progress-contract-service.ts`: proposal, approval, rejection, and prospective versioning.
- `packages/projects/src/progress-calculation-service.ts`: accepted calculation and append-only snapshots.
- `packages/projects/src/progress-query-service.ts`: active contract and historical snapshot reads.
- `packages/documents/src/progress-document-reader.ts`: exact ready document-version source for contract generation.
- `packages/criteria/src/criteria-at-time-reader.ts`: active-at-event criterion references where not already exposed.

### Application composition

- `apps/api/src/daily-work/daily-work-query.service.ts`: My Work and employee portfolio composition.
- `apps/api/src/daily-work/project-dashboard-query.service.ts`: Project/Workstream dashboard composition.
- `apps/api/src/daily-work/timeline-query.service.ts`: accepted source-event composition.
- `apps/api/src/daily-work/manager-operations-query.service.ts`: forbidden-field-safe manager projection.
- `apps/api/src/daily-work/evaluation-fact-view-query.service.ts`: Phase 2 preparation query.
- `apps/api/src/daily-work/*.controller.ts`: exact protected routes.
- `apps/web/src/app/[locale]/my-work/*`: production My Work.
- `apps/web/src/app/[locale]/projects/[projectId]/daily-work/*`: Project dashboard/work views.
- `apps/web/src/app/[locale]/evidence/*`: evidence workspace.
- `apps/web/src/app/[locale]/manager/operations/*`: manager queues.
- `apps/web/src/app/[locale]/evaluation-preparation/*`: Fact View preparation only.

---

### Task 1: My Work + Work Items + Progress Contract foundation

**Visible user outcome:** An employee opens Arabic My Work, sees Needs My Action, Today, and Overdue first, creates/transitions a Work Item, opens an addressable drawer, and reviews a Project dashboard backed by a human-approved Progress Contract.

**Files:**

- Create: `packages/contracts/src/work-items.ts`
- Create: `packages/contracts/src/progress-contracts.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/work-items/package.json`
- Create: `packages/work-items/tsconfig.json`
- Create: `packages/work-items/src/model.ts`
- Create: `packages/work-items/src/invariants.ts`
- Create: `packages/work-items/src/service.ts`
- Create: `packages/work-items/src/query-service.ts`
- Create: `packages/work-items/src/index.ts`
- Create: `packages/work-items/src/invariants.test.ts`
- Create: `packages/work-items/src/service.integration.test.ts`
- Create: `packages/projects/src/progress-contract-invariants.ts`
- Create: `packages/projects/src/progress-contract-service.ts`
- Create: `packages/projects/src/progress-calculation-service.ts`
- Create: `packages/projects/src/progress-query-service.ts`
- Modify: `packages/projects/src/index.ts`
- Create: `packages/projects/src/progress-contract-invariants.test.ts`
- Create: `packages/projects/src/progress-contract-service.integration.test.ts`
- Create: `packages/projects/src/progress-calculation-service.integration.test.ts`
- Create: `packages/documents/src/progress-document-reader.ts`
- Create: `packages/documents/src/progress-document-reader.integration.test.ts`
- Modify: `packages/documents/src/index.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0012_work_items_progress_contract/migration.sql`
- Create: `packages/database/src/work-items-progress-contract-schema.integration.test.ts`
- Create: `apps/api/src/work-items/work-items.module.ts`
- Create: `apps/api/src/work-items/work-items.controller.ts`
- Create: `apps/api/src/work-items/work-items-policy.guard.ts`
- Create: `apps/api/src/work-items/work-items.controller.test.ts`
- Create: `apps/api/src/daily-work/daily-work.module.ts`
- Create: `apps/api/src/daily-work/daily-work-query.service.ts`
- Create: `apps/api/src/daily-work/project-dashboard-query.service.ts`
- Create: `apps/api/src/daily-work/daily-work.controller.ts`
- Create: `apps/api/src/daily-work/daily-work.e2e.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/platform/daily-work-api.ts`
- Create: `apps/web/src/platform/daily-work-api.test.ts`
- Create: `apps/web/src/app/[locale]/my-work/page.tsx`
- Create: `apps/web/src/app/[locale]/my-work/my-work-client.tsx`
- Create: `apps/web/src/app/[locale]/my-work/work-item-drawer.tsx`
- Create: `apps/web/src/app/[locale]/my-work/my-work.test.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/page.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/project-progress-panel.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/project-progress-panel.test.tsx`
- Create: `scripts/seed-phase-2-demo.ts`
- Create: `tests/e2e/phase-2-slice-1.spec.ts`

**Interfaces:**

- Consumes: Phase 1 Project, Workstream, responsibility, document-version, permissions, audit, and same-origin gateway interfaces.
- Produces:

```ts
export type WorkItemStatus =
  "planned" | "ready" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";

export interface WorkItemScopeReader {
  getScope(input: {
    actorId: string;
    projectId: string;
    workstreamId: string | null;
    occurredAt: string;
  }): Promise<{ projectId: string; workstreamId: string | null; allowed: true }>;
}

export interface WorkItemReader {
  getAuthorizedWorkItem(input: { actorId: string; workItemId: string }): Promise<WorkItemDetail>;
}

export interface ProgressSourceReader {
  collectSources(input: {
    actorId: string;
    contractId: string;
    asOf: string;
  }): Promise<readonly ProgressSourceFact[]>;
}

export type OfficialProgressResult =
  | { state: "accepted"; snapshotId: string; previousPercent: number; percent: number }
  | { state: "awaiting_information"; previousPercent: number; missing: readonly string[] };
```

- [ ] **Step 1: Add failing Work Item and Progress Contract contract tests**

```ts
import { describe, expect, it } from "vitest";
import { CreateWorkItemInputSchema, ProgressContractDraftSchema } from "./index.js";

describe("Phase 2 slice 1 contracts", () => {
  it("requires a Project and rejects a mismatched Workstream at the domain gate", () => {
    expect(() =>
      CreateWorkItemInputSchema.parse({ title: "Review", projectId: "", workstreamId: null }),
    ).toThrow();
  });

  it("requires weighted rules to total exactly 100", () => {
    expect(() =>
      ProgressContractDraftSchema.parse({
        scopeKind: "project",
        projectId: "project-1",
        workstreamId: null,
        sourceDocumentId: "document-1",
        sourceDocumentVersion: 2,
        calculationKind: "weighted",
        components: [
          { id: "m1", weight: 60 },
          { id: "m2", weight: 30 },
        ],
      }),
    ).toThrow();
  });
});
```

Run: `pnpm vitest run --project unit packages/contracts/src/work-items.test.ts packages/contracts/src/progress-contracts.test.ts`
Expected: FAIL because the schemas do not exist.

- [ ] **Step 2: Implement the public Work Item and Progress Contract schemas**

Implement the exact statuses, contract states, source-document identity, KPI baseline/target/unit/direction, optional weights, calculation kind, and stable error codes. Export them from `packages/contracts/src/index.ts`.

Run: `pnpm vitest run --project unit packages/contracts/src/work-items.test.ts packages/contracts/src/progress-contracts.test.ts`
Expected: PASS.

- [ ] **Step 3: Add the failing migration verification**

The integration test must assert foreign keys to existing Project, Workstream, user, document, and audit identities; same-Project Workstream enforcement; optimistic version columns; append-only history; one active contract per scope/effective instant; immutable progress snapshots; and no `manual_percent` column.

Run: `pnpm db:generate && pnpm vitest run --project integration packages/database/src/work-items-progress-contract-schema.integration.test.ts`
Expected: FAIL because migration `0012_work_items_progress_contract` does not exist.

- [ ] **Step 4: Add migration 0012 and verify both migration paths**

Add tables for Work Items, participants, dependencies, status history, assignment history, Progress Contracts, contract components/KPIs/evidence requirements, approvals, human-confirmed contract conditions, and official progress snapshots/source links. Add constraints that prevent in-place mutation of history and snapshots.

Run:

```bash
pnpm db:verify
pnpm vitest run --project integration packages/database/src/work-items-progress-contract-schema.integration.test.ts
```

Expected: PASS from an empty database and the Phase 1 snapshot.

- [ ] **Step 5: Implement Work Item invariants and transactional commands with TDD**

Tests must cover Project required, same-Project Workstream, seven-state transition table, terminal-state behavior, assignment concurrency, historical responsibility, and the negative rule that `done` does not emit a progress percentage.

```ts
export class WorkItemService {
  create(input: CreateWorkItemCommand): Promise<WorkItemDetail>;
  transition(input: TransitionWorkItemCommand): Promise<WorkItemDetail>;
  assign(input: AssignWorkItemCommand): Promise<WorkItemDetail>;
}
```

Run: `pnpm vitest run --project unit packages/work-items/src/invariants.test.ts`
Expected: FAIL before implementation, then PASS.

Run: `pnpm vitest run --project integration packages/work-items/src/service.integration.test.ts`
Expected: PASS with append-only history and optimistic concurrency.

- [ ] **Step 6: Implement Progress Contract proposal, approval, and calculation with TDD**

Tests must cover exact document-version lineage, `draft → pending_approval → active`, rejection, prospective supersession, weights totaling 100, stage-gate rules, contract-defined human confirmation, no direct percentage override, insufficient coverage retaining the previous percentage, and a source-explained decrease.

```ts
export class ProgressContractService {
  propose(input: ProposeProgressContractCommand): Promise<ProgressContractDetail>;
  submitForApproval(input: SubmitProgressContractCommand): Promise<ProgressContractDetail>;
  approve(input: ApproveProgressContractCommand): Promise<ProgressContractDetail>;
  reject(input: RejectProgressContractCommand): Promise<ProgressContractDetail>;
}

export class ProgressCalculationService {
  calculate(input: CalculateProgressCommand): Promise<OfficialProgressResult>;
}
```

Run:

```bash
pnpm vitest run --project unit packages/projects/src/progress-contract-invariants.test.ts
pnpm vitest run --project integration packages/projects/src/progress-contract-service.integration.test.ts packages/projects/src/progress-calculation-service.integration.test.ts
```

Expected: PASS.

- [ ] **Step 7: Add protected API composition and negative contracts**

Implement exact routes:

- `GET /daily-work/my-work`
- `GET /daily-work/projects`
- `GET /daily-work/projects/:projectId`
- `GET /work-items/:workItemId`
- `POST /work-items`
- `POST /work-items/:workItemId/transitions`
- `POST /projects/:projectId/progress-contracts`
- `POST /projects/:projectId/progress-contracts/:contractId/submit`
- `POST /projects/:projectId/progress-contracts/:contractId/approve`
- `POST /projects/:projectId/progress-contracts/:contractId/reject`

API tests must reject actor IDs, cross-Project Workstreams, unauthorized Project access, unknown fields, `manualPercent`, rating/rank/productivity fields, and stale optimistic versions.

Run: `pnpm vitest run --project integration apps/api/src/daily-work/daily-work.e2e.integration.test.ts`
Expected: PASS.

- [ ] **Step 8: Implement the production My Work and Project dashboard**

Use compact rows, URL-addressable drawer state, server-provided allowed actions, and progressive disclosure. Display official progress only from `OfficialProgressResult`; display `awaiting_information` without a provisional percentage.

Run:

```bash
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web typecheck
pnpm vitest run --project unit apps/web/src/app/[locale]/my-work/my-work.test.tsx apps/web/src/app/[locale]/projects/[projectId]/daily-work/project-progress-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Run the local Slice 1 demo and capture screenshots**

Seed two Projects, five Workstreams, twenty Work Items, one pending contract, one active contract, one accepted progress snapshot, and one awaiting-information state through real APIs.

Run:

```bash
pnpm infra:up
pnpm db:deploy
pnpm tsx scripts/seed-phase-2-demo.ts --slice 1
pnpm test:e2e -- tests/e2e/phase-2-slice-1.spec.ts
```

Expected: PASS. Save Arabic/English desktop/mobile screenshots under `docs/product/screenshots/phase-2-production/slice-1/`.

- [ ] **Step 10: Verify, checkpoint, and stop**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
git diff --check
```

Expected: PASS. Commit `feat: add my work and progress contract foundation`, push, update `TASKS.md` and `project-state/PROJECT_STATE.md`, provide the local walkthrough, and stop at the Slice 1 product-owner gate.

---

### Task 2: Interactive Text Update + live AI + Timeline + manual evidence

**Visible user outcome:** An employee submits incomplete Arabic text, answers every required clarification one question at a time, attaches a screenshot or pasted CLI/code source, edits the AI-drafted claim, reviews comparison/progress impact, confirms, and sees the accepted event in Timeline.

**Files:**

- Create: `packages/contracts/src/updates-evidence.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/updates-evidence/package.json`
- Create: `packages/updates-evidence/tsconfig.json`
- Create: `packages/updates-evidence/src/model.ts`
- Create: `packages/updates-evidence/src/update-invariants.ts`
- Create: `packages/updates-evidence/src/update-service.ts`
- Create: `packages/updates-evidence/src/evidence-service.ts`
- Create: `packages/updates-evidence/src/activity-reader.ts`
- Create: `packages/updates-evidence/src/prompts.ts`
- Create: `packages/updates-evidence/src/index.ts`
- Create: `packages/updates-evidence/src/update-service.integration.test.ts`
- Create: `packages/updates-evidence/src/evidence-service.integration.test.ts`
- Create: `packages/updates-evidence/src/prompts.test.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0013_updates_evidence/migration.sql`
- Create: `packages/database/src/updates-evidence-schema.integration.test.ts`
- Create: `apps/api/src/updates-evidence/updates-evidence.module.ts`
- Create: `apps/api/src/updates-evidence/updates.controller.ts`
- Create: `apps/api/src/updates-evidence/evidence.controller.ts`
- Create: `apps/api/src/updates-evidence/updates-evidence-policy.guard.ts`
- Create: `apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts`
- Create: `apps/api/src/daily-work/timeline-query.service.ts`
- Create: `apps/worker/src/updates-evidence/update-structuring.processor.ts`
- Create: `apps/worker/src/updates-evidence/update-structuring.processor.integration.test.ts`
- Create: `apps/web/src/app/[locale]/my-work/update-composer.tsx`
- Create: `apps/web/src/app/[locale]/my-work/update-composer.test.tsx`
- Create: `apps/web/src/app/[locale]/evidence/page.tsx`
- Create: `apps/web/src/app/[locale]/evidence/evidence-review-sheet.tsx`
- Create: `apps/web/src/app/[locale]/evidence/evidence-review-sheet.test.tsx`
- Create: `apps/web/src/app/[locale]/timeline/timeline-list.tsx`
- Create: `tests/ai-evals/update-structure.test.ts`
- Create: `tests/ai-evals/fixtures/update-structure.json`
- Create: `tests/e2e/phase-2-slice-2.spec.ts`

**Interfaces:**

- Consumes: `WorkItemReader`, active Progress Contract and snapshot readers, documents private-upload interfaces, criteria-at-time reader, AI Router, worker, audit.
- Produces:

```ts
export interface AcceptedUpdateReader {
  getPreviousAcceptedState(input: {
    actorId: string;
    projectId: string;
    workstreamId: string | null;
    workItemId: string | null;
  }): Promise<AcceptedUpdateState | null>;
}

export interface ConfirmedProgressSourceReader {
  listConfirmedSources(input: {
    contractId: string;
    asOf: string;
  }): Promise<readonly ProgressSourceFact[]>;
}

export type ClarificationState =
  | { state: "question"; turnId: string; question: string; affects: readonly string[] }
  | { state: "ready_for_review"; draftRevisionId: string };
```

- [ ] **Step 1: Add failing update/evidence contract and prohibited-output tests**

Assert versioned clarification turns, source revisions, supported claim, Project required, conditional Work Item/KPI/criterion links, employee confirmation, execution mode, and schemas with no rating/rank/productivity/readiness score.

Run: `pnpm vitest run --project unit packages/contracts/src/updates-evidence.test.ts packages/updates-evidence/src/prompts.test.ts`
Expected: FAIL, then implement schemas/prompts and rerun to PASS.

- [ ] **Step 2: Add migration 0013 with immutable update/evidence lineage**

Create update source, clarification session/turn, structured-draft revision, update confirmation, evidence source/revision/link, attribution, verification, confirmation, and accepted-event tables. Add idempotency, source identity, optimistic revision, and append-only constraints.

Run:

```bash
pnpm db:verify
pnpm vitest run --project integration packages/database/src/updates-evidence-schema.integration.test.ts
```

Expected: PASS from empty and Phase 1 snapshot.

- [ ] **Step 3: Implement multi-turn text update with RED/GREEN cycles**

Tests must prove:

- all unresolved required fields are tracked;
- exactly one question is returned per turn;
- more questions follow when required;
- interrupted sessions resume;
- previous accepted state and active contract are included by source reference;
- the employee edits before confirmation;
- confirmation emits one accepted event and one progress-recalculation request;
- no accepted event exists before confirmation.

Run: `pnpm vitest run --project integration packages/updates-evidence/src/update-service.integration.test.ts`
Expected: PASS.

- [ ] **Step 4: Implement manual evidence and AI-drafted claim confirmation**

Support image/screenshot, file/document, pasted code/text/CLI, URL, and link sources through existing private upload and safe-source controls. Require Project and supported claim; require Work Item only when captured from a Work Item flow; allow KPI/criterion links only when applicable.

Run: `pnpm vitest run --project integration packages/updates-evidence/src/evidence-service.integration.test.ts`
Expected: PASS for source immutability, employee edit/confirmation, contribution context, execution mode, authorization, malware/type/size rejection, and no automatic progress.

- [ ] **Step 5: Route production structuring only through AI Router**

Use `Pick<AiRouter<DatabaseTransaction>, "run">`, route key `update.structure`, a versioned output schema, exact source references, whole-run timeout, and transactional persistence callback. Deterministic adapters are test/demo only.

Run:

```bash
pnpm vitest run --project integration apps/worker/src/updates-evidence/update-structuring.processor.integration.test.ts
pnpm test:ai -- tests/ai-evals/update-structure.test.ts
pnpm scan:secrets
```

Expected: PASS, including Arabic, mixed technical text, prompt injection, invalid schema, missing context, and prohibited concept fixtures.

- [ ] **Step 6: Add protected APIs and same-origin web gateway**

Implement exact routes for update draft/start, clarification answer, evidence source creation, draft review, employee confirmation, evidence confirmation/rejection, and Timeline pagination. Reject actor IDs, arbitrary source paths, provider/model overrides, raw object keys, rating fields, and unauthorized links.

Run: `pnpm vitest run --project integration apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts`
Expected: PASS.

- [ ] **Step 7: Implement the unified composer, evidence sheet, and Timeline**

The UI must preserve draft state, show active Project/Workstream context, display one question at a time, allow evidence inside the flow, show previous-versus-current comparison, display official progress only after confirmation/recalculation, and move mobile focus into a visible bottom sheet.

Run:

```bash
pnpm vitest run --project unit apps/web/src/app/[locale]/my-work/update-composer.test.tsx apps/web/src/app/[locale]/evidence/evidence-review-sheet.test.tsx
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web typecheck
```

Expected: PASS.

- [ ] **Step 8: Demo, screenshots, verification, and stop**

Run `pnpm tsx scripts/seed-phase-2-demo.ts --slice 2` and `pnpm test:e2e -- tests/e2e/phase-2-slice-2.spec.ts`. Capture Arabic/English desktop/mobile composer, multiple questions, evidence sheet, comparison, confirmation, and Timeline under `docs/product/screenshots/phase-2-production/slice-2/`.

Run focused package/API/worker/web tests, `pnpm test:ai`, `pnpm scan:secrets`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`. Commit `feat: add interactive updates and manual evidence`, push, update task/project state, and stop at the Slice 2 product-owner gate.

---

### Task 3: GitHub suggested evidence

**Visible user outcome:** A PR/check appears as a suggestion; the employee reviews it in a visible drawer, contextualizes and confirms one, and rejects another without automatic progress or performance effect.

**Files:**

- Create: `packages/contracts/src/github-evidence.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/updates-evidence/src/github-adapter.ts`
- Create: `packages/updates-evidence/src/github-adapter.integration.test.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0014_github_suggestions/migration.sql`
- Create: `packages/database/src/github-suggestions-schema.integration.test.ts`
- Create: `apps/api/src/github/github.module.ts`
- Create: `apps/api/src/github/github-installations.controller.ts`
- Create: `apps/api/src/github/github-webhooks.controller.ts`
- Create: `apps/api/src/github/github-suggestions.controller.ts`
- Create: `apps/api/src/github/github.e2e.integration.test.ts`
- Create: `apps/worker/src/github/github-webhook.processor.ts`
- Create: `apps/worker/src/github/github-reconciliation.processor.ts`
- Create: `apps/worker/src/github/github-processors.integration.test.ts`
- Create: `apps/web/src/app/[locale]/evidence/github-suggestion-list.tsx`
- Create: `apps/web/src/app/[locale]/evidence/github-suggestion-list.test.tsx`
- Create: `tests/e2e/phase-2-slice-3.spec.ts`

**Interfaces:**

```ts
export interface EvidenceSuggestionWriter {
  upsertSuggestion(input: GitHubSuggestionInput): Promise<{ suggestionId: string }>;
}

export interface GitHubInstallationTokenProvider {
  getInstallationToken(input: {
    installationId: string;
    repositoryId: string;
  }): Promise<{ token: string; expiresAt: string }>;
}
```

- [ ] **Step 1: Define and test GitHub contracts**

Cover installation/repository grants, delivery identity, original source ID/URL, PR/commit/check/test source kinds, suggestion state, merge/reassign/link, partial/team contribution, and confirmation/rejection/ignore. Exclude file/line/commit counts from every calculation schema.

Run: `pnpm vitest run --project unit packages/contracts/src/github-evidence.test.ts`
Expected: FAIL, then PASS after schema implementation.

- [ ] **Step 2: Add and verify migration 0014**

Add installation metadata without long-lived token storage, repository grants, webhook receipts, reconciliation cursors, suggestions, source links, and append-only disposition history.

Run: `pnpm db:verify && pnpm vitest run --project integration packages/database/src/github-suggestions-schema.integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Implement signature, idempotency, reconciliation, and dispositions**

Tests must cover valid/invalid signatures, duplicate delivery, replay, missed-event reconciliation, permission narrowing, uninstall, source preservation, merge/reassign history, and no confirmation before employee action.

Run:

```bash
pnpm vitest run --project integration packages/updates-evidence/src/github-adapter.integration.test.ts
pnpm vitest run --project integration apps/worker/src/github/github-processors.integration.test.ts
```

Expected: PASS.

- [ ] **Step 4: Add protected API and visible mobile review**

The employee suggestion API returns no installation token or private webhook body. The mobile UI opens the existing evidence review sheet immediately, moves focus, supports Escape/back dismissal, and returns focus to the selected item.

Run:

```bash
pnpm vitest run --project integration apps/api/src/github/github.e2e.integration.test.ts
pnpm vitest run --project unit apps/web/src/app/[locale]/evidence/github-suggestion-list.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Demo, screenshots, verification, and stop**

Ingest synthetic PR and check deliveries, confirm one, reject one, ignore one, and verify no progress change before confirmation. Capture Inbox/list/review drawer states under `docs/product/screenshots/phase-2-production/slice-3/`.

Run focused tests, `pnpm scan:secrets`, `pnpm lint`, `pnpm typecheck`, and `git diff --check`. Commit `feat: add github suggested evidence`, push, update task/project state, and stop at the Slice 3 product-owner gate.

---

### Task 4: Voice update

**Visible user outcome:** An employee records/uploads Arabic voice, corrects the transcript, answers remaining questions, attaches evidence, confirms the update, and sees it in Timeline.

**Files:**

- Modify: `packages/contracts/src/updates-evidence.ts`
- Create: `packages/updates-evidence/src/voice-service.ts`
- Create: `packages/updates-evidence/src/voice-service.integration.test.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0015_voice_updates/migration.sql`
- Create: `packages/database/src/voice-updates-schema.integration.test.ts`
- Create: `apps/api/src/updates-evidence/voice-updates.controller.ts`
- Create: `apps/api/src/updates-evidence/voice-updates.controller.test.ts`
- Create: `apps/worker/src/updates-evidence/transcription.processor.ts`
- Create: `apps/worker/src/updates-evidence/transcription.processor.integration.test.ts`
- Create: `apps/web/src/app/[locale]/my-work/voice-update-composer.tsx`
- Create: `apps/web/src/app/[locale]/my-work/voice-update-composer.test.tsx`
- Create: `tests/ai-evals/voice-update.test.ts`
- Create: `tests/ai-evals/fixtures/voice-update.json`
- Create: `tests/e2e/phase-2-slice-4.spec.ts`

**Interfaces:**

```ts
export interface SpeechTranscriber {
  transcribe(input: {
    audioSourceId: string;
    localeHint: "ar" | "en";
  }): Promise<{ rawTranscript: string; traceId: string }>;
}
```

- [ ] **Step 1: Add failing voice lifecycle and retention tests**

Cover private audio, media validation, raw transcript, employee-corrected transcript, transcript confirmation, structured update confirmation, retention/access policy, and route trace.

Run: `pnpm vitest run --project integration packages/updates-evidence/src/voice-service.integration.test.ts`
Expected: FAIL before migration/service.

- [ ] **Step 2: Add migration 0015 and implement the dual-gate lifecycle**

Reuse the existing private upload/scanner interfaces. Store audio source identity, raw transcript revision, edited transcript revision, confirmation, and STT trace separately. Do not store credentials or public object URLs.

Run:

```bash
pnpm db:verify
pnpm vitest run --project integration packages/database/src/voice-updates-schema.integration.test.ts packages/updates-evidence/src/voice-service.integration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Route STT through AI Router and run dialect evaluations**

Use route key `speech.transcribe`; deterministic fixtures cover Fusha, Gulf, Levantine, mixed Arabic/English, failure/retry, injection text, and invalid output. Production uses the configured runtime secret only through AI Router.

Run:

```bash
pnpm vitest run --project integration apps/worker/src/updates-evidence/transcription.processor.integration.test.ts
pnpm test:ai -- tests/ai-evals/voice-update.test.ts
pnpm scan:secrets
```

Expected: PASS.

- [ ] **Step 4: Implement accessible record/upload and transcript correction**

The UI must explain recording state, permission denial, upload failure, transcript source, edit/confirmation gates, and remaining clarification questions without claiming an unsupported recording is saved.

Run: `pnpm vitest run --project unit apps/web/src/app/[locale]/my-work/voice-update-composer.test.tsx`
Expected: PASS for keyboard, live status, error recovery, RTL, and 390px behavior.

- [ ] **Step 5: Demo, screenshots, verification, and stop**

Run the deterministic Gulf-Arabic demo through transcript correction, multiple clarification turns, evidence, and final Timeline confirmation. Save screenshots under `docs/product/screenshots/phase-2-production/slice-4/`.

Run focused tests, AI evaluations, lint, typecheck, secret scan, and `git diff --check`. Commit `feat: add governed voice updates`, push, update task/project state, and stop at the Slice 4 product-owner gate.

---

### Task 5: Check-ins and monthly readiness

**Visible user outcome:** The system asks for a Thursday check-in only when substantive accepted updates are absent and shows employees actionable monthly documentation gaps without quotas or penalties.

**Files:**

- Create: `packages/contracts/src/checkins-readiness.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/updates-evidence/src/checkin-service.ts`
- Create: `packages/updates-evidence/src/checkin-service.integration.test.ts`
- Create: `packages/documents/src/monthly-readiness-composer.ts`
- Create: `packages/documents/src/monthly-readiness-composer.integration.test.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0016_checkins_monthly_readiness/migration.sql`
- Create: `packages/database/src/checkins-monthly-readiness-schema.integration.test.ts`
- Create: `apps/api/src/daily-work/checkins.controller.ts`
- Create: `apps/api/src/daily-work/monthly-readiness.controller.ts`
- Create: `apps/api/src/daily-work/checkins-readiness.e2e.integration.test.ts`
- Create: `apps/worker/src/checkins/checkin-reminder.processor.ts`
- Create: `apps/worker/src/checkins/monthly-readiness.processor.ts`
- Create: `apps/worker/src/checkins/checkin-processors.integration.test.ts`
- Create: `apps/web/src/app/[locale]/checkins/page.tsx`
- Create: `apps/web/src/app/[locale]/readiness/page.tsx`
- Create: `apps/web/src/app/[locale]/readiness/readiness-detail.test.tsx`
- Create: `tests/e2e/phase-2-slice-5.spec.ts`

**Interfaces:**

```ts
export interface ApprovedLeaveExemptionReader {
  findApprovedLeave(input: {
    employeeId: string;
    startsAt: string;
    endsAt: string;
  }): Promise<{ leaveId: string } | null>;
}
```

- [ ] **Step 1: Define and test substantive-update/check-in/readiness contracts**

Assert Thursday/timezone boundaries, one reminder per scope/window, substantive substitution, approved-leave exclusion, Project aggregation, employee detail, manager-safe coarse projection, and schemas without percentage/rank/score/quota.

Run: `pnpm vitest run --project unit packages/contracts/src/checkins-readiness.test.ts`
Expected: FAIL, then PASS after schemas.

- [ ] **Step 2: Add migration 0016 and check-in transaction rules**

Persist reminder/obligation, check-in, aggregation source links, monthly snapshot, and source-version identity. Preserve append-only snapshots and idempotent scheduled work.

Run: `pnpm db:verify && pnpm vitest run --project integration packages/database/src/checkins-monthly-readiness-schema.integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Implement check-in and monthly readiness with false-positive tests**

Tests cover substantive updates, non-substantive notes, approved leave, no leave self-assertion, cross-Workstream Project summary, observation criteria, in-progress claims with next step, confirmed team evidence, reviewed/rejected GitHub suggestions, unresolved attribution, and no evidence quota.

Run:

```bash
pnpm vitest run --project integration packages/updates-evidence/src/checkin-service.integration.test.ts packages/documents/src/monthly-readiness-composer.integration.test.ts
pnpm vitest run --project integration apps/worker/src/checkins/checkin-processors.integration.test.ts
```

Expected: PASS.

- [ ] **Step 4: Add protected employee and manager projections**

Manager responses must structurally omit individual percentage/value/rank and correction detail. Employee responses include source-linked corrective actions.

Run: `pnpm vitest run --project integration apps/api/src/daily-work/checkins-readiness.e2e.integration.test.ts`
Expected: PASS for positive and negative privacy cases.

- [ ] **Step 5: Demo, screenshots, verification, and stop**

Show reminder generated, reminder suppressed by update, approved-leave adapter exclusion, employee monthly detail, and manager coarse state. Capture under `docs/product/screenshots/phase-2-production/slice-5/`.

Run focused tests, related integration, lint, typecheck, and `git diff --check`. Commit `feat: add check-ins and monthly readiness`, push, update task/project state, and stop at the Slice 5 product-owner gate.

---

### Task 6: Manager operational view

**Visible user outcome:** A manager works from compact queues for blockers, missing operational updates, criteria objections, attribution questions, reassignment, Project health, and coarse documentation gaps.

**Files:**

- Create: `packages/contracts/src/manager-operations.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/daily-work/manager-operations-query.service.ts`
- Create: `apps/api/src/daily-work/manager-operations.controller.ts`
- Create: `apps/api/src/daily-work/manager-operations.e2e.integration.test.ts`
- Create: `apps/web/src/app/[locale]/manager/operations/page.tsx`
- Create: `apps/web/src/app/[locale]/manager/operations/operations-queue.tsx`
- Create: `apps/web/src/app/[locale]/manager/operations/operations-queue.test.tsx`
- Modify: `apps/web/src/app/[locale]/workspace-shell.tsx`
- Create: `tests/e2e/phase-2-slice-6.spec.ts`

**Interfaces:**

```ts
export type ManagerOperation =
  | { kind: "blocker"; projectId: string; workItemId: string; nextAction: string }
  | { kind: "missing_update"; projectId: string; workstreamId: string }
  | { kind: "criteria_objection"; projectId: string; proposalId: string }
  | { kind: "attribution_question"; projectId: string; evidenceId: string }
  | { kind: "reassignment"; projectId: string; resourceId: string };
```

- [ ] **Step 1: Add forbidden-field and scope tests**

The contract test must reject `employeeRank`, `readinessPercent`, `readinessValue`, `productivityScore`, `completionLeaderboard`, `githubLeaderboard`, `predictedRating`, and `suggestedRating`.

Run: `pnpm vitest run --project unit packages/contracts/src/manager-operations.test.ts`
Expected: FAIL, then PASS after schema implementation.

- [ ] **Step 2: Implement composed manager queues through public interfaces**

Do not query another module's tables directly. Compose authorized Project/Workstream health, blockers, check-ins, criteria objections, attribution questions, reassignment, and coarse readiness. Resolution commands remain in their owning modules.

Run: `pnpm vitest run --project integration apps/api/src/daily-work/manager-operations.e2e.integration.test.ts`
Expected: PASS for department scope, unauthorized negatives, and forbidden-field absence.

- [ ] **Step 3: Implement compact manager navigation and queues**

Hide employee Quick Add/Update unless the response explicitly grants contributor/owner actions. Keep `/manager/readiness` and `/manager/evaluations` distinct. Use rows/action lists before count cards.

Run: `pnpm vitest run --project unit apps/web/src/app/[locale]/manager/operations/operations-queue.test.tsx`
Expected: PASS for action order, hidden controls, distinct routes, keyboard, RTL, and mobile reflow.

- [ ] **Step 4: Demo, screenshots, verification, and stop**

Resolve a blocker through the owning command, inspect Project health and coarse readiness, and verify forbidden fields in the network contract. Capture under `docs/product/screenshots/phase-2-production/slice-6/`.

Run focused API/web/E2E tests, lint, typecheck, and `git diff --check`. Commit `feat: add manager operational queues`, push, update task/project state, and stop at the Slice 6 product-owner gate.

---

### Task 7: Evaluation Fact View preparation

**Visible user outcome:** An authorized employee or manager reviews a period preparation view that separates source-supported facts, unclear parts, employee interpretation, results, evidence, responsibility, criteria, and Project progress history without a rating recommendation.

**Files:**

- Create: `packages/contracts/src/evaluation-fact-view.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/criteria/src/criteria-at-time-reader.ts`
- Create: `packages/criteria/src/criteria-at-time-reader.integration.test.ts`
- Modify: `packages/criteria/src/index.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0017_evaluation_fact_view_preparation/migration.sql`
- Create: `packages/database/src/evaluation-fact-view-schema.integration.test.ts`
- Create: `apps/api/src/daily-work/evaluation-fact-view-query.service.ts`
- Create: `apps/api/src/daily-work/evaluation-fact-view.controller.ts`
- Create: `apps/api/src/daily-work/evaluation-fact-view.e2e.integration.test.ts`
- Create: `apps/web/src/app/[locale]/evaluation-preparation/page.tsx`
- Create: `apps/web/src/app/[locale]/evaluation-preparation/fact-view.tsx`
- Create: `apps/web/src/app/[locale]/evaluation-preparation/fact-view.test.tsx`
- Create: `tests/ai-evals/evaluation-fact-view.test.ts`
- Create: `tests/e2e/phase-2-slice-7.spec.ts`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html`

**Interfaces:**

```ts
export type EvaluationFactViewPreparation = Readonly<{
  period: { startsAt: string; endsAt: string };
  responsibilityWindows: readonly ResponsibilityFact[];
  sourceSupportedFacts: readonly SourceSupportedFact[];
  unclearParts: readonly UnclearFact[];
  employeeInterpretation: readonly EmployeeInterpretation[];
  recordedResults: readonly RecordedResult[];
  evidence: readonly EvidenceReference[];
  criteriaAtTime: readonly CriterionReference[];
  projectProgressSnapshots: readonly ProgressSnapshotReference[];
}>;
```

- [ ] **Step 1: Add no-rating and fact/interpretation separation tests**

Assert separate fields and source references, active-at-time criteria, responsibility windows, progress snapshot references, immutable period identity, and structural absence of suggested/predicted/preselected rating and automatic averages.

Run:

```bash
pnpm vitest run --project unit packages/contracts/src/evaluation-fact-view.test.ts
pnpm test:ai -- tests/ai-evals/evaluation-fact-view.test.ts
```

Expected: FAIL, then PASS after contracts/fixtures.

- [ ] **Step 2: Add migration 0017 and immutable preparation snapshot**

Persist period snapshot identity, source references, fact/interpretation classification, unclear state, responsibility, criteria version, evidence, and progress snapshot links. Add no update/delete protection after final preparation capture.

Run: `pnpm db:verify && pnpm vitest run --project integration packages/database/src/evaluation-fact-view-schema.integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Implement the authorized preparation query**

Compose only public interfaces. Do not add self-assessment, manager rating, discussion, finalization, acknowledgment, reservation, or closure commands.

Run:

```bash
pnpm vitest run --project integration packages/criteria/src/criteria-at-time-reader.integration.test.ts
pnpm vitest run --project integration apps/api/src/daily-work/evaluation-fact-view.e2e.integration.test.ts
```

Expected: PASS for employee/manager scope, historical responsibility, criteria version, source trace, and privacy negatives.

- [ ] **Step 4: Implement the neutral Arabic-first preparation view**

Show source-supported facts first, then unclear parts, interpretation, result, evidence, responsibility, criteria, and Project progress history. Do not render a rating control or readiness percentage.

Run: `pnpm vitest run --project unit apps/web/src/app/[locale]/evaluation-preparation/fact-view.test.tsx`
Expected: PASS for neutrality, section order, forbidden copy, RTL/LTR, keyboard, and mobile reflow.

- [ ] **Step 5: Run the final Phase 2 preparation demo and screenshots**

Trace one source from update/evidence through responsibility, criterion-at-time, progress snapshot, and Fact View preparation. Capture Arabic/English desktop/mobile under `docs/product/screenshots/phase-2-production/slice-7/`.

Run: `pnpm test:e2e -- tests/e2e/phase-2-slice-7.spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the major integration checkpoint**

Run:

```bash
pnpm validate:task-graph
pnpm scan:secrets
pnpm scan:performance-inputs
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:integration
pnpm test:ai
pnpm build
pnpm test:e2e
git diff --check
```

Expected: all commands PASS. If the known repository boundary-test timeout reproduces only on hosted coverage, apply solely the separately approved bounded timeout fix and rerun the failed check; do not weaken the 17 rejection cases.

- [ ] **Step 7: Update durable project records, commit, push, and stop**

Update the implementation plan, tasks, project state, and system map with actual completed results and remaining Phase 3 scope. Commit `feat: prepare evaluation fact view sources`, push, update the Phase 2 Pull Request, provide the final local walkthrough and screenshots, and stop at the Slice 7 product-owner gate.

---

## Plan self-review checklist

- Every approved design section maps to one or more tasks above.
- Work Item completion/count is never a progress calculation input.
- Direct overall percentage override is absent.
- Contract-defined human confirmation is explicit and auditable.
- Missing source coverage preserves the previous official percentage.
- Progress decreases are source-explained and append-only.
- Manual evidence is included in the text-update slice.
- GitHub and voice reuse the same Updates & Evidence lifecycle.
- Manager readiness and evaluation remain separate.
- Full employee/manager evaluation is excluded.
- Every slice has focused tests, runnable local demo, screenshots, commit/push, and product-owner stop gate.
- No placeholder, generic activity platform, second store, second authentication system, microservice, or package-per-feature architecture is introduced.

## Planning stop

This plan does not authorize production implementation. After this document and its approved specification/feature map are committed and pushed, stop for product-owner review.
