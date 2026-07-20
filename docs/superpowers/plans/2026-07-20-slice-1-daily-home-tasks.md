# Slice 1 — Daily Home and Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every behavior change and `superpowers:verification-before-completion` before the checkpoint. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an employee a calm Today home and a familiar Task workspace, with private quick capture and human-confirmed promotion into Project-linked official Tasks.

**Architecture:** Extend the existing Work Items package instead of creating a second task engine. Add private Inbox persistence owned by Work Items, expose it through protected APIs, and compose Today through the existing Daily Work application query. Replace the current update-form-first My Work screen with compact daily actions and focused drawers/sheets.

**Tech Stack:** Prisma/PostgreSQL, Zod, NestJS, Next.js/React, Vitest, Playwright.

## Global Constraints

- Official Tasks require `projectId`.
- Private Inbox items belong only to their employee and may be unlinked.
- Drafting or promoting a Task never changes Project progress.
- Manager UI must not expose another employee's private Inbox.
- Existing Work Item history, authorization, participants, and Project/Workstream rules remain authoritative.
- Keep Arabic/English routing, RTL/LTR, keyboard focus, and reduced motion.

---

### Task 1: Persist private Inbox capture

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0017_task_workspace/migration.sql`
- Modify: `packages/database/src/work-items-progress-contract-schema.integration.test.ts`
- Modify: `packages/contracts/src/work-items.ts`
- Modify: `packages/contracts/src/work-items.test.ts`

**Interfaces:**

Produces:

```ts
export const PrivateInboxItemSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  text: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().nullable(),
  status: z.enum(["OPEN", "PROMOTED", "DISMISSED"]),
  createdAt: z.iso.datetime(),
  promotedWorkItemId: z.string().uuid().nullable(),
});
```

- [x] Write schema tests proving an Inbox item may be unlinked, is employee-owned, and can reference at most one promoted Work Item.
- [x] Run `pnpm vitest run --project integration packages/database/src/work-items-progress-contract-schema.integration.test.ts`; verify failure.
- [x] Add `PrivateInboxItem`, `WorkItemChecklistItem`, and forward-only constraints/indexes. Do not make `WorkItem.projectId` optional.
- [x] Add Zod create/list/dismiss/promote contracts and contract tests.
- [x] Run `pnpm vitest run --project unit packages/contracts/src/work-items.test.ts`.
- [x] Run `pnpm db:verify`.
- [x] Commit as `feat(work-items): add private inbox persistence`.

### Task 2: Add Inbox and editable Task domain services

**Files:**

- Create: `packages/work-items/src/inbox-service.ts`
- Create: `packages/work-items/src/inbox-query-service.ts`
- Create: `packages/work-items/src/inbox-service.integration.test.ts`
- Create: `packages/work-items/src/inbox-query-service.integration.test.ts`
- Modify: `packages/work-items/src/service.ts`
- Modify: `packages/work-items/src/service.integration.test.ts`
- Modify: `packages/work-items/src/index.ts`

**Interfaces:**

Consumes the Task 1 contracts. Produces:

```ts
export interface PrivateInboxService {
  capture(input: CapturePrivateInboxInput): Promise<PrivateInboxItem>;
  dismiss(input: DismissPrivateInboxInput): Promise<PrivateInboxItem>;
  promote(input: PromotePrivateInboxInput): Promise<WorkItem>;
}

