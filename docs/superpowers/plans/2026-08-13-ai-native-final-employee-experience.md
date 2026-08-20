# AI-Native Final Employee Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Home → Project → Work → Universal Capture → Clarification → Review & Confirmation journey on top of the existing engine without recreating domain authority in the browser.

**Architecture:** Keep the modular monolith and add only two bounded composition seams: an employee Home/Project read composition that consumes existing public readers, and a non-command Capture understanding service above the existing AI Router. The Next.js application owns responsive presentation, local drafts, URL state, drawers, focus, and recovery; Projects, Work Items, Updates/Evidence, Documents, Context Intelligence, and Evaluation keep their existing commands, persistence, authorization, and history.

**Tech Stack:** TypeScript, React 19, Next.js App Router, NestJS, Zod contracts, existing `@evaluation/ui` primitives, CSS Modules, Vitest, Storybook browser tests, Playwright E2E, PostgreSQL through existing modules, and the existing AI Router only.

## Global Constraints

- The five approved visual sources in `docs/product/screenshots/ai-native-final-design/` are the visual targets.
- Project/Workstream progress comes only from the active approved Progress Contract or an authorized human confirmation; Task, update, GitHub, commit, file, and line volume never calculate it.
- Project progress is never employee performance, and no screen may expose rating recommendations, productivity scores, rankings, or manager-facing individual readiness values.
- GitHub, Google, manual files, links, and captures remain private or suggested until the required employee confirmation.
- All AI calls use the existing AI Router. No feature module imports a provider SDK or reads an API key.
- The browser consumes public readers or protected same-origin APIs only; it never reads domain persistence or implements a domain transition rule.
- Official Update, Evidence, contribution, and progress actions stay separate commands with separate results. The UI must report partial success truthfully instead of pretending cross-domain atomicity.
- English is the pilot language. Existing Arabic/RTL foundations remain functional; Arabic evaluation content stays behind T016.
- Retained My Work, Tasks List/Board/Calendar, Projects, Update, Evidence, and source-review routes remain available behind rollback flags until T101 acceptance.
- Use focused tests after each task, related integration tests at bundle completion, and the affected full web/E2E suite only at T101.
- Low-risk visual work receives self-review. The Capture/Review protected boundary receives one bounded specification and security/code-quality review at T100/T101 only.

## File and Responsibility Map

| Area                                                                     | Responsibility                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `packages/contracts/src/employee-experience.ts`                          | Closed, versioned presentation contracts for Home, Project, Capture understanding, and final review consequences.  |
| `apps/api/src/daily-work/employee-home-query.service.ts`                 | Read-only composition of Daily Work, Project progress, and authorized change receipts; no commands or table reads. |
| `apps/api/src/daily-work/project-experience-query.service.ts`            | Read-only Project composition over existing Project, Progress, and Timeline readers.                               |
| `apps/api/src/experience-orchestration/capture-understanding.service.ts` | AI-Router-only, non-command interpretation of a private capture with deterministic fallback.                       |
| `apps/web/src/features/home-overview/**`                                 | Pure Home view-model composition and source/progress labelling.                                                    |
| `apps/web/src/features/project-experience/**`                            | Pure Project view model for progress, milestone, KPI, attention, tabs, and timeline.                               |
| `apps/web/src/features/universal-capture/**`                             | Local capture session state machine: capture → clarify → review, preserving draft and recovery.                    |
| `apps/web/src/features/review-confirmation/**`                           | Selection and consequence model; never owns business transitions.                                                  |
| `apps/web/src/product-ui/home/**`                                        | Approved Home Overview rendering.                                                                                  |
| `apps/web/src/product-ui/project/**`                                     | Approved Project Workspace rendering.                                                                              |
| `apps/web/src/product-ui/work/**`                                        | Approved action-first Work rendering while retaining the authoritative Task drawer.                                |
| `apps/web/src/product-ui/capture/**`                                     | Approved universal composer, clarification, and private-save flow.                                                 |
| `apps/web/src/product-ui/review/**`                                      | Approved Review & Confirmation drawer/bottom sheet and outcome receipt.                                            |
| `apps/web/src/platform/employee-experience-*.ts`                         | Same-origin clients and strict browser-local validation only.                                                      |
| `apps/web/src/server/final-experience/**`                                | Server feature flags and protected server composition adapters.                                                    |
| `tests/e2e/ai-native-final-experience/**`                                | One realistic employee customer journey plus rollback/recovery coverage.                                           |

---

### Task 1: T095 — Freeze Final Experience Contracts and Rollback

**Files:**

- Create: `packages/contracts/src/employee-experience.ts`
- Create: `packages/contracts/src/employee-experience.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/web/src/server/final-experience/final-experience-flags.ts`
- Create: `apps/web/src/server/final-experience/final-experience-flags.test.ts`
- Modify: `scripts/validate-frontend-import-boundaries.mjs`
- Modify: `docs/product/ai-native-phase-1-2-handoffs.json`
- Modify: `TASKS.md`

**Interfaces:**

- Produces: `EmployeeHomeV1`, `EmployeeProjectExperienceV1`, `CaptureUnderstandingV1`, `ReviewConfirmationDraftV1`, and `ReviewConfirmationResultV1`.
- Produces: `finalHomeEnabled()`, `finalProjectEnabled()`, `finalWorkEnabled()`, `finalCaptureEnabled()`, and `finalReviewEnabled()`; every flag defaults on and accepts an explicit `false` rollback value.
- Consumes: existing Work Item, progress, source, Update/Evidence, and Timeline public contract shapes by reference; it does not redefine their state machines.

- [ ] **Step 1: Write the closed-schema RED tests**

```ts
it("keeps operational progress separate from employee performance", () => {
  expect(EmployeeHomeV1Schema.parse(homeFixture)).toEqual(homeFixture);
  expect(() => EmployeeHomeV1Schema.parse({ ...homeFixture, employeeScore: 91 })).toThrow();
});

it("requires source, freshness, consequence, and confirmation ownership", () => {
  expect(ReviewConfirmationDraftV1Schema.parse(reviewFixture)).toMatchObject({
    update: { editable: true },
    progressProposal: { mutatesOfficialProgress: false },
  });
});
```

- [ ] **Step 2: Run the contract tests and observe missing schemas**

Run: `pnpm --filter @evaluation/contracts test -- employee-experience.test.ts`

Expected: FAIL because the final employee-experience schemas are absent.

- [ ] **Step 3: Implement the minimum closed contracts**

Define discriminated states rather than nullable guesswork:

```ts
export const OperationalProgressSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("accepted"),
      percent: z.number().min(0).max(100),
      source: SourceRefSchema,
    })
    .strict(),
  z.object({ state: z.literal("awaiting_contract") }).strict(),
  z
    .object({ state: z.literal("awaiting_information"), missing: z.array(z.string().min(1)) })
    .strict(),
]);

export const CaptureUnderstandingV1Schema = z
  .object({
    schemaVersion: z.literal("capture-understanding.v1"),
    likelyProject: ProjectSuggestionSchema.nullable(),
    likelyMeaning: z.enum(["private_note", "task", "project_update", "suggested_evidence"]),
    relatedWorkItemId: UuidSchema.nullable(),
    relatedComponentId: UuidSchema.nullable(),
    sourceRefs: z.array(SourceRefSchema),
    clarification: z
      .object({ question: z.string().min(1), missingField: z.string().min(1) })
      .strict()
      .nullable(),
    confidence: z.enum(["high", "uncertain"]),
    createsOfficialRecord: z.literal(false),
  })
  .strict();
```

Add a semantic refinement rejecting top-level and nested rating, ranking, productivity-score, readiness-percentage, and activity-volume-as-progress meanings.

- [ ] **Step 4: Add fail-safe rollback flags and tests**

Each flag returns `false` only for the exact environment value `false`; malformed values use the existing stable route and emit no client-visible technical detail.

- [ ] **Step 5: Extend the frontend boundary validator**

Reject imports from Prisma/database, provider SDKs, manager/evaluation internals, or server-only modules inside the five new product UI folders.

- [ ] **Step 6: Run focused verification**

Run:

```bash
pnpm --filter @evaluation/contracts test -- employee-experience.test.ts
pnpm --filter @evaluation/contracts typecheck
pnpm --filter @evaluation/web test -- final-experience-flags.test.ts
pnpm validate:frontend-boundaries
```

Expected: all pass.

- [ ] **Step 7: Commit the foundation**