export interface WorkItemService {
  update(input: AuthorizedUpdateWorkItemInput): Promise<WorkItem>;
}
```

- [x] Write a failing test proving employee A cannot read, edit, dismiss, or promote employee B's Inbox item.
- [x] Write a failing transaction test proving promotion creates one Project-linked Work Item and marks the Inbox item `PROMOTED` atomically.
- [x] Write failing Work Item update tests for title, description, due date, priority, checklist, assignee, collaborators, Project/Workstream validity, optimistic version, and append-only history.
- [x] Implement only the minimum repositories and transaction behavior required by those tests.
- [x] Run `pnpm --filter @evaluation/work-items test`.
- [x] Run `pnpm --filter @evaluation/work-items typecheck`.
- [x] Commit as `feat(work-items): support private capture and task editing`.

### Task 3: Expose protected Task workspace APIs

**Files:**

- Modify: `apps/api/src/work-items/work-items.controller.ts`
- Modify: `apps/api/src/work-items/work-items.controller.test.ts`
- Modify: `apps/api/src/work-items/work-items.module.ts`
- Modify: `apps/api/src/work-items/work-items-policy.guard.ts`
- Create: `apps/api/src/work-items/private-inbox.controller.ts`
- Create: `apps/api/src/work-items/private-inbox.controller.test.ts`

**Endpoints:**

```text
GET    /api/v1/work-items?view=my|team&layout=list|board|calendar
PATCH  /api/v1/work-items/:workItemId
POST   /api/v1/private-inbox
GET    /api/v1/private-inbox
POST   /api/v1/private-inbox/:id/promote
POST   /api/v1/private-inbox/:id/dismiss
```

- [x] Write controller tests for validated inputs, inactive principals, owner-only Inbox access, Project permission, and manager Team Tasks scope.
- [x] Add `UpdateWorkItemInputSchema` to the Work Items controller.
- [x] Add Inbox controller and guard rules; UI hiding must not be the authorization control.
- [x] Return stable error codes for stale version, invalid Project/Workstream, forbidden Inbox access, and already-promoted capture.
- [x] Run `pnpm vitest run --project unit apps/api/src/work-items`.
- [x] Run `pnpm --filter @evaluation/api typecheck`.
- [x] Commit as `feat(api): expose protected task workspace endpoints`.

### Task 4: Compose the Today brief

**Files:**

- Modify: `apps/api/src/daily-work/daily-work-query.service.ts`
- Modify: `apps/api/src/daily-work/daily-work.controller.ts`
- Modify: `apps/api/src/daily-work/daily-work.e2e.integration.test.ts`
- Modify: `apps/web/src/platform/daily-work-api.ts`
- Modify: `apps/web/src/platform/daily-work-api.test.ts`

**Response:**

```ts
type DailyWorkspaceSnapshot = {
  needsMyAction: DailyAction[];
  today: DailyAction[];
  overdue: DailyAction[];
  reviewQueue: ReviewQueueItem[];
  inbox: PrivateInboxItem[];
  projectPulse: ProjectPulseItem[];
  upcoming: UpcomingCommitment[];
};
```

- [x] Add failing integration tests for employee-only private data, deterministic ordering, timezone-aware Today/Overdue grouping, and manager role boundaries.
- [x] Compose public readers from Work Items and Projects; do not access their Prisma tables from Daily Work.
- [x] Make `Needs My Action`, `Today`, and `Overdue` the first groups; collapse lower-priority groups in the client.
- [x] Preserve the approved Project progress semantics and source labels.
- [x] Run `pnpm vitest run --project integration apps/api/src/daily-work/daily-work.e2e.integration.test.ts`.
- [x] Run `pnpm vitest run --project unit apps/web/src/platform/daily-work-api.test.ts`.
- [x] Commit as `feat(daily-work): compose employee today brief`.

### Task 5: Build the normal Task workspace

**Files:**

- Modify: `apps/web/src/app/[locale]/my-work/page.tsx`
- Replace: `apps/web/src/app/[locale]/my-work/my-work-client.tsx`
- Create: `apps/web/src/app/[locale]/my-work/daily-brief.tsx`
- Create: `apps/web/src/app/[locale]/my-work/private-inbox.tsx`
- Create: `apps/web/src/app/[locale]/my-work/review-queue.tsx`
- Create: `apps/web/src/app/[locale]/my-work/project-pulse.tsx`
- Create: `apps/web/src/app/[locale]/tasks/page.tsx`
- Create: `apps/web/src/app/[locale]/tasks/tasks-client.tsx`
- Create: `apps/web/src/app/[locale]/tasks/task-list.tsx`
- Create: `apps/web/src/app/[locale]/tasks/task-board.tsx`
- Create: `apps/web/src/app/[locale]/tasks/task-calendar.tsx`
- Create: `apps/web/src/app/[locale]/tasks/task-detail-panel.tsx`
- Create: `apps/web/src/app/[locale]/tasks/task-workspace.test.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalog.test.ts`

- [x] Write component tests for List/Board/Calendar switching without changing stored task meaning.
- [x] Write tests proving quick capture needs only text, official creation requires Project, and promotion always shows a reviewable Task draft first.
- [x] Build compact rows, a side drawer on desktop, and bottom sheet on mobile.
- [x] Keep the current List/Board/Calendar position and keyboard focus when Task detail closes.
- [x] Remove the long clarification form from the default Today path; keep universal update capture for Slice 4.
- [x] Hide persona switching from production navigation; render by authorized role.
- [x] Verify mixed Arabic/English technical text and complete English catalog coverage.
- [x] Run `pnpm vitest run --project unit apps/web/src/app/[locale]/tasks packages/localization/src`.
- [x] Run `pnpm --filter @evaluation/web typecheck`.
- [x] Commit as `feat(web): replace my work with today and tasks`.

### Task 6: Seed and acceptance journey

**Files:**

- Modify: `scripts/seed-codex-dogfood.ts`
- Create: `tests/e2e/ai-first-daily-workspace.spec.ts`
- Create: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_1.md`
- Create screenshots under: `docs/product/screenshots/ai-first-daily-workspace/slice-1/`

- [x] Extend the real Codex employee fixture with realistic private captures, Today items, overdue items, Project-linked Tasks, and upcoming commitments; seed no employee scores.
- [x] Add Playwright journeys for Arabic RTL and English LTR at desktop and 390px.
- [x] Demonstrate: open Today, quick capture, review draft, choose Project, create Task, edit in side panel, switch List/Board/Calendar.
- [x] Interrupt authentication during an unsaved Task draft, sign in again, and verify the same draft and source context are restored.
- [x] Verify another employee and a manager cannot access Codex's private Inbox.
- [x] Run focused unit/integration tests from Tasks 1–5.
- [x] Run `pnpm playwright test tests/e2e/ai-first-daily-workspace.spec.ts`.
- [x] Run the three protected scans and affected lint/typechecks.
- [ ] Commit as `test: add daily workspace slice 1 acceptance`.
- [ ] Push, update Pull Request #5, publish exact local URLs and screenshots, then stop.

## Product Owner Stop Gate

The Product Owner reviews:

- Whether Today is immediately understandable without training.
- Whether quick capture is faster than a normal task application.
- Whether official Task creation clearly requires a Project but does not feel bureaucratic.
- Whether List, Board, Calendar, and the focused panel match daily-use expectations.
- Whether the employee sees operational progress without any employee evaluation implication.

Do not begin Slice 2 until this visible journey is approved.