```bash
git add packages/contracts apps/web/src/server/final-experience scripts/validate-frontend-import-boundaries.mjs docs/product/ai-native-phase-1-2-handoffs.json TASKS.md
git commit -m "feat(experience): define final employee screen contracts"
```

---

### Task 2: T096 — Build the Final Home Overview

**Files:**

- Create: `apps/api/src/daily-work/employee-home-query.service.ts`
- Create: `apps/api/src/daily-work/employee-home-query.service.test.ts`
- Modify: `apps/api/src/daily-work/daily-work.controller.ts`
- Modify: `apps/api/src/daily-work/daily-work.module.ts`
- Modify: `apps/api/src/daily-work/daily-work.e2e.integration.test.ts`
- Modify: `apps/web/src/platform/daily-work-api.ts`
- Create: `apps/web/src/features/home-overview/home-overview-model.ts`
- Create: `apps/web/src/features/home-overview/home-overview-model.test.ts`
- Create: `apps/web/src/product-ui/home/home-overview.tsx`
- Create: `apps/web/src/product-ui/home/home-overview.module.css`
- Create: `apps/web/src/product-ui/home/home-overview.test.tsx`
- Create: `apps/web/src/product-ui/home/home-overview.stories.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/page.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`

**Interfaces:**

- Consumes: `DailyWorkQueryService.dailyWorkspace`, `ProgressQueryService.getProjectProgress`, and owner-filtered `ExperienceEventRuntime.listWhatChanged` through injected public interfaces.
- Produces: `EmployeeHomeQueryService.load(actor)` returning `EmployeeHomeV1` with at most three active Project rows, one next action, one meaningful KPI per Project, and a bounded `Now` timeline.
- Produces: `buildHomeOverviewModel(home, catalog)` with presentation labels only; it never calculates progress.

- [ ] **Step 1: Write RED composition tests**

Prove that accepted progress is copied from the authoritative snapshot, missing progress remains missing, a KPI without baseline/target is not shown as a measured KPI, and What Changed is recipient-filtered.

- [ ] **Step 2: Run the focused API tests**

Run: `pnpm --filter @evaluation/api test -- employee-home-query.service.test.ts`

Expected: FAIL because `EmployeeHomeQueryService` does not exist.

- [ ] **Step 3: Implement the read-only Home composition**

The service may sort and limit already-authorized results, but must not calculate domain values. Select the displayed KPI from an existing contract component with complete baseline, current, target, unit, direction, and source freshness. When unavailable, return `kpi: null` and an honest reason.

- [ ] **Step 4: Expose `GET /api/v1/daily-work/home`**

Use the existing Work Items policy guard. Add positive employee and negative inactive/unrelated tests. Do not add a new permission model.

- [ ] **Step 5: Write the Home UI RED tests**

Test circular accepted progress, completed/current/next milestone path, source label, `How calculated`, one Smart Brief action, empty/missing states, mobile stacking, and absence of performance-score/ranking copy.

- [ ] **Step 6: Implement the approved Home visual**

Match `home-overview-approved.png`: persistent shell, concise greeting/signals, compact Project rows, circular progress, milestone journey, one KPI, next action, `Now` timeline, and assistant rail/drawer. Use `ProductIcon`; do not draw custom SVG/CSS icons.

- [ ] **Step 7: Wire Home behind rollback**

When `AI_NATIVE_FINAL_HOME_ENABLED=false`, render the existing `IntelligentToday`. Otherwise render `HomeOverview`; do not delete the old surface.

- [ ] **Step 8: Run focused verification**

Run:

```bash
pnpm --filter @evaluation/api test -- employee-home-query.service.test.ts daily-work.e2e.integration.test.ts
pnpm --filter @evaluation/web test -- home-overview-model.test.ts home-overview.test.tsx
pnpm --filter @evaluation/web typecheck
pnpm --filter @evaluation/web lint
```

- [ ] **Step 9: Start the local product and capture the Home checkpoint**

Capture desktop and 390px views into `docs/product/screenshots/ai-native-final-implementation/t096-home-desktop.png` and `t096-home-mobile.png`. Compare at the same viewport with `home-overview-approved.png`; fix P0/P1/P2 visual differences once.

- [ ] **Step 10: Commit and push Bundle A**

```bash
git add apps/api/src/daily-work apps/web/src packages/localization docs/product/screenshots/ai-native-final-implementation TASKS.md
git commit -m "feat(web): build the final employee home overview"
git push origin codex/ai-native-frontend-phase-1
```

---

### Task 3: T097 — Build the Final Project Workspace

**Files:**

- Create: `apps/api/src/daily-work/project-experience-query.service.ts`
- Create: `apps/api/src/daily-work/project-experience-query.service.test.ts`
- Modify: `apps/api/src/daily-work/daily-work.controller.ts`
- Modify: `apps/api/src/daily-work/daily-work.module.ts`
- Modify: `apps/web/src/platform/daily-work-api.ts`
- Create: `apps/web/src/features/project-experience/project-experience-model.ts`
- Create: `apps/web/src/features/project-experience/project-experience-model.test.ts`
- Create: `apps/web/src/product-ui/project/project-workspace.tsx`
- Create: `apps/web/src/product-ui/project/project-workspace.module.css`
- Create: `apps/web/src/product-ui/project/project-workspace.test.tsx`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/page.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`

**Interfaces:**

- Consumes: existing Project Workspace, Progress Query, Documents, Criteria, and `ActivityReader.timeline` public readers.
- Produces: `EmployeeProjectExperienceV1` and `buildProjectExperienceModel()`.
- Does not produce: a progress mutation or a direct database read.

- [ ] **Step 1: Write RED tests for Project composition**

Cover accepted, awaiting-contract, awaiting-information, stale-source, missing-document, and unrelated-user cases. Prove the current/next milestone is derived from authoritative `milestoneStates` without changing percentages.

- [ ] **Step 2: Implement the Project read composition**

Compose Project purpose/owners/workstreams/document, active contract/pulse, one KPI, attention gaps, and the first Timeline page. Return opaque public IDs only where a command or deep link needs them; do not render IDs.

- [ ] **Step 3: Write and implement the Project visual**

Match `project-workspace-approved.png`: project header, document provenance, circular progress, milestone path, attention queue, compact tabs for Work/Updates/Evidence/Documents, append-only Timeline, and Smart Brief. On mobile, use a focused bottom sheet for rows/actions.

- [ ] **Step 4: Wire the Project route behind rollback**

Use `AI_NATIVE_FINAL_PROJECT_ENABLED=false` to render the current `WorkspaceClient`. Keep research and progress-contract deep links.

- [ ] **Step 5: Run focused verification**

```bash
pnpm --filter @evaluation/api test -- project-experience-query.service.test.ts
pnpm --filter @evaluation/web test -- project-experience-model.test.ts project-workspace.test.tsx
pnpm --filter @evaluation/web typecheck
pnpm --filter @evaluation/web lint
```

- [ ] **Step 6: Capture and compare Project desktop/mobile**

Save `t097-project-desktop.png` and `t097-project-mobile.png`, compare against the approved Project visual, and fix P0/P1/P2 differences once.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/daily-work apps/web/src packages/localization docs/product/screenshots/ai-native-final-implementation
git commit -m "feat(web): build the final project workspace"
```

---

### Task 4: T098 — Align Work with the Approved Daily Hierarchy

**Files:**

- Modify: `apps/web/src/features/work-list/work-list-model.ts`
- Modify: `apps/web/src/features/work-list/work-list-model.test.ts`
- Modify: `apps/web/src/product-ui/work/work-workspace.tsx`
- Modify: `apps/web/src/product-ui/work/work-workspace.module.css`
- Modify: `apps/web/src/product-ui/work/work-workspace.test.tsx`
- Modify: `apps/web/src/app/[locale]/tasks/page.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`

**Interfaces:**

- Consumes: `DailyWorkspaceSnapshot` for authoritative Needs My Action/Today/Overdue/Waiting/Upcoming groups and existing Work Item detail/create/transition commands.
- Produces: `buildWorkListModel({ snapshot, projects })` with collapsed secondary groups.
- Preserves: URL-owned selected Task, focus return, authoritative `allowedTransitions`, Board, Calendar, and legacy Tasks rollback.

- [ ] **Step 1: Write RED hierarchy tests**

Assert the exact group order, no duplicate Work Item across groups, primary groups expanded, waiting/upcoming collapsed, and selected Task bound to the current URL generation.

- [ ] **Step 2: Update the Work model and server inputs**

Load the existing My Work snapshot beside the Task workspace. Deduplicate by Work Item ID without changing authoritative status or due dates.

- [ ] **Step 3: Implement the approved Work layout**

Replace the large create form with compact `Add task`/`Share anything` actions. Render rows with Task, Project/Workstream, source, due, status, and next action. Keep the existing Task drawer and transitions.

- [ ] **Step 4: Run focused verification**

```bash
pnpm --filter @evaluation/web test -- work-list-model.test.ts work-workspace.test.tsx task-detail-drawer.test.tsx
pnpm --filter @evaluation/web typecheck
pnpm --filter @evaluation/web lint
```

- [ ] **Step 5: Capture Work desktop/mobile and commit Bundle B**

Save `t098-work-desktop.png` and `t098-work-mobile.png`, compare with `work-approved.png`, then:

```bash
git add apps/web/src packages/localization docs/product/screenshots/ai-native-final-implementation
git commit -m "feat(web): align Work with the approved daily hierarchy"
git push origin codex/ai-native-frontend-phase-1
```

---

### Task 5: T099 — Build Intelligent Universal Capture and Clarification

**Files:**

- Create: `apps/api/src/experience-orchestration/capture-understanding.service.ts`
- Create: `apps/api/src/experience-orchestration/capture-understanding.service.test.ts`
- Create: `apps/api/src/experience-orchestration/capture-understanding.controller.ts`
- Modify: `apps/api/src/experience-orchestration/experience-orchestration.module.ts`
- Modify: `packages/ai-routing/src/route-artifacts.ts`
- Create: `packages/ai-evals/src/capture-understanding.eval.test.ts`
- Create: `apps/web/src/platform/capture-understanding-api.ts`
- Create: `apps/web/src/features/universal-capture/capture-session.ts`
- Create: `apps/web/src/features/universal-capture/capture-session.test.ts`
- Modify: `apps/web/src/product-ui/capture/capture-dialog.tsx`
- Modify: `apps/web/src/product-ui/capture/capture-dialog.module.css`
- Modify: `apps/web/src/product-ui/capture/capture-dialog.test.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`

**Interfaces:**

- Consumes: existing private capture service, authorized Project/Work Item context, and `Pick<AiRouter, "run">`.
- Produces: `CaptureUnderstandingService.understand(actor, input): Promise<CaptureUnderstandingV1>`.
- Produces no command and writes no official Update, Evidence, Work Item, progress, or evaluation record.
- Deterministic fallback returns an uncertain interpretation plus a private/manual path; it never fabricates a Project or percentage.

- [ ] **Step 1: Write AI/protected-boundary RED tests**

Cover text, URL, code, file/image metadata, voice transcript, mixed Arabic/English, one-question-at-a-time, prompt injection, missing source/measurement, wrong-user Project exclusion, and prohibited rating/progress inference.

- [ ] **Step 2: Implement the closed AI route**

Register `experience.capture-understand.v1` with versioned prompt/output artifacts. Feed only authorized candidate names/IDs and bounded untrusted content. Validate inside the AI Router persistence callback; on timeout/unavailable/quarantine return the deterministic uncertain result.

- [ ] **Step 3: Expose the protected understanding endpoint**

Use the existing Work Items/Context authorization composition. Add positive employee/contributor, negative inactive, and wrong-Project tests. Never return another employee’s private source.

- [ ] **Step 4: Implement the local capture state machine**

```ts
type CaptureSessionState =
  | { kind: "capture"; draft: CaptureDraft }
  | { kind: "understanding"; draft: CaptureDraft }
  | {
      kind: "clarify";
      draft: CaptureDraft;
      understanding: CaptureUnderstandingV1;
      answers: readonly ClarificationAnswer[];
    }
  | { kind: "review"; draft: CaptureDraft; understanding: CaptureUnderstandingV1 }
  | { kind: "private_saved"; inboxItemId: string }
  | { kind: "recoverable_error"; draft: CaptureDraft; failedSource: string };
```

Every transition preserves the raw draft locally. Clarification asks only the current missing question. `Save privately for later` always remains available.

- [ ] **Step 5: Implement the approved Capture drawer/sheet**

Match `universal-capture-approved.png`: single mixed composer, attachment rows, input icons from the icon library, three-step indicator, likely Project/meaning/related Work/KPI/privacy summary, one clarification, and safe bottom actions. Do not make the employee choose a source type first.

- [ ] **Step 6: Run focused verification**

```bash
pnpm --filter @evaluation/api test -- capture-understanding.service.test.ts
pnpm --filter @evaluation/ai-evals test -- capture-understanding.eval.test.ts
pnpm --filter @evaluation/web test -- capture-session.test.ts capture-dialog.test.tsx
pnpm scan:ai-boundary
pnpm scan:secrets
```

- [ ] **Step 7: Capture Capture/Clarification states**

Save desktop, 390px bottom-sheet, and provider-unavailable images. Compare the desktop state with `universal-capture-approved.png` and fix P0/P1/P2 differences once.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/experience-orchestration apps/web/src packages/ai-routing packages/ai-evals packages/localization docs/product/screenshots/ai-native-final-implementation
git commit -m "feat(experience): add intelligent universal capture"
```

---

### Task 6: T100 — Build Review & Confirmation

**Files:**

- Create: `apps/web/src/features/review-confirmation/review-confirmation-model.ts`
- Create: `apps/web/src/features/review-confirmation/review-confirmation-model.test.ts`
- Create: `apps/web/src/platform/review-confirmation-api.ts`
- Create: `apps/web/src/platform/review-confirmation-api.test.ts`
- Create: `apps/web/src/product-ui/review/review-confirmation.tsx`
- Create: `apps/web/src/product-ui/review/review-confirmation.module.css`
- Create: `apps/web/src/product-ui/review/review-confirmation.test.tsx`
- Modify: `apps/web/src/product-ui/capture/capture-dialog.tsx`
- Modify: `apps/web/src/app/api/daily-work/[...path]/route.ts`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`

**Interfaces:**

- Consumes: existing Update start/answer/revise/confirm, Evidence create/revise/confirm, context-link, and Progress proposal/owner-confirmation APIs.
- Produces: `executeSelectedActions(draft, selection)` returning an ordered `ReviewConfirmationResultV1` with separate outcome per domain command.
- The executor never calls a progress mutation from Task completion, activity counts, or GitHub volume.

- [ ] **Step 1: Write RED selection/consequence tests**

Prove Update and Evidence can be selected independently, employee edit is mandatory for GitHub evidence, progress proposal defaults unselected, owner confirmation remains separate, stale versions preserve edits, and an Update success plus Evidence failure is displayed as partial—not full—success.

- [ ] **Step 2: Implement the pure review model**

The model owns checkboxes, edit buffers, displayed rationale/sources/uncertainty, and exact consequence copy. It does not derive allowed transitions or synthesize Project progress.

- [ ] **Step 3: Implement protected command adapters**

Validate all request/response bodies with browser-local Zod schemas. Call each owning protected API separately with expected version/idempotency data. Stop dependent actions when their prerequisite fails; preserve independent confirmed results.

- [ ] **Step 4: Implement the approved Review & Confirmation UI**

Match `review-confirmation-approved.png`: editable Update, separately selectable Evidence/contribution, clearly separate progress proposal, source/why/freshness/uncertainty, `After confirmation`, and `Back and edit` / `Save private draft` / `Confirm selected actions`. Use a right drawer on desktop and bottom sheet on mobile.

- [ ] **Step 5: Add the append-only receipt state**

After confirmation, reload the authoritative Timeline/What Changed readers and show their receipts. Never create a client-only “confirmed” record.

- [ ] **Step 6: Run the bounded critical review and focused verification**

Run:

```bash
pnpm --filter @evaluation/web test -- review-confirmation-model.test.ts review-confirmation-api.test.ts review-confirmation.test.tsx capture-dialog.test.tsx
pnpm --filter @evaluation/updates-evidence test -- update-service.integration.test.ts evidence-service.integration.test.ts
pnpm --filter @evaluation/projects test -- progress-calculation-service.integration.test.ts
pnpm validate:protected-api-matrix
pnpm scan:ai-boundary
pnpm scan:secrets
```

One specification/security reviewer checks only: no official write before confirmation, no GitHub auto-evidence, no automatic progress, no rating output, correct owner privacy, and truthful partial recovery. Fix confirmed P0/P1 once and recheck only corrected findings.

- [ ] **Step 7: Capture review desktop/mobile/recovery and commit Bundle C**

Save `t100-review-desktop.png`, `t100-review-mobile.png`, and `t100-partial-recovery.png`, then:

```bash
git add apps/web/src packages/localization docs/product/screenshots/ai-native-final-implementation
git commit -m "feat(web): add explicit review and confirmation"
git push origin codex/ai-native-frontend-phase-1
```

---

### Task 7: T101 — Run Final Customer-Journey Acceptance

**Files:**

- Create: `tests/e2e/ai-native-final-experience/employee-journey.spec.ts`
- Create: `tests/e2e/ai-native-final-experience/recovery-and-rollback.spec.ts`
- Create: `docs/acceptance/AI_NATIVE_FINAL_EMPLOYEE_EXPERIENCE.md`
- Create: `docs/product/screenshots/ai-native-final-implementation/README.md`
- Modify: `docs/product/AI_NATIVE_ROUTE_RETIREMENT_LEDGER.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: the completed T095–T100 screens and their existing protected APIs.
- Produces: one reproducible local product flow, acceptance evidence, route-retirement recommendation, and explicit remaining external gates.

- [ ] **Step 1: Seed one realistic employee journey**

Use synthetic Atlas Delivery data with a main document, approved Progress Contract, milestone states, one KPI with baseline/current/target, Work Items, Gmail/Calendar/GitHub suggestions, manual evidence, and Timeline history. No personal customer or Gmail content enters fixtures.

- [ ] **Step 2: Run the complete authenticated journey**

Home → select Project → inspect approved progress/KPI → open Work → capture mixed update with attachment → answer clarification → edit Update/Evidence → confirm selected actions → inspect authoritative Timeline/What Changed.

- [ ] **Step 3: Run recovery and rollback journeys**

Verify AI unavailable/manual draft, connector unavailable/manual capture, stale confirmation, partial command result, session expiry, 390px mobile, RTL foundations, reduced motion, and each final-experience flag restoring its retained route.

- [ ] **Step 4: Run the major integration checkpoint**

```bash
pnpm --filter @evaluation/web test
pnpm --filter @evaluation/web typecheck
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web build
pnpm --filter @evaluation/api test -- daily-work.e2e.integration.test.ts updates-evidence.e2e.integration.test.ts
pnpm test:e2e -- tests/e2e/ai-native-final-experience
pnpm validate:frontend-boundaries
pnpm validate:protected-api-matrix
pnpm scan:ai-boundary
pnpm scan:secrets
```

- [ ] **Step 5: Perform final visual comparison**

Compare the five approved 1487×1058 targets with matching implementation captures. Fix P0/P1/P2 layout, hierarchy, spacing, focus, overflow, and responsive defects. Record remaining P3 polish without delaying acceptance.

- [ ] **Step 6: Write the non-technical acceptance report**

Record exact URLs, test account roles, journey steps, what the assistant did, what required human confirmation, progress provenance, fallbacks, screenshots, missing/external behavior, rollback, and whether each retained route is ready for later retirement.

- [ ] **Step 7: Commit, push, and update Pull Request #29**

```bash
git add tests/e2e/ai-native-final-experience docs/acceptance docs/product/screenshots/ai-native-final-implementation docs/product/AI_NATIVE_ROUTE_RETIREMENT_LEDGER.md TASKS.md project-state/PROJECT_STATE.md
git commit -m "test(web): accept the final employee journey"
git push origin codex/ai-native-frontend-phase-1
gh pr edit 29 --add-label "product-acceptance"
```

Do not merge or retire routes. Stop at the Product Owner gate with the full local journey running.

## Plan Self-Review

- **Spec coverage:** Home, Project, Work, Capture, Clarification, Review & Confirmation, progress/KPI provenance, Smart Brief, Timeline, mobile, RTL, accessibility, recovery, and rollback each map to a task.
- **Protected boundaries:** AI Router-only, employee confirmation, GitHub suggestion, progress contract, evaluation separation, owner privacy, server authorization, and append-only history are explicit in implementation and verification.
- **Scope control:** No microservice, second store/auth system, generic activity platform, package-per-screen architecture, new performance metric, or route deletion is introduced.
- **Execution mode:** Use Fast Controlled Execution with three pushed bundles. Visual tasks use self-review; only T100 receives one bounded protected-boundary review.
