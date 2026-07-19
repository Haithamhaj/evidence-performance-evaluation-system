# Unified Daily Work and Contract-Aware GitHub Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the real Codex employee journey from an authoritative Project document through a live-AI-drafted, human-approved Progress Contract, then correct the daily Update journey, automate contract-aware GitHub Project progress without scoring employees, unify manual and voice sources, and prepare a neutral Evaluation Fact View.

**Architecture:** Preserve the modular monolith and the completed Phase 0/1 and Phase 2 Slice 1/2 foundations. Extend `projects` to own document-derived Progress Contract draft proposals, human revisions, repository bindings, deterministic Progress Contract rules, and official snapshots; extend `updates-evidence` to own source ingestion, employee-confirmed contribution evidence, and the shared Update lifecycle; compose My Work and Fact View reads in the API application layer. Codex is a synthetic employee/contributor in a real local acceptance Project; Haitham remains the protected human Product Owner and approver.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7, NestJS 11, Next.js 16 App Router, React 19, Prisma/PostgreSQL, BullMQ/Redis, S3-compatible private storage, Zod 4, Vitest, Playwright.

## Global Constraints

- The approved design is `docs/superpowers/specs/2026-07-19-unified-daily-work-github-progress-design.md`.
- The approved dogfood design is `docs/superpowers/specs/2026-07-19-codex-dogfood-project-design.md`.
- The dogfood Project tracks the real repository and Phase 2 Pull Request; it is acceptance data, not a second product architecture.
- The AI may draft a Progress Contract only from an exact, approved Project document version. The draft is never active until a human reviews, edits as needed, submits, and approves it through the existing versioned lifecycle.
- A Progress Contract AI output must preserve source references and route/prompt/schema trace, and must never contain a rating, rank, productivity score, employee readiness value, or directly entered overall-progress percentage.
- A Project is required for every Update; Workstream and Work Item are optional and must belong to the selected Project.
- Operational Project/Workstream progress is never employee performance.
- Raw task, Update, evidence, commit, PR, file, line, or activity counts never calculate progress.
- A GitHub event changes official progress only by proving a deterministic condition in the active, human-approved Progress Contract.
- The overall progress percentage cannot be entered or overridden directly.
- GitHub remains suggested evidence for personal contribution; employee review and confirmation are mandatory before it becomes a contribution record.
- AI never assigns, predicts, recommends, or implies a rating, rank, productivity score, or employee readiness percentage.
- All production AI calls use the AI Router; feature modules never import provider SDKs.
- Uploaded text, documents, code, CLI output, images, audio, comments, and GitHub content are untrusted input.
- Preserve raw sources, revisions, confirmations, source references, responsibility windows, and accepted events through append-only history.
- Server-side authorization is mandatory; UI hiding is not authorization.
- English-only pilot use is permitted. Existing Arabic localization and RTL foundations remain required; Arabic employee release remains gated by approved Arabic rubric content and semantic review.
- Phase 2 may prepare and display a neutral Fact View but must not implement self-rating, manager rating, comparison, or finalization.
- Use Fast Controlled Execution: `superpowers:executing-plans` for routine bounded work; one specification review and one security/code-quality review for GitHub, migrations, AI, privacy, audit, and immutability; remediate confirmed P0/P1 findings once and re-review only those findings.
- Run focused tests after each task, related integration and browser tests at each bundle checkpoint, and the full repository suite only at a major shared-foundation checkpoint and before the Phase 2 pull request is ready to merge.

---

## File and module map

### Existing files to extend

- `packages/contracts/src/updates-evidence.ts` — canonical Update, evidence, clarification, result-card, and voice contracts.
- `packages/contracts/src/progress-contracts.ts` — canonical deterministic progress-source contracts.
- `packages/contracts/src/index.ts` — public contract exports.
- `packages/database/prisma/schema.prisma` — append-only GitHub, source-attachment, and voice persistence.
- `packages/updates-evidence/src/update-service.ts` — Update source, draft, clarification, revision, and confirmation lifecycle.
- `packages/updates-evidence/src/evidence-service.ts` — employee-reviewed evidence lifecycle.
- `packages/updates-evidence/src/activity-reader.ts` — Update/evidence review and Timeline projections.
- `packages/projects/src/progress-calculation-service.ts` — official Progress Contract calculation and snapshots.
- `packages/projects/src/progress-contract-service.ts` — existing human-controlled `draft → pending_approval → active` lifecycle used after AI drafting.
- `packages/projects/src/progress-query-service.ts` — authorized Project and Workstream context/progress reads.
- `apps/api/src/daily-work/daily-work-query.service.ts` — application composition for My Work and Update context.
- `apps/api/src/daily-work/daily-work.controller.ts` — protected daily-work read endpoints.
- `apps/api/src/updates-evidence/updates.controller.ts` — protected Update commands and reads.
- `apps/api/src/updates-evidence/updates-evidence.module.ts` — API dependency composition.
- `apps/web/src/app/[locale]/my-work/my-work-client.tsx` — My Work daily actions.
- `apps/web/src/app/[locale]/my-work/update-composer.tsx` — composer state and API orchestration.
- `apps/web/src/app/[locale]/evidence/evidence-review-sheet.tsx` — visible employee evidence review.
- `apps/web/src/app/[locale]/timeline/timeline-list.tsx` — source-labelled Timeline.
- `packages/localization/src/catalogs/en.json` and `packages/localization/src/catalogs/ar.json` — all user-visible copy.

### Focused files to create

- `packages/projects/src/progress-contract-draft-artifacts.ts` — versioned prompt/schema artifacts for document-derived contract proposals.
- `packages/projects/src/progress-contract-draft-service.ts` — durable AI draft, append-only human revision, and apply-to-existing-contract lifecycle.
- `apps/api/src/projects/progress-contract-drafts.controller.ts` — authorized AI draft/revision/apply endpoints.
- `apps/web/src/app/[locale]/projects/[projectId]/progress-contract-draft-panel.tsx` — source-visible human review and correction UI.
- `scripts/register-progress-contract-draft-ai-route.ts` — idempotent AI Router artifact and route registration.
- `scripts/seed-codex-dogfood.ts` — deterministic local acceptance Project, Codex user, authoritative document snapshot, and Work Items.
- `packages/contracts/src/github.ts` — repository binding, webhook disposition, and suggested-evidence contracts.
- `packages/contracts/src/evaluation-facts.ts` — neutral source fact and interpretation schemas with no rating fields.
- `packages/projects/src/github-binding-service.ts` — authorized, versioned repository bindings and deterministic mappings.
- `packages/projects/src/github-progress-service.ts` — contract-rule evaluation and official snapshot application.
- `packages/projects/src/progress-source-assembler.ts` — latest component facts plus one verified source, without direct percentage input.
- `packages/updates-evidence/src/github-event-service.ts` — durable idempotent GitHub event ingestion and disposition.
- `packages/updates-evidence/src/github-installation-service.ts` — GitHub App installation state without storing installation tokens.
- `packages/updates-evidence/src/github-suggestion-service.ts` — employee review/dismiss/confirm lifecycle for contribution suggestions.
- `packages/updates-evidence/src/voice-update-service.ts` — transcript correction gate followed by the existing Update lifecycle.
- `apps/api/src/github/github-webhook.controller.ts` — bounded signature-verified webhook entry.
- `apps/api/src/github/github-installation.controller.ts` — protected installation/setup and Project binding entry.
- `apps/api/src/github/github.module.ts` — GitHub application composition.
- `apps/worker/src/github/github-event.processor.ts` — durable event processing and retry.
- `apps/worker/src/github/github-reconciliation.processor.ts` — installation-token-based missed-event reconciliation.
- `apps/web/src/app/[locale]/my-work/update-composer-view.tsx` — presentational draft-first composer.
- `apps/web/src/app/[locale]/my-work/update-draft-storage.ts` — versioned `sessionStorage` draft continuity.
- `apps/web/src/app/[locale]/my-work/update-result-card.tsx` — readable confirmed Update result.
- `apps/web/src/app/[locale]/projects/[projectId]/github/github-activity-panel.tsx` — automatic Project source activity.
- `apps/web/src/app/[locale]/evidence/github-suggestion-sheet.tsx` — employee confirmation of GitHub contribution evidence.
- `apps/web/src/app/[locale]/evaluation-preparation/page.tsx` — Phase 2 neutral Fact View.
- `apps/api/src/evaluation-preparation/fact-view-query.service.ts` — read composition through public module interfaces.
- `apps/api/src/evaluation-preparation/evaluation-preparation.controller.ts` — protected Fact View endpoint.

## Public interfaces fixed by this plan

```ts
export type UpdateComposerContext = Readonly<{
  projects: readonly Readonly<{
    id: string;
    name: string;
    workstreams: readonly Readonly<{ id: string; name: string }>[];
    workItems: readonly Readonly<{ id: string; title: string; workstreamId: string | null }>[];
  }>[];
}>;

export type DraftFirstClarificationState =
  | Readonly<{
      state: "draft_with_question";
      sessionId: string;
      sessionVersion: number;
      draft: StructuredUpdateDraft;
      turnId: string;
      question: string;
      remainingFieldCount: number;
    }>
  | Readonly<{
      state: "ready_for_review";
      sessionId: string;
      sessionVersion: number;
      draft: StructuredUpdateDraft;
    }>;

export type UpdateResultCard = Readonly<{
  acceptedEventId: string;
  project: { id: string; name: string };
  workstream: { id: string; name: string } | null;
  workItem: { id: string; title: string } | null;
  summary: string;
  result: string;
  sourceReferences: readonly string[];
  comparison: { previousAcceptedEventId: string | null; explanation: string };
  blocker: string | null;
  nextAction: string;
  documentationNeeds: readonly string[];
  progressImpact:
    | { state: "applied"; snapshotId: string; previousPercent: number; percent: number }
    | { state: "awaiting_confirmation"; componentIds: readonly string[] }
    | { state: "no_measurable_impact" }
    | { state: "insufficient_information"; missing: readonly string[] };
  confirmedAt: string;
}>;

export type ProgressContractDraftResult = Readonly<{
  requestId: string;
  revision: number;
  projectId: string;
  documentVersionId: string;
  promptVersion: string;
  schemaVersion: string;
  modelRouteTraceId: string;
  components: readonly Readonly<{
    clientKey: string;
    kind: "milestone" | "deliverable" | "operational_kpi";
    name: string;
    description: string;
    weight: number | null;
    baseline: number | null;
    target: number | null;
    unit: string | null;
    direction: "increase" | "decrease" | "maintain" | null;
    acceptanceConditions: readonly string[];
    requiredEvidence: readonly string[];
    confirmationMode: "deterministic" | "human_confirmed";
    proposedSourceMappings: readonly Readonly<{
      source: "github";
      event: "pull_request_merged" | "required_checks_passed" | "release_published";
      repositoryRef: string;
      branchRef: string | null;
      checkNames: readonly string[];
    }>[];
    sourceReferences: readonly string[];
  }>[];
  ambiguities: readonly string[];
  clarificationQuestions: readonly string[];
}>;
```

---

## Bundle 1 — Daily Update Journey Correction

### Task 1: Add authorized Update scope composition

**Files:**

- Modify: `packages/contracts/src/updates-evidence.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/projects/src/progress-query-service.ts`
- Modify: `packages/work-items/src/query-service.ts`
- Modify: `apps/api/src/daily-work/daily-work-query.service.ts`
- Modify: `apps/api/src/daily-work/daily-work.controller.ts`
- Test: `packages/contracts/src/updates-evidence.test.ts`
- Test: `packages/projects/src/progress-calculation-service.integration.test.ts`
- Test: `packages/work-items/src/query-service.test.ts`
- Test: `apps/api/src/daily-work/daily-work.e2e.integration.test.ts`

**Interfaces:**

- Consumes: current Project membership/responsibility windows and `WorkItemQueryService`.
- Produces: `UpdateComposerContextSchema`, `ProgressQueryService.listUpdateScopes({ actorId })`, `WorkItemQueryService.listUpdatable({ actorId })`, and `GET /api/v1/daily-work/update-context`.

- [x] **Step 1: Write failing contract and composition tests**

```ts
it("requires a Project while keeping Workstream and Work Item optional", () => {
  expect(
    UpdateComposerContextSchema.parse({
      projects: [{ id: PROJECT_ID, name: "Atlas", workstreams: [], workItems: [] }],
    }).projects[0]?.name,
  ).toBe("Atlas");
  expect(() =>
    StartTextUpdateInputSchema.parse({
      idempotencyKey: KEY,
      projectId: null,
      workstreamId: null,
      workItemId: null,
      rawText: "Completed the approved deployment",
      executionMode: "ai_assisted",
    }),
  ).toThrow();
});
```

- [x] **Step 2: Run the focused tests and confirm the new schema/read methods are missing**

Run: `pnpm exec vitest run --project unit packages/contracts/src/updates-evidence.test.ts packages/work-items/src/query-service.test.ts apps/api/src/daily-work/daily-work.e2e.integration.test.ts`

Expected: FAIL because `UpdateComposerContextSchema`, `listUpdateScopes`, and `updateContext` do not exist.

- [x] **Step 3: Add the strict context schema and public query methods**

```ts
export const UpdateComposerContextSchema = z
  .object({
    projects: z.array(
      z
        .object({
          id: UuidSchema,
          name: z.string().trim().min(1).max(200),
          workstreams: z.array(
            z
              .object({
                id: UuidSchema,
                name: z.string().trim().min(1).max(200),
              })
              .strict(),
          ),
          workItems: z.array(
            z
              .object({
                id: UuidSchema,
                title: z.string().trim().min(1).max(300),
                workstreamId: UuidSchema.nullable(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
```

`DailyWorkQueryService.updateContext()` must join only the outputs of the public Projects and Work Items query services. It must not read either package's tables directly.

- [x] **Step 4: Add and protect `GET /api/v1/daily-work/update-context`**

The endpoint returns only active Projects the actor may contribute to, their active Workstreams, and Work Items with `add_update`; a manager receives contributor actions only when separately authorized as a contributor/owner.

- [x] **Step 5: Run focused unit and integration tests**

Run: `pnpm exec vitest run --project unit packages/contracts/src/updates-evidence.test.ts packages/work-items/src/query-service.test.ts && pnpm exec vitest run --project integration apps/api/src/daily-work/daily-work.e2e.integration.test.ts`

Expected: PASS; cross-Project Workstream/Work Item combinations return `SCOPE_MISMATCH`.

- [x] **Step 6: Commit**

```bash
git add packages/contracts/src/updates-evidence.ts packages/contracts/src/index.ts packages/projects/src/progress-query-service.ts packages/work-items/src/query-service.ts apps/api/src/daily-work
git commit -m "feat: compose optional-scope project updates"
```

### Task 2: Persist a draft before clarification and return a readable result

**Files:**

- Modify: `packages/contracts/src/updates-evidence.ts`
- Modify: `packages/updates-evidence/src/update-service.ts`
- Modify: `packages/updates-evidence/src/ai-structurer.ts`
- Modify: `packages/updates-evidence/src/prompts.ts`
- Modify: `packages/updates-evidence/src/activity-reader.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0015_update_draft_context/migration.sql`
- Modify: `apps/api/src/updates-evidence/updates.controller.ts`
- Modify: `scripts/register-update-structure-ai-route.ts`
- Test: `packages/updates-evidence/src/update-service.integration.test.ts`
- Test: `packages/updates-evidence/src/ai-structurer.test.ts`
- Test: `packages/updates-evidence/src/prompts.test.ts`
- Test: `apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts`
- Test: `tests/ai-evals/update-structuring.eval.test.ts`

**Interfaces:**

- Consumes: `UpdateComposerContext`, active Progress Contract references, prior accepted Update, AI Router route `update.structure`.
- Produces: `DraftFirstClarificationState`, `UpdateResultCardSchema`, `ActivityReader.updateResult({ actorId, acceptedEventId })`, and `GET /api/v1/updates/:acceptedEventId/result`.

- [x] **Step 1: Write failing draft-first and no-rating tests**

```ts
it("returns a useful draft with the first necessary question", async () => {
  const state = await service.start(command);
  expect(state.state).toBe("draft_with_question");
  if (state.state !== "draft_with_question") throw new Error("expected draft");
  expect(state.draft.summary).toContain("deployment");
  expect(state.question).toMatch(/\S/u);
});

it("rejects AI output containing performance fields", () => {
  expect(() =>
    UpdateStructureAiOutputSchema.parse({
      state: "ready_for_review",
      unresolvedFields: [],
      draft: { ...VALID_DRAFT, suggestedRating: 5 },
    }),
  ).toThrow();
});
```

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec vitest run --project unit packages/updates-evidence/src/ai-structurer.test.ts packages/updates-evidence/src/prompts.test.ts && pnpm exec vitest run --project integration packages/updates-evidence/src/update-service.integration.test.ts`

Expected: FAIL because the current `question` state contains no draft and no result-card reader exists.

- [x] **Step 3: Replace question-first output with the strict draft-first union**

```ts
export const ClarificationStateSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("draft_with_question"),
      sessionId: UuidSchema,
      sessionVersion: PositiveVersionSchema,
      draft: StructuredUpdateDraftSchema,
      turnId: UuidSchema,
      turnNumber: PositiveVersionSchema,
      question: z.string().trim().min(1).max(1_000),
      affects: z.array(ClarificationAffectsSchema).min(1).max(7),
      remainingFieldCount: PositiveVersionSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("ready_for_review"),
      sessionId: UuidSchema,
      sessionVersion: PositiveVersionSchema,
      draft: StructuredUpdateDraftSchema,
    })
    .strict(),
]);
```

Persist an `ai_draft` revision on every validated AI run before creating the next unanswered clarification turn. Keep the original `UpdateSource.rawText` unchanged.

- [x] **Step 4: Add structured closure and contract mapping fields**

Add `documentationNeeds: string[]` and `relatedProgressComponentIds: string[]` to AI drafts, employee revisions, stored revisions, and result reads. Treat these IDs as suggestions only; confirmation or a deterministic rule remains required before official progress changes.

- [x] **Step 5: Add the authorized result-card reader**

```ts
async updateResult(input: { actorId: string; acceptedEventId: string }): Promise<UpdateResultCard> {
  const event = await this.loadAuthorizedAcceptedUpdate(input);
  return UpdateResultCardSchema.parse(this.toResultCard(event));
}
```

The reader resolves real Project/Workstream/Work Item names, the accepted employee revision, evidence state, comparison, progress disposition, and documentation gaps.

- [x] **Step 6: Version the AI schema/prompt and run AI evaluations**

Run: `pnpm test:ai -- tests/ai-evals/update-structuring.eval.test.ts`

Expected: PASS for English and existing Arabic fixtures; no output key matches rating, rank, performance score, productivity, or employee readiness.

- [x] **Step 7: Run service and API tests**

Run: `pnpm exec vitest run --project integration packages/updates-evidence/src/update-service.integration.test.ts apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts`

Expected: PASS; retries are idempotent and stale session/draft versions return 409 without duplicate answers or events.

- [x] **Step 8: Commit**

```bash
git add packages/contracts/src/updates-evidence.ts packages/updates-evidence/src apps/api/src/updates-evidence tests/ai-evals
git commit -m "feat: make update structuring draft first"
```

### Task 3: Replace the Work-Item-first form with the unified daily composer

**Files:**

- Create: `apps/web/src/app/[locale]/my-work/update-composer-view.tsx`
- Create: `apps/web/src/app/[locale]/my-work/update-draft-storage.ts`
- Create: `apps/web/src/app/[locale]/my-work/update-result-card.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/update-composer.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/my-work-client.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/page.tsx`
- Modify: `apps/web/src/platform/daily-work-api.ts`
- Modify: `apps/web/src/platform/updates-evidence-contracts.ts`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/src/app/[locale]/my-work/update-composer.test.tsx`
- Test: `apps/web/src/app/[locale]/my-work/update-draft-storage.test.ts`
- Test: `apps/web/src/app/[locale]/my-work/update-result-card.test.tsx`
- Test: `apps/web/src/app/[locale]/my-work/my-work.test.tsx`

**Interfaces:**

- Consumes: `GET /api/daily-work/update-context`, draft-first Update endpoints, `UpdateResultCard`.
- Produces: one Project-required composer with optional Workstream/Work Item, draft-visible clarification, session continuity, precise recovery, and a compact confirmed result card.

- [x] **Step 1: Write failing UI tests for the corrected journey**

```tsx
it("starts from Project and does not require a Work Item", async () => {
  render(<UpdateComposerView {...props} stage={{ kind: "entry", context: EMPTY_CONTEXT }} />);
  expect(screen.getByLabelText(catalog["updates.project"])).toBeRequired();
  expect(screen.getByLabelText(catalog["updates.workItem"])).not.toBeRequired();
});

it("shows the evolving draft beside one clarification", () => {
  render(<UpdateComposerView {...props} stage={DRAFT_WITH_QUESTION} />);
  expect(screen.getByText(DRAFT_WITH_QUESTION.draft.summary)).toBeVisible();
  expect(screen.getByText(DRAFT_WITH_QUESTION.question)).toBeVisible();
});
```

- [x] **Step 2: Run the focused UI tests and verify RED**

Run: `pnpm exec vitest run --project unit 'apps/web/src/app/[locale]/my-work/update-composer.test.tsx' 'apps/web/src/app/[locale]/my-work/my-work.test.tsx'`

Expected: FAIL because the current form requires `itemId`, hides the draft during questions, and ends with a generic success panel.

- [x] **Step 3: Split presentation, orchestration, storage, and result rendering**

```ts
export const UPDATE_DRAFT_STORAGE_VERSION = 1;

export function saveUpdateDraft(key: string, value: UpdateDraftEnvelope): void {
  sessionStorage.setItem(
    `daily-update:v${UPDATE_DRAFT_STORAGE_VERSION}:${key}`,
    JSON.stringify(value),
  );
}

export function removeUpdateDraft(key: string): void {
  sessionStorage.removeItem(`daily-update:v${UPDATE_DRAFT_STORAGE_VERSION}:${key}`);
}
```

Use `sessionStorage`, never browser logs, for raw in-progress text. Clear it after a confirmed Update or explicit discard.

- [x] **Step 4: Implement Project → optional Workstream → optional Work Item selection**

Changing Project clears incompatible Workstream and Work Item values. Changing Workstream clears an incompatible Work Item. Starting from a Project, Workstream, Work Item, or GitHub activity preselects only authorized context.

- [x] **Step 5: Put all source entry affordances on the first screen**

Show text, voice, upload, image/screenshot, code, CLI, URL, manual GitHub snapshot, and connected GitHub. In this bundle, text and the existing manual evidence sheet are active; voice and connected GitHub controls link to their bounded bundle state without pretending a source was accepted.

- [x] **Step 6: Add precise error classification and reauthentication recovery**

Map 400 validation, 401 session, 403 scope, 409 stale version, 413 size, 415 type, 422 AI/schema, and 503 dependency errors to distinct catalog keys and recovery actions. On 401, preserve the session draft and return path before using the existing login route.

- [x] **Step 7: Render the compact confirmed Update card**

The card shows real names, what changed, result, sources/evidence state, previous-state comparison, progress disposition, blocker, next action, documentation needs, and confirmation time. It must not show internal UUIDs.

- [x] **Step 8: Run UI, localization, lint, and type checks**

Run: `pnpm exec vitest run --project unit 'apps/web/src/app/[locale]/my-work/*.test.tsx' 'apps/web/src/app/[locale]/my-work/*.test.ts' packages/localization/src/catalog.test.ts && pnpm --filter @evaluation/web lint && pnpm --filter @evaluation/web typecheck`

Expected: PASS in English and Arabic/RTL; keyboard focus remains inside the drawer/sheet and reduced motion is honored.

- [x] **Step 9: Commit**

```bash
git add apps/web/src/app apps/web/src/platform packages/localization/src/catalogs
git commit -m "feat: correct the daily update journey"
```

### Task 4: Bundle 1 runnable acceptance checkpoint

**Files:**

- Modify: `packages/database/src/seed-pilot.ts`
- Create: `tests/e2e/daily-update-journey.spec.ts`
- Create: `docs/product/screenshots/phase-2-production/daily-update-correction/`
- Modify: `docs/product/PHASE_2_DAILY_WORK_EXPERIENCE.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: Tasks 1–3.
- Produces: realistic employee demo, screenshots, verification record, pushed checkpoint, and Product Owner gate.

- [x] **Step 1: Add deterministic data for Project-only, Workstream, and Work Item Updates**

Seed one Project with a connected contract and named Workstreams/Work Items; do not seed employee performance values.

- [x] **Step 2: Write the browser acceptance flow**

```ts
test("employee completes a Project update without a Work Item", async ({ page }) => {
  await loginAs(page, "employee");
  await page.goto("/en/my-work");
  await page.getByRole("button", { name: "Add update" }).click();
  await page.getByLabel("Project").selectOption({ label: "Atlas Delivery" });
  await page.getByLabel("What changed?").fill("Deployment passed the approved acceptance check");
  await page.getByRole("button", { name: "Prepare update" }).click();
  await expect(page.getByText("Review your update")).toBeVisible();
});
```

- [x] **Step 3: Run focused through related integration checks**

Run: `pnpm test -- packages/contracts/src/updates-evidence.test.ts packages/updates-evidence/src && pnpm test:integration -- packages/updates-evidence/src apps/api/src/daily-work apps/api/src/updates-evidence && pnpm test:e2e -- tests/e2e/daily-update-journey.spec.ts`

Expected: PASS.

- [x] **Step 4: Run protected-boundary scans**

Run: `pnpm scan:performance-inputs && pnpm scan:secrets && pnpm lint && pnpm typecheck`

Expected: PASS; no rating fields, raw-activity progress input, secret, direct provider import, or forbidden manager value.

- [x] **Step 5: Capture desktop and 390px mobile screenshots**

Capture Project selection, draft-with-question, evidence review sheet, confirmed result card, and Timeline in English and the existing Arabic/RTL interface.

- [x] **Step 6: Commit and push the checkpoint**

```bash
git add packages/database/src/seed-pilot.ts tests/e2e/daily-update-journey.spec.ts docs/product project-state/PROJECT_STATE.md
git commit -m "test: verify corrected daily update journey"
git push origin codex/phase-2-updates-evidence-readiness
```

- [x] **Step 7: Stop at the Product Owner gate**

The Product Owner reviews the running flow and screenshots. Do not begin Bundle 2 before approval because this gate validates the corrected daily-work journey that triggered the amendment.

---

## Bundle 1.5 — Codex Dogfood Project and AI-Drafted Progress Contract

This bundle is approved by the Product Owner and precedes GitHub automation. It creates the same journey a real employee uses: an approved main document defines a Project, AI proposes measurable components, a human corrects and activates the contract, and only then may automated sources affect operational Project progress.

### Task 4A: Define the bounded Progress Contract AI artifacts

**Files:**

- Modify: `packages/contracts/src/progress-contracts.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/projects/src/progress-contract-draft-artifacts.ts`
- Create: `packages/projects/src/progress-contract-draft-artifacts.test.ts`
- Create: `scripts/register-progress-contract-draft-ai-route.ts`
- Create: `scripts/register-progress-contract-draft-ai-route.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: exact Project ID, approved `DocumentVersion` ID, bounded source excerpts, locale, timezone, previous active contract summary, and protected rules.
- Produces: versioned `ProgressContractAiDraftOutputSchema`, prompt `project-progress-contract-draft.v1`, output schema `project-progress-contract-draft.v1`, and route purpose `project.progress-contract.draft`.

- [x] **Step 1: Write schema rejection tests**

```ts
it.each(["rating", "recommendedRating", "productivityScore", "employeeRank", "overallPercent"])(
  "rejects forbidden field %s",
  (field) => {
    expect(() =>
      ProgressContractAiDraftOutputSchema.parse({
        ...VALID_OUTPUT,
        [field]: 90,
      }),
    ).toThrow();
  },
);

it("requires measurable KPI metadata and source references", () => {
  expect(() =>
    ProgressContractAiDraftOutputSchema.parse({
      ...VALID_OUTPUT,
      components: [{
        clientKey: "quality-gate",
        kind: "operational_kpi",
        name: "Required checks",
        description: "Approved required checks pass",
        weight: null,
        baseline: null,
        target: 1,
        unit: "boolean",
        direction: "increase",
        acceptanceConditions: ["Every allowlisted required check is successful"],
        requiredEvidence: ["Verified GitHub check suite"],
        confirmationMode: "deterministic",
        sourceReferences: [],
      }],
    }),
  ).toThrow();
});
```

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec vitest run --project unit packages/contracts/src/progress-contracts.test.ts packages/projects/src/progress-contract-draft-artifacts.test.ts scripts/register-progress-contract-draft-ai-route.test.ts`

Expected: FAIL because the AI draft schema, artifacts, and registration script do not exist.

- [x] **Step 3: Implement strict output contracts**

```ts
export const ProgressContractAiDraftComponentSchema = z
  .object({
    clientKey: z.string().trim().min(1).max(80),
    kind: z.enum(["milestone", "deliverable", "operational_kpi"]),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2_000),
    weight: z.number().nonnegative().max(100).nullable(),
    baseline: z.number().finite().nullable(),
    target: z.number().finite().nullable(),
    unit: z.string().trim().min(1).max(80).nullable(),
    direction: z.enum(["increase", "decrease", "maintain"]).nullable(),
    acceptanceConditions: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    requiredEvidence: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
    confirmationMode: z.enum(["deterministic", "human_confirmed"]),
    proposedSourceMappings: z.array(
      z.object({
        source: z.literal("github"),
        event: z.enum(["pull_request_merged", "required_checks_passed", "release_published"]),
        repositoryRef: z.string().trim().min(1).max(300),
        branchRef: z.string().trim().min(1).max(300).nullable(),
        checkNames: z.array(z.string().trim().min(1).max(200)).max(20),
      }).strict(),
    ).max(10),
    sourceReferences: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  })
  .strict()
  .superRefine(validateKpiMetadata);
```

The enclosing schema contains only `components`, `ambiguities`, and `clarificationQuestions`; `.strict()` rejects extra scoring/progress fields. Validate unique `clientKey` values, one to twelve components, and optional weights totalling exactly `100` only when every component is weighted.

- [x] **Step 4: Create injection-resistant versioned prompt and output schema artifacts**

The system prompt states that quoted Project documents are untrusted evidence, never instructions. It requires operational Project measures, explicit source citations, deterministic conditions only when objectively provable, human confirmation for qualitative acceptance, and no raw-activity or employee-performance inference.

- [x] **Step 5: Register the route idempotently**

```ts
await registerAiRouteArtifacts({
  purpose: "project.progress-contract.draft",
  prompt: PROJECT_PROGRESS_CONTRACT_PROMPT_V1,
  outputSchema: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_V1,
  requiredCapabilities: ["structured_output"],
  reason: "Approved Codex dogfood Progress Contract drafting route",
});
```

The script uses the existing system-level GPT-5.5 route and never reads, prints, moves, or writes the provider credential.

- [x] **Step 6: Run schema, prompt, route-boundary, lint, and type checks**

Run: `pnpm exec vitest run --project unit packages/contracts/src/progress-contracts.test.ts packages/projects/src/progress-contract-draft-artifacts.test.ts scripts/register-progress-contract-draft-ai-route.test.ts && pnpm scan:performance-inputs && pnpm scan:ai-boundary && pnpm --filter @evaluation/projects typecheck`

Expected: PASS; forbidden fields and prompt-injection fixtures fail closed, and no provider SDK appears outside AI Router.

- [x] **Step 7: Commit**

```bash
git add packages/contracts/src packages/projects/src/progress-contract-draft-artifacts* scripts/register-progress-contract-draft-ai-route* package.json
git commit -m "feat: define progress contract ai draft artifacts"
```

### Task 4B: Persist AI proposals and append-only human revisions

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0016_progress_contract_ai_drafts/migration.sql`
- Create: `packages/database/src/progress-contract-ai-draft-schema.integration.test.ts`
- Modify: `packages/contracts/src/progress-contracts.ts`
- Modify: `packages/contracts/src/progress-contracts.test.ts`
- Create: `packages/documents/src/progress-contract-draft-source-reader.ts`
- Create: `packages/documents/src/progress-contract-draft-source-reader.integration.test.ts`
- Modify: `packages/documents/src/index.ts`
- Create: `packages/projects/src/progress-contract-draft-service.ts`
- Create: `packages/projects/src/progress-contract-draft-service.integration.test.ts`
- Modify: `packages/projects/src/progress-calculation-service.ts`
- Modify: `packages/projects/src/progress-calculation-service.integration.test.ts`
- Modify: `packages/projects/src/index.ts`

**Interfaces:**

- Consumes: public Documents-owned source reader, AI Router interface, exact artifact pins, and existing `ProgressContractService`.
- Produces: idempotent `requestDraft`, `reviseDraft`, `rejectDraft`, and `applyRevision` commands. Applying creates an ordinary Progress Contract in `draft`; it never submits or approves it.

- [x] **Step 1: Write failing migration and lifecycle tests**

```ts
it("stores the AI revision before a human revision and preserves both", async () => {
  const ready = await service.requestDraft(REQUEST);
  const edited = await service.reviseDraft({
    actor: PRODUCT_OWNER,
    requestId: ready.requestId,
    expectedRevision: 1,
    content: HUMAN_EDIT,
    reason: "Clarified the accepted quality gate",
  });
  expect(edited.revision).toBe(2);
  expect(await db.progressContractAiDraftRevision.count({
    where: { requestId: ready.requestId },
  })).toBe(2);
});

it("cannot activate a contract by applying an AI draft", async () => {
  const result = await service.applyRevision(APPLY_REQUEST);
  expect(result.contractState).toBe("draft");
  expect(await db.progressContract.findUnique({ where: { id: result.contractId } }))
    .toMatchObject({ status: "draft" });
});
```

- [x] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec vitest run --project integration packages/database/src/progress-contract-ai-draft-schema.integration.test.ts packages/documents/src/progress-contract-draft-source-reader.integration.test.ts packages/projects/src/progress-contract-draft-service.integration.test.ts`

Expected: FAIL because migration `0016`, the public source reader, and draft service do not exist.

- [x] **Step 3: Add durable request and immutable revision records**

Migration `0016` adds:

- `ProgressContractAiDraftRequest`: Project/document identity, requester, idempotency key and payload hash, state, artifact pins, AI run trace ID, failure code, and applied contract ID.
- `ProgressContractAiDraftRevision`: request ID, monotonically increasing revision, validated content JSON, origin `ai|human`, editor, reason, source references, and creation time.
- uniqueness on `(request_id, revision)` and `(requested_by_id, idempotency_key)`;
- restrictive foreign keys for Project/document/contract history and indexes on Project, state, and created time.
- the ordinary Progress Contract confirmation value `deterministic`, preserving an approved objectively provable condition before its exact source mapping is installed in Task 5.

The request state may transition `pending → ready|failed → applied|rejected`; content changes only through a new revision. No cascade deletes are allowed.

- [x] **Step 4: Expose approved document content through the Documents public interface**

`ProgressContractDraftSourceReader.loadApprovedVersion()` verifies Project ownership, document status/version, source checksum, private access, bounded extraction, and returns quoted untrusted sections plus immutable source references. Projects code must not read Documents tables directly.

- [x] **Step 5: Implement idempotent live AI drafting**

```ts
const route = await this.aiRouter.invoke({
  purpose: "project.progress-contract.draft",
  projectId: input.projectId,
  promptVersion: PROJECT_PROGRESS_CONTRACT_PROMPT_VERSION,
  outputSchemaVersion: PROJECT_PROGRESS_CONTRACT_OUTPUT_SCHEMA_VERSION,
  input: buildBoundedContractDraftInput(source, previousContract),
});
const output = ProgressContractAiDraftOutputSchema.parse(route.output);
return this.storeReadyRevision({ request, routeTraceId: route.traceId, output });
```

Persist the request before the call. On timeout/provider/schema failure, persist only a safe failure code and retain the source request for retry. Never persist or log provider credentials. A repeated idempotency key with a different payload is rejected.

- [x] **Step 6: Implement revision and application authorization**

Only an authorized Project/Product Owner may revise, reject, or apply. Applying a selected human-visible revision maps stable `clientKey` values to server-generated component IDs and calls `ProgressContractService.propose()`. Submission and activation remain the existing separate human commands.

Map `operational_kpi → kpi`, preserve `deterministic → deterministic`, and retain proposed GitHub mappings only in the append-only draft revision until Task 5 creates exact contract/component source bindings. Before Task 5, deterministic components accept no current source kind and remain `awaiting_information`; they must never be silently downgraded to `human_confirmed`.

- [x] **Step 7: Run migration, lifecycle, authorization, retry, and type checks**

Run: `pnpm db:verify && pnpm exec vitest run --project integration packages/database/src/progress-contract-ai-draft-schema.integration.test.ts packages/documents/src/progress-contract-draft-source-reader.integration.test.ts packages/projects/src/progress-contract-draft-service.integration.test.ts && pnpm --filter @evaluation/documents typecheck && pnpm --filter @evaluation/projects typecheck`

Expected: PASS; stale revisions, cross-Project documents, unapproved document versions, duplicate retries, direct activation, and unauthorized edits are rejected.

- [x] **Step 8: Commit**

```bash
git add packages/database packages/documents/src packages/projects/src
git commit -m "feat: persist reviewed progress contract ai drafts"
```

### Task 4C: Add the human review and activation journey

**Files:**

- Create: `apps/api/src/projects/progress-contract-drafts.controller.ts`
- Create: `apps/api/src/projects/progress-contract-drafts.controller.test.ts`
- Modify: `apps/api/src/projects/projects.module.ts`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/progress-contract-draft-panel.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/progress-contract-draft-panel.test.tsx`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/page.tsx`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/daily-work/project-progress-panel.tsx`
- Modify: `apps/web/src/app/api/daily-work/[...path]/route.ts`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`
- Create: `tests/ai-evals/project-progress-contract-draft.eval.test.ts`

**Interfaces:**

- Consumes: Task 4B public service and existing Progress Contract commands.
- Produces: protected create/read/revise/reject/apply endpoints and a source-visible human review drawer/sheet.

- [x] **Step 1: Write failing API, UI, and AI evaluation tests**

```tsx
it("labels the proposal as an AI draft and requires human activation", async () => {
  render(<ProgressContractDraftPanel {...READY_PROPS} />);
  expect(screen.getByText(catalog["progressContract.aiDraftLabel"])).toBeVisible();
  expect(screen.getByRole("button", { name: catalog["progressContract.applyAsDraft"] }))
    .toBeVisible();
  expect(screen.queryByText(catalog["progressContract.active"])).not.toBeInTheDocument();
});
```

AI evaluations include authoritative source coverage, missing-information disclosure, prompt injection, Arabic/English mixed technical text, raw GitHub volume prohibition, rating-field prohibition, and deterministic-versus-human confirmation classification.

- [x] **Step 2: Run tests and verify RED**

Run: `pnpm exec vitest run --project unit apps/api/src/projects/progress-contract-drafts.controller.test.ts 'apps/web/src/app/[locale]/projects/[projectId]/progress-contract-draft-panel.test.tsx' && pnpm test:ai -- tests/ai-evals/project-progress-contract-draft.eval.test.ts`

Expected: FAIL because the endpoints, panel, and evaluation suite do not exist.

- [x] **Step 3: Add protected endpoints**

Use:

- `POST /api/v1/projects/:projectId/progress-contract-drafts`
- `GET /api/v1/projects/:projectId/progress-contract-drafts/:requestId`
- `POST /api/v1/projects/:projectId/progress-contract-drafts/:requestId/revisions`
- `POST /api/v1/projects/:projectId/progress-contract-drafts/:requestId/apply`
- `POST /api/v1/projects/:projectId/progress-contract-drafts/:requestId/reject`

Every endpoint loads actor identity server-side, validates Project/document scope, emits an audit event, and returns public names/source labels rather than internal implementation details.

- [x] **Step 4: Implement the compact review panel**

Show the approved source version, AI-draft label, components, KPI baseline/target/unit/direction, acceptance conditions, required evidence, confirmation mode, ambiguities, and clarification questions. The human can edit every proposed value, give a reason, save a new revision, apply it as a contract draft, submit it for approval, and activate it only through the existing protected approval action.

Mobile uses a bottom sheet; desktop uses a right/left drawer matching direction. Preserve keyboard focus, visible focus, reduced motion, and mixed Arabic/English technical rendering.

- [x] **Step 5: Run API, AI, localization, UI, lint, and type checks**

Run: `pnpm exec vitest run --project unit apps/api/src/projects/progress-contract-drafts.controller.test.ts 'apps/web/src/app/[locale]/projects/[projectId]/progress-contract-draft-panel.test.tsx' packages/localization/src/catalog.test.ts && pnpm test:ai -- tests/ai-evals/project-progress-contract-draft.eval.test.ts && pnpm --filter @evaluation/api typecheck && pnpm --filter @evaluation/web lint && pnpm --filter @evaluation/web typecheck`

Expected: PASS; the UI never represents an AI proposal as active and exposes no rating/progress override field.

- [x] **Step 6: Commit**

```bash
git add apps/api/src/projects apps/web/src/app packages/localization/src/catalogs tests/ai-evals
git commit -m "feat: review and activate document-derived progress contracts"
```

### Task 4D: Seed and run the real Codex employee journey

**Files:**

- Create: `scripts/seed-codex-dogfood.ts`
- Create: `scripts/seed-codex-dogfood.test.ts`
- Modify: `package.json`
- Create: `tests/e2e/codex-dogfood-contract.spec.ts`
- Create: `docs/acceptance/CODEX_DOGFOOD_ACCEPTANCE.md`
- Create: `docs/product/screenshots/phase-2-production/codex-dogfood-contract/`
- Modify: `docs/product/PHASE_2_FEATURE_MAP.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: this repository at an exact commit, approved Project documents, the live `project.progress-contract.draft` AI route, Codex acceptance identity, and existing human approval lifecycle.
- Produces: one deterministic local Project named `Evidence Performance System — Phase 2`, one synthetic contributor `Codex`, its authoritative source snapshot, real Work Items for remaining plan tasks, an AI proposal, and a human-reviewable activation checkpoint.

- [x] **Step 1: Write failing seed safety tests**

```ts
it("is rerunnable without rewriting approved history", async () => {
  await seedCodexDogfood(INPUT);
  const before = await approvedHistory();
  await seedCodexDogfood(INPUT);
  expect(await approvedHistory()).toEqual(before);
});

it("creates no employee score or raw-activity progress rule", async () => {
  await seedCodexDogfood(INPUT);
  expect(await forbiddenPerformanceRows()).toEqual([]);
  expect(await rawActivityRules()).toEqual([]);
});
```

- [x] **Step 2: Run seed tests and verify RED**

Run: `pnpm exec vitest run --project unit scripts/seed-codex-dogfood.test.ts`

Expected: FAIL because the dogfood seed does not exist.

- [x] **Step 3: Implement a deterministic local-only seed**

The seed uses public domain services, never raw destructive deletes. It creates:

- synthetic user `Codex` with employee/contributor access;
- Haitham/Product Owner approval identity already present in local acceptance data;
- Project `Evidence Performance System — Phase 2`;
- optional Workstream `Phase 2 Delivery`;
- Work Items mapped to incomplete tasks in this plan;
- an immutable approved document version containing exact file paths, repository commit SHA, content hashes, and Pull Request reference.

The seed refuses to run outside the explicit local acceptance environment and never reads or copies the OpenAI credential.

- [x] **Step 4: Register and call live GPT-5.5 through AI Router**

Run: `pnpm ai:register:project-progress-contract && pnpm dogfood:seed && pnpm dogfood:draft-contract`

Expected: a validated AI proposal is stored with source references and a redacted model-route trace. The command output contains IDs/status only, never source content or credentials.

- [x] **Step 5: Run the employee-equivalent browser journey**

```ts
test("Codex reviews the real Project contract proposal", async ({ page }) => {
  await loginAs(page, "product_owner");
  await page.goto("/en/projects");
  await page.getByRole("link", { name: "Evidence Performance System — Phase 2" }).click();
  await page.getByRole("button", { name: "Review AI contract draft" }).click();
  await expect(page.getByText("AI draft — human approval required")).toBeVisible();
  await expect(page.getByText("Required quality gate satisfied")).toBeVisible();
});
```

Run: `pnpm test:e2e -- tests/e2e/codex-dogfood-contract.spec.ts`

Expected: PASS in English and Arabic/RTL at desktop and 390px mobile.

- [x] **Step 6: Run bounded critical reviews**

Perform one specification-compliance review and one security/code-quality review covering AI boundary, prompt injection, document authorization, artifact/version trace, migration, audit, append-only revision history, and human activation. Fix only confirmed P0/P1 findings in one bounded cycle, then re-review corrected findings only.

- [x] **Step 7: Capture and document the acceptance evidence**

Record exact commit/document version, redacted AI route/prompt/schema versions, proposed components, human edits, activation state, known missing behavior, and screenshots. Do not include secrets or unredacted private content.

- [x] **Step 8: Commit and push the checkpoint**

```bash
git add scripts package.json tests/e2e docs/acceptance docs/product project-state/PROJECT_STATE.md
git commit -m "test: prove the codex project contract journey"
git push origin codex/phase-2-updates-evidence-readiness
```

- [x] **Step 9: Stop only at the protected human activation gate**

Haitham reviews the live AI proposal and may edit it. GitHub automation begins only after Haitham activates the selected Progress Contract version. AI and Codex cannot approve on the human’s behalf.

---

## Bundle 2 — Contract-Aware GitHub Automation

### Task 5: Add versioned repository bindings and deterministic rule mappings

**Files:**

- Create: `packages/contracts/src/github.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0017_github_contract_sources/migration.sql`
- Create: `packages/database/src/github-contract-source-schema.integration.test.ts`
- Create: `packages/projects/src/github-binding-service.ts`
- Create: `packages/projects/src/github-binding-service.integration.test.ts`
- Create: `packages/updates-evidence/src/github-installation-service.ts`
- Create: `packages/updates-evidence/src/github-installation-service.integration.test.ts`
- Create: `apps/api/src/github/github-installation.controller.ts`
- Create: `apps/api/src/github/github-installation.controller.test.ts`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/github/github-connect-panel.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/github/github-connect-panel.test.tsx`
- Modify: `packages/projects/src/index.ts`

**Interfaces:**

- Consumes: active `ProgressContract`, Project/Workstream ownership, GitHub App installation/repository identifiers.
- Produces: protected GitHub App installation/setup flow, `GitHubBindingDraftSchema`, `GitHubContractRuleSchema`, and `GitHubBindingService.propose/activate/end`.

- [ ] **Step 1: Write failing schema and binding tests**

```ts
it("rejects a mapping to a component outside the selected active contract", async () => {
  await expect(
    service.activate({
      actor: OWNER,
      bindingId: BINDING_ID,
      expectedVersion: 1,
      reason: "Approved repository source",
    }),
  ).rejects.toMatchObject({ code: "GITHUB_BINDING_CONTRACT_MISMATCH" });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm exec vitest run --project integration packages/database/src/github-contract-source-schema.integration.test.ts packages/projects/src/github-binding-service.integration.test.ts`

Expected: FAIL because migration `0017` and `GitHubBindingService` do not exist.

- [ ] **Step 3: Add append-only binding, mapping, event, disposition, identity, and suggestion tables**

The migration creates `GitHubInstallation`, `GitHubIdentityConnection`, `GitHubProjectBinding`, `GitHubContractRule`, `GitHubSourceEvent`, `GitHubEventDisposition`, and `EvidenceSuggestion`. It also adds an explicit system-source actor reference for automatically produced Progress Snapshots while retaining existing human actor lineage. The binding core is:

```prisma
model GitHubProjectBinding {
  id                 String   @id @default(uuid()) @db.Uuid
  projectId          String   @db.Uuid
  workstreamId       String?  @db.Uuid
  contractId         String   @db.Uuid
  installationId     String
  repositoryNodeId   String
  repositoryOwner    String
  repositoryName     String
  state              GitHubBindingState @default(draft)
  version            Int      @default(1)
  effectiveAt        DateTime @db.Timestamptz(6)
  endedAt            DateTime? @db.Timestamptz(6)
  createdById        String   @db.Uuid
  reason             String
  mappings           GitHubContractRule[]
  createdAt          DateTime @default(now()) @db.Timestamptz(6)
}
```

Add unique delivery IDs, repository/source indexes, foreign keys to the exact contract/component, and `RESTRICT` deletion. Store normalized event metadata and payload digest, not secrets or unbounded raw payloads.

- [ ] **Step 4: Implement the minimum-permission GitHub App setup flow**

The Project owner starts installation from the Project GitHub panel, returns through an allowlisted setup URL, and selects only repositories granted to the installation. Persist the installation ID and repository identity; create short-lived installation tokens on demand from the private key and never persist or return them to the browser.

- [ ] **Step 5: Implement versioned activation rules**

Only the authorized Project/Workstream owner or approved administrator can propose; a separate authorized approver activates. A binding must reference an active contract version and deterministic allowlisted rule kind:

```ts
export const GitHubContractRuleKindSchema = z.enum([
  "pull_request_merged_with_required_checks",
  "workflow_completed_successfully",
  "release_published",
  "deployment_succeeded",
]);
```

- [ ] **Step 6: Verify migrations from empty and previous snapshot**

Run: `pnpm db:generate && pnpm db:verify && pnpm exec vitest run --project integration packages/database/src/github-contract-source-schema.integration.test.ts packages/projects/src/github-binding-service.integration.test.ts packages/updates-evidence/src/github-installation-service.integration.test.ts && pnpm exec vitest run --project unit apps/api/src/github/github-installation.controller.test.ts 'apps/web/src/app/[locale]/projects/[projectId]/github/github-connect-panel.test.tsx'`

Expected: PASS; no existing migration changes and no cascade deletion of history.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts packages/database packages/projects packages/updates-evidence/src apps/api/src/github apps/web/src/app
git commit -m "feat: add governed github project bindings"
```

### Task 6: Ingest verified GitHub webhooks into a durable inbox

**Files:**

- Create: `packages/updates-evidence/src/github-event-service.ts`
- Create: `packages/updates-evidence/src/github-event-service.integration.test.ts`
- Modify: `packages/updates-evidence/src/index.ts`
- Create: `apps/api/src/github/github-webhook.controller.ts`
- Create: `apps/api/src/github/github-webhook.controller.test.ts`
- Create: `apps/api/src/github/github.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `.env.example`

**Interfaces:**

- Consumes: raw request bytes, `X-Hub-Signature-256`, `X-GitHub-Delivery`, `X-GitHub-Event`.
- Produces: `GitHubEventService.ingestVerified({ deliveryId, eventName, payloadDigest, normalized })` and `POST /api/v1/integrations/github/webhook`.

- [ ] **Step 1: Write failing signature, size, replay, and allowlist tests**

```ts
it.each([
  ["missing signature", {}, 401],
  ["invalid signature", INVALID_HEADERS, 401],
  ["oversized payload", VALID_HEADERS, 413],
])("rejects %s", async (_name, headers, status) => {
  await expect(requestWebhook({ headers })).rejects.toMatchObject({ status });
});

it("returns the original durable event for a replayed delivery id", async () => {
  expect((await ingest(DELIVERY)).id).toBe((await ingest(DELIVERY)).id);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run --project unit apps/api/src/github/github-webhook.controller.test.ts && pnpm exec vitest run --project integration packages/updates-evidence/src/github-event-service.integration.test.ts`

Expected: FAIL because the webhook module and durable inbox do not exist.

- [ ] **Step 3: Verify the HMAC before parsing untrusted JSON**

```ts
const expected = createHmac("sha256", secret).update(rawBody).digest();
const supplied = decodeSignature(signature);
if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
  throw new AppError("GITHUB_SIGNATURE_INVALID", "errors.github.signatureInvalid", 401);
}
```

Do not print the secret, signature, installation token, raw payload, or user content. Enforce a bounded body size and explicit event allowlist.

- [ ] **Step 4: Normalize and persist the immutable source event idempotently**

Normalize only required repository, branch, PR, check, workflow, release, deployment, actor-source ID, source URL, and occurrence time fields. Persist `pending` disposition and payload SHA-256 in one transaction.

- [ ] **Step 5: Run security and integration tests**

Run: `pnpm exec vitest run --project unit apps/api/src/github/github-webhook.controller.test.ts && pnpm exec vitest run --project integration packages/updates-evidence/src/github-event-service.integration.test.ts && pnpm scan:secrets`

Expected: PASS; duplicates create no second event and malformed/unbound events cannot reach progress evaluation.

- [ ] **Step 6: Commit**

```bash
git add packages/updates-evidence/src apps/api/src/github apps/api/src/app.module.ts apps/api/src/main.ts .env.example
git commit -m "feat: ingest verified github source events"
```

### Task 7: Apply deterministic contract rules and create reviewable ambiguity

**Files:**

- Create: `packages/projects/src/progress-source-assembler.ts`
- Create: `packages/projects/src/progress-source-assembler.integration.test.ts`
- Create: `packages/projects/src/github-progress-service.ts`
- Create: `packages/projects/src/github-progress-service.integration.test.ts`
- Modify: `packages/projects/src/progress-calculation-service.ts`
- Modify: `packages/contracts/src/progress-contracts.ts`
- Create: `apps/worker/src/github/github-event.processor.ts`
- Create: `apps/worker/src/github/github-event.processor.integration.test.ts`
- Create: `apps/worker/src/github/github-app-client.ts`
- Create: `apps/worker/src/github/github-app-client.test.ts`
- Create: `apps/worker/src/github/github-reconciliation.processor.ts`
- Create: `apps/worker/src/github/github-reconciliation.processor.integration.test.ts`
- Modify: `apps/worker/src/app.module.ts`

**Interfaces:**

- Consumes: one verified durable GitHub event, one active binding/rule, and latest accepted component sources.
- Produces: `GitHubProgressService.evaluate(eventId)`, source-explained `ProgressSnapshot`, or immutable `review_required/no_match/ignored` disposition.

- [ ] **Step 1: Write failing deterministic and anti-volume tests**

```ts
it("applies the mapped milestone only after merge and required checks", async () => {
  const result = await service.evaluate(MERGED_AND_GREEN_EVENT_ID);
  expect(result).toMatchObject({ state: "progress_applied", percent: 50 });
});

it.each(["commit_count", "changed_files", "lines_changed", "pull_request_size"])(
  "rejects %s as a progress rule",
  (field) => expect(() => GitHubContractRuleSchema.parse(ruleUsing(field))).toThrow(),
);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run --project integration packages/projects/src/github-progress-service.integration.test.ts apps/worker/src/github/github-event.processor.integration.test.ts`

Expected: FAIL because no evaluator or processor exists.

- [ ] **Step 3: Extend progress sources without exposing direct percentages**

Add `github_contract_condition` to `ProgressSourceKindSchema`. The public input carries `componentId`, source event/version, `satisfied`, and observation time; it contains no `percent` field.

- [ ] **Step 4: Assemble unchanged component facts safely**

`ProgressSourceAssembler.latestForContract(contractId, asOf)` loads the latest source per component from the latest accepted snapshot, replaces only the mapped component with the verified GitHub condition, and returns all component facts to `ProgressCalculationService`.

- [ ] **Step 5: Add a dedicated system-source path**

```ts
await githubProgress.applyVerifiedCondition({
  bindingId,
  eventId,
  componentId,
  satisfied: true,
  observedAt,
  correlationId,
});
```

The service revalidates the active binding, contract version, rule match, and source event inside a Serializable transaction. It records a system audit actor and never accepts an arbitrary percentage.

- [ ] **Step 6: Implement durable worker retry**

The worker claims `pending` events with row locking, processes each idempotently, records bounded retry metadata, and periodically reclaims expired leases. `review_required` is terminal until an authorized human disposition command.

- [ ] **Step 7: Reconcile missed events with short-lived installation tokens**

`GitHubAppClient` creates a short-lived installation token from `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`, fetches only the configured repositories/branches/checks/releases/deployments since the binding cursor, normalizes them through the same durable inbox, and advances the cursor only after persistence succeeds. Tokens and response bodies are never logged or stored.

- [ ] **Step 8: Run migration, integration, concurrency, and boundary tests**

Run: `pnpm db:verify && pnpm exec vitest run --project integration packages/projects/src/progress-source-assembler.integration.test.ts packages/projects/src/github-progress-service.integration.test.ts apps/worker/src/github/github-event.processor.integration.test.ts apps/worker/src/github/github-reconciliation.processor.integration.test.ts && pnpm exec vitest run --project unit apps/worker/src/github/github-app-client.test.ts && pnpm scan:performance-inputs`

Expected: PASS; simultaneous duplicate processing creates one disposition and at most one source-equivalent snapshot.

- [ ] **Step 9: Commit**

```bash
git add packages/contracts/src/progress-contracts.ts packages/projects/src apps/worker/src/github apps/worker/src/app.module.ts
git commit -m "feat: apply contract-aware github progress"
```

### Task 8: Separate Project activity from employee contribution evidence

**Files:**

- Create: `packages/updates-evidence/src/github-suggestion-service.ts`
- Create: `packages/updates-evidence/src/github-suggestion-service.integration.test.ts`
- Modify: `packages/updates-evidence/src/evidence-service.ts`
- Modify: `packages/updates-evidence/src/activity-reader.ts`
- Modify: `apps/api/src/updates-evidence/evidence.controller.ts`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/github/github-activity-panel.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/github/github-activity-panel.test.tsx`
- Create: `apps/web/src/app/[locale]/evidence/github-suggestion-sheet.tsx`
- Create: `apps/web/src/app/[locale]/evidence/github-suggestion-sheet.test.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`

**Interfaces:**

- Consumes: immutable GitHub event/disposition and verified employee GitHub identity mapping.
- Produces: Project source activity, `EvidenceSuggestion`, employee edit/confirm/dismiss commands, and confirmed `EvidenceRecord`.

- [ ] **Step 1: Write failing separation tests**

```ts
it("updates Project activity without creating employee contribution evidence", async () => {
  await processor.process(EVENT_ID);
  expect(await db.progressSnapshot.count()).toBe(1);
  expect(await db.acceptedEvidenceEvent.count()).toBe(0);
});

it("creates contribution evidence only after employee confirmation", async () => {
  const draft = await suggestions.review({ actor: EMPLOYEE, suggestionId: SUGGESTION_ID });
  expect(draft.state).toBe("pending_employee");
  await suggestions.confirm({
    actor: EMPLOYEE,
    suggestionId: SUGGESTION_ID,
    claim: "Implemented X",
  });
  expect(await db.acceptedEvidenceEvent.count()).toBe(1);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run --project integration packages/updates-evidence/src/github-suggestion-service.integration.test.ts`

Expected: FAIL because contribution suggestions do not exist.

- [ ] **Step 3: Implement review, edit, confirm, and dismiss**

Repository authorship may identify a candidate recipient but cannot assert full/sole contribution. The employee must edit the supported claim, contribution context, Work Item link, KPI/criterion link, and verification state before confirmation.

- [ ] **Step 4: Implement Project activity and mobile review sheets**

Automatic Project events show source, mapped contract condition, progress impact, and disposition. Opening a contribution suggestion uses a visible sheet/panel; it never inserts a form below a list.

- [ ] **Step 5: Run focused service and UI tests**

Run: `pnpm exec vitest run --project integration packages/updates-evidence/src/github-suggestion-service.integration.test.ts && pnpm exec vitest run --project unit 'apps/web/src/app/[locale]/projects/[projectId]/github/*.test.tsx' 'apps/web/src/app/[locale]/evidence/github-suggestion-sheet.test.tsx'`

Expected: PASS; no unconfirmed suggestion appears in employee facts.

- [ ] **Step 6: Commit**

```bash
git add packages/updates-evidence/src apps/api/src/updates-evidence apps/web/src/app packages/localization/src/catalogs
git commit -m "feat: review github contribution suggestions"
```

### Task 9: Bundle 2 runnable acceptance checkpoint

**Files:**

- Modify: `scripts/seed-codex-dogfood.ts`
- Create: `tests/e2e/github-project-progress.spec.ts`
- Create: `tests/e2e/github-contribution-suggestion.spec.ts`
- Create: `tests/e2e/codex-dogfood-github-live.spec.ts`
- Create: `docs/product/screenshots/phase-2-production/github-automation/`
- Modify: `docs/acceptance/CODEX_DOGFOOD_ACCEPTANCE.md`
- Modify: `docs/product/PHASE_2_FEATURE_MAP.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: Tasks 5–8.
- Produces: deterministic webhook-to-progress demo, separate employee evidence demo, a real repository acceptance run when the GitHub App is installed, screenshots, reviews, and pushed checkpoint.

- [ ] **Step 1: Bind deterministic fixtures to the active Codex dogfood contract**

The mapped fixture proves one condition from the active human-approved dogfood contract. The ambiguous fixture produces `review_required` and leaves official progress unchanged. No second synthetic Project or contract is created.

- [ ] **Step 2: Run GitHub security, integration, and browser flows**

Run: `pnpm test:integration -- packages/projects/src/github packages/updates-evidence/src/github apps/api/src/github apps/worker/src/github && pnpm test:e2e -- tests/e2e/github-project-progress.spec.ts tests/e2e/github-contribution-suggestion.spec.ts`

Expected: PASS.

- [ ] **Step 3: Run one specification and one security/code-quality review**

Review only: webhook authentication, minimum permissions, idempotency/reconciliation, contract binding, system audit, source immutability, contribution confirmation, and anti-performance boundaries. Fix confirmed P0/P1 findings once and re-run only affected tests/review findings.

- [ ] **Step 4: Capture desktop/mobile evidence**

Capture automatic Project activity/progress, ambiguous review state, employee suggestion sheet, edited claim, confirmed evidence, and Timeline.

- [ ] **Step 5: Commit and push the deterministic checkpoint**

```bash
git add scripts/seed-codex-dogfood.ts tests/e2e docs/acceptance docs/product project-state/PROJECT_STATE.md
git commit -m "test: verify contract-aware github automation"
git push origin codex/phase-2-updates-evidence-readiness
```

- [ ] **Step 6: Stop only if GitHub App installation needs direct human action**

If the repository does not yet have the governed GitHub App installed, present the exact callback URL, webhook URL, required minimum permissions, and generated public setup metadata. Do not simulate connection, request a personal access token, expose secrets, or proceed with a fake live result.

- [ ] **Step 7: Reconcile the real repository and Pull Request**

After installation, bind `Haithamhaj/evidence-performance-evaluation-system`, the approved Phase 2 base/head branches, Pull Request #5 or its approved successor, and allowlisted required checks. Run reconciliation, then confirm:

- a verified real event appears once in Project activity;
- only a pre-approved deterministic rule can create a new Project snapshot;
- an ambiguous real event enters Project review without changing official progress;
- Codex receives a personal contribution suggestion only after verified identity mapping;
- the suggestion stays outside employee facts until Codex confirms it.

Run: `pnpm test:e2e -- tests/e2e/codex-dogfood-github-live.spec.ts`

Expected: PASS against the installed GitHub App and real repository. The test must fail or skip with an explicit external-gate code when installation is absent; it must never silently use fixtures.

- [ ] **Step 8: Complete one real Codex Update**

As Codex, open My Work, select the dogfood Project, describe one actual implemented bundle through live GPT-5.5, review/edit the structured draft, attach or confirm one source, and confirm the Update. Verify comparison with the previous accepted state, the Project result card, evidence state, next action, documentation gaps, and append-only Timeline.

- [ ] **Step 9: Finalize the dogfood acceptance record and push**

Update `docs/acceptance/CODEX_DOGFOOD_ACCEPTANCE.md` with redacted live event identities/URLs, exact contract version, before/after Project snapshots, Codex’s confirmed Update, screenshots, and all missing/partial behavior. Commit and push the record.

- [ ] **Step 10: Stop at the Product Owner gate**

The Product Owner verifies that automation tracks the Project, the employee journey matches normal daily use, and personal contribution still requires confirmation. Do not merge Phase 2 at this gate.

---

## Bundle 3 — Unified Manual and Voice Sources

### Task 10: Accept all manual sources through the same Update lifecycle

**Files:**

- Modify: `packages/contracts/src/updates-evidence.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0018_update_source_attachments/migration.sql`
- Modify: `packages/updates-evidence/src/update-service.ts`
- Modify: `packages/updates-evidence/src/scope-readers.ts`
- Create: `packages/updates-evidence/src/update-source-loader.ts`
- Create: `packages/updates-evidence/src/update-source-loader.integration.test.ts`
- Modify: `apps/api/src/updates-evidence/updates.controller.ts`
- Modify: `apps/web/src/app/[locale]/my-work/update-composer.tsx`
- Modify: `apps/web/src/app/[locale]/evidence/evidence-review-sheet.tsx`
- Test: `packages/updates-evidence/src/update-service.integration.test.ts`
- Test: `apps/web/src/app/[locale]/my-work/update-composer.test.tsx`

**Interfaces:**

- Consumes: private uploaded sources and bounded pasted text/code/CLI/URL/manual GitHub snapshots.
- Produces: `StartUpdateInputSchema` with one or more typed source references and a single draft-first Update session.

- [ ] **Step 1: Write failing multimodal-source tests**

```ts
it.each(["text", "image", "file", "pasted_code", "cli_snapshot", "url", "github_snapshot"])(
  "starts one governed Update from %s",
  async (kind) =>
    expect(await service.start(commandWith(kind))).toMatchObject({ sessionId: expect.any(String) }),
);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm exec vitest run --project integration packages/updates-evidence/src/update-source-loader.integration.test.ts packages/updates-evidence/src/update-service.integration.test.ts`

Expected: FAIL because `UpdateSource` currently stores only raw text/voice and has no attachment relation.

- [ ] **Step 3: Add immutable source attachments**

Migration `0018` adds `UpdateSourceAttachment` with source kind, uploaded source or bounded text/URL, checksum, position, and source version. Enforce exactly one storage representation per attachment and `RESTRICT` history.

- [ ] **Step 4: Load safe AI input**

Use the existing private upload and safe extraction services. Enforce type, size, malware, and archive limits before extraction; strip instructions from source authority and wrap all extracted content as untrusted quoted input.

- [ ] **Step 5: Wire the first-screen source controls**

An employee can combine text, image/file, pasted code, CLI, URL, or manual GitHub snapshot, then sees one draft, conditional clarification, one evidence review, and one confirmation flow.

- [ ] **Step 6: Run migration, upload, AI, and UI tests**

Run: `pnpm db:verify && pnpm exec vitest run --project integration packages/updates-evidence/src/update-source-loader.integration.test.ts packages/documents/src/upload-service.integration.test.ts && pnpm exec vitest run --project unit 'apps/web/src/app/[locale]/my-work/update-composer.test.tsx'`

Expected: PASS; unsafe files never reach AI, and source references remain private and authorized.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts packages/database packages/updates-evidence apps/api/src/updates-evidence apps/web/src/app
git commit -m "feat: unify manual update sources"
```

### Task 11: Add voice transcript correction as a connector to Updates & Evidence

**Files:**

- Modify: `packages/contracts/src/updates-evidence.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0019_voice_update_sources/migration.sql`
- Create: `packages/updates-evidence/src/voice-update-service.ts`
- Create: `packages/updates-evidence/src/voice-update-service.integration.test.ts`
- Create: `packages/updates-evidence/src/voice-transcriber.ts`
- Create: `packages/updates-evidence/src/voice-transcriber.test.ts`
- Modify: `packages/updates-evidence/src/index.ts`
- Modify: `apps/api/src/updates-evidence/updates.controller.ts`
- Modify: `apps/api/src/updates-evidence/updates-evidence.module.ts`
- Create: `tests/ai-evals/voice-transcription.eval.test.ts`

**Interfaces:**

- Consumes: safe private audio upload and AI Router route `update.transcribe`.
- Produces: `VoiceUpdateService.start`, `reviseTranscript`, `confirmTranscript`, then `UpdateService.start` with the confirmed transcript and audio source reference.

- [ ] **Step 1: Write failing dual-gate and dialect tests**

```ts
it("requires transcript confirmation before Update structuring", async () => {
  await expect(service.structure({ voiceSessionId: SESSION_ID })).rejects.toMatchObject({
    code: "VOICE_TRANSCRIPT_CONFIRMATION_REQUIRED",
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm exec vitest run --project integration packages/updates-evidence/src/voice-update-service.integration.test.ts`

Expected: FAIL because no voice service or transcript persistence exists.

- [ ] **Step 3: Add append-only voice and transcript revisions**

Store private audio source ID, raw transcript, employee-corrected transcript revisions, language/dialect metadata, AI run reference, transcript confirmation, and retention metadata. Transcript confirmation and final Update confirmation are distinct.

- [ ] **Step 4: Route transcription only through AI Router**

Register versioned route/output schema `update.transcribe`; validate timeout, source references, and transcript output. Never expose or log the credential or audio content.

- [ ] **Step 5: Reuse the existing Update lifecycle after transcript confirmation**

```ts
return this.updateService.start({
  actor,
  correlationId,
  input: {
    idempotencyKey,
    projectId,
    workstreamId,
    workItemId,
    sources: [{ kind: "voice_transcript", voiceSessionId }],
    executionMode: "ai_assisted",
  },
});
```

- [ ] **Step 6: Run voice integration and AI evaluation tests**

Run: `pnpm test:ai -- tests/ai-evals/voice-transcription.eval.test.ts && pnpm exec vitest run --project integration packages/updates-evidence/src/voice-update-service.integration.test.ts`

Expected: PASS for Fusha, Gulf, Levantine, and mixed Arabic/English fixtures; final Update still has no rating fields.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts packages/database packages/updates-evidence apps/api/src/updates-evidence tests/ai-evals
git commit -m "feat: add confirmed voice update connector"
```

### Task 12: Add the voice and combined-source user journey

**Files:**

- Create: `apps/web/src/app/[locale]/my-work/voice-update-panel.tsx`
- Create: `apps/web/src/app/[locale]/my-work/voice-update-panel.test.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/update-composer-view.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/update-composer.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**

- Consumes: voice endpoints and unified `StartUpdateInputSchema`.
- Produces: record/upload, transcript review/edit/confirm, draft-first Update, evidence, and final confirmation in one sheet/drawer journey.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("keeps transcript confirmation separate from final Update confirmation", async () => {
  render(<VoiceUpdatePanel {...props} />);
  expect(screen.getByRole("button", { name: catalog["voice.confirmTranscript"] })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: catalog["updates.confirm"] }),
  ).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run: `pnpm exec vitest run --project unit 'apps/web/src/app/[locale]/my-work/voice-update-panel.test.tsx'`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement accessible recording/upload and transcript correction**

Support explicit start/stop, upload fallback, elapsed state, retry, transcript direction `auto`, keyboard operation, visible focus, and reduced motion. Do not claim that browser recording is active before permission succeeds.

- [ ] **Step 4: Join voice and other sources into the same draft-first flow**

After transcript confirmation, return to the same Update draft. The employee may add a screenshot, file, code, CLI, URL, or note before final confirmation.

- [ ] **Step 5: Run UI and localization checks**

Run: `pnpm exec vitest run --project unit 'apps/web/src/app/[locale]/my-work/voice-update-panel.test.tsx' 'apps/web/src/app/[locale]/my-work/update-composer.test.tsx' packages/localization/src/catalog.test.ts && pnpm --filter @evaluation/web typecheck`

Expected: PASS in desktop/mobile and LTR/RTL.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app packages/localization/src/catalogs
git commit -m "feat: add unified voice update experience"
```

### Task 13: Bundle 3 runnable acceptance checkpoint

**Files:**

- Create: `tests/e2e/manual-and-voice-update.spec.ts`
- Create: `docs/product/screenshots/phase-2-production/manual-voice-sources/`
- Modify: `docs/product/PHASE_2_FEATURE_MAP.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: Tasks 10–12.
- Produces: manual no-GitHub fallback demo, voice demo, screenshots, critical review, and pushed checkpoint.

- [ ] **Step 1: Run the manual fallback browser flow**

Use a Project with no GitHub binding. Submit a screenshot plus text, confirm evidence, confirm Update, and verify the result card/Timeline.

- [ ] **Step 2: Run the deterministic voice browser flow**

Upload the approved fixture, correct transcript text, confirm transcript, complete Update draft, attach evidence, and confirm final Update.

- [ ] **Step 3: Run related checks**

Run: `pnpm test:integration -- packages/updates-evidence/src packages/documents/src apps/api/src/updates-evidence && pnpm test:ai -- tests/ai-evals/voice-transcription.eval.test.ts && pnpm test:e2e -- tests/e2e/manual-and-voice-update.spec.ts`

Expected: PASS.

- [ ] **Step 4: Review privacy, upload, AI, and immutability boundaries**

Perform one specification review and one security/code-quality review; fix only confirmed P0/P1 findings in one bounded cycle.

- [ ] **Step 5: Capture desktop/mobile screenshots and push**

```bash
git add tests/e2e docs/product project-state/PROJECT_STATE.md
git commit -m "test: verify manual and voice update sources"
git push origin codex/phase-2-updates-evidence-readiness
```

- [ ] **Step 6: Stop at the Product Owner gate**

The Product Owner verifies daily usability, source discoverability, transcript correction friction, evidence confirmation, and result clarity.

---

## Bundle 4 — Neutral Evaluation Fact View Preparation

### Required execution ordering with the unaffected Phase 2 plan

This amendment replaces the old plan's Slice 2–4 behavior. After Bundle 3, execute Task 5 (Check-ins and Monthly Readiness) and Task 6 (Manager Operational View) from `docs/superpowers/plans/2026-07-18-phase-2-daily-work-progress-plan.md`; those two tasks remain active and unchanged. Complete their runnable Product Owner gates before Bundle 4 because their accepted operational/readiness facts are inputs to the neutral Fact View.

### Task 14: Compose source-supported employee facts without ratings

**Files:**

- Create: `packages/contracts/src/evaluation-facts.ts`
- Create: `packages/contracts/src/evaluation-facts.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/projects/src/evaluation-fact-reader.ts`
- Create: `packages/projects/src/evaluation-fact-reader.integration.test.ts`
- Create: `packages/updates-evidence/src/evaluation-fact-reader.ts`
- Create: `packages/updates-evidence/src/evaluation-fact-reader.integration.test.ts`
- Modify: `packages/work-items/src/query-service.ts`
- Create: `apps/api/src/evaluation-preparation/fact-view-query.service.ts`
- Create: `apps/api/src/evaluation-preparation/evaluation-preparation.controller.ts`
- Create: `apps/api/src/evaluation-preparation/evaluation-preparation.e2e.integration.test.ts`
- Create: `apps/api/src/evaluation-preparation/evaluation-preparation.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: responsibility windows, Project/Workstream history, accepted Updates/evidence, verification/attribution state, operational KPI/milestone snapshots, and Work Item context through public readers.
- Produces: `EvaluationFactViewSchema` and `GET /api/v1/evaluation-preparation/me?periodStart=&periodEnd=`.

- [ ] **Step 1: Write failing neutrality and responsibility-window tests**

```ts
it("separates source-supported facts from employee interpretation", () => {
  const view = EvaluationFactViewSchema.parse(FIXTURE);
  expect(view.sourceSupportedFacts).not.toContainEqual(
    expect.objectContaining({ kind: "interpretation" }),
  );
  expect(view.employeeInterpretations).toHaveLength(1);
});

it.each([
  "rating",
  "suggestedRating",
  "predictedRating",
  "rank",
  "productivityScore",
  "readinessPercent",
])("forbids %s", (key) =>
  expect(JSON.stringify(EvaluationFactViewSchema.parse(FIXTURE))).not.toContain(`"${key}"`),
);
```

- [ ] **Step 2: Run contract tests and verify RED**

Run: `pnpm exec vitest run --project unit packages/contracts/src/evaluation-facts.test.ts`

Expected: FAIL because the neutral schema does not exist.

- [ ] **Step 3: Define the strict neutral schema**

```ts
export const EvaluationFactViewSchema = z
  .object({
    employeeId: UuidSchema,
    period: z.object({ startsAt: UtcInstantSchema, endsAt: UtcInstantSchema }).strict(),
    responsibilityWindows: z.array(ResponsibilityFactSchema),
    sourceSupportedFacts: z.array(SourceSupportedFactSchema),
    employeeInterpretations: z.array(EmployeeInterpretationSchema),
    unresolved: z.array(UnresolvedFactSchema),
  })
  .strict();
```

No rating-related or manager-readiness fields exist in this schema.

- [ ] **Step 4: Add public domain readers**

Projects returns responsibility-window and operational contract facts; Updates & Evidence returns confirmed source facts, verification, attribution, and unresolved states; Work Items returns context only. Each reader enforces employee/authorized manager scope and uses historical effective periods.

- [ ] **Step 5: Compose only through public interfaces**

`FactViewQueryService` joins facts by stable source ID and time window, labels source-supported facts versus employee interpretation, and does not calculate employee performance.

- [ ] **Step 6: Run unit, integration, privacy, and performance-input scans**

Run: `pnpm exec vitest run --project unit packages/contracts/src/evaluation-facts.test.ts && pnpm exec vitest run --project integration packages/projects/src/evaluation-fact-reader.integration.test.ts packages/updates-evidence/src/evaluation-fact-reader.integration.test.ts apps/api/src/evaluation-preparation/evaluation-preparation.e2e.integration.test.ts && pnpm scan:performance-inputs`

Expected: PASS; ended responsibility windows are included only for their effective period and unconfirmed suggestions are excluded.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts packages/projects/src packages/updates-evidence/src packages/work-items/src apps/api/src/evaluation-preparation apps/api/src/app.module.ts
git commit -m "feat: compose neutral evaluation facts"
```

### Task 15: Build the read-only Fact View and final Phase 2 checkpoint

**Files:**

- Create: `apps/web/src/app/[locale]/evaluation-preparation/page.tsx`
- Create: `apps/web/src/app/[locale]/evaluation-preparation/fact-view.tsx`
- Create: `apps/web/src/app/[locale]/evaluation-preparation/fact-view.test.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`
- Create: `tests/e2e/evaluation-fact-view-preparation.spec.ts`
- Create: `docs/product/screenshots/phase-2-production/evaluation-fact-view/`
- Modify: `docs/product/PHASE_2_FEATURE_MAP.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: `EvaluationFactViewSchema` plus completed Check-ins/Monthly Readiness and Manager Operational View checkpoints from the unaffected plan.
- Produces: read-only, source-labelled Phase 2 Fact View and final Phase 2 verification evidence; no evaluation form.

- [ ] **Step 1: Write failing UI boundary tests**

```tsx
it("shows facts before interpretation and exposes no rating control", () => {
  render(<FactView catalog={catalog} view={FIXTURE} />);
  expect(screen.getByRole("heading", { name: catalog["facts.sources"] })).toBeVisible();
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.queryByText(/rating|التقييم/u)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run: `pnpm exec vitest run --project unit 'apps/web/src/app/[locale]/evaluation-preparation/fact-view.test.tsx'`

Expected: FAIL because the Phase 2 Fact View does not exist.

- [ ] **Step 3: Implement the compact read-only view**

Show responsibility period, Project/Workstream, accepted result/deliverable, source, evidence verification, contribution context, KPI/milestone history, unresolved attribution, and employee interpretation in separate labelled sections. Do not show ratings, rankings, readiness percentages, productivity scores, or manager assessment controls.

- [ ] **Step 4: Run browser acceptance in employee and manager scope**

Run: `pnpm test:e2e -- tests/e2e/evaluation-fact-view-preparation.spec.ts`

Expected: PASS; an employee sees their own authorized facts, an authorized manager sees the same neutral source boundary, and unrelated employees are denied.

- [ ] **Step 5: Run the major integration checkpoint**

Run: `pnpm db:verify && pnpm scan:secrets && pnpm scan:performance-inputs && pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm test:integration && pnpm test:ai && pnpm build`

Expected: PASS at the repository-pinned Node.js 24.18.0 and pnpm 11.13.0.

- [ ] **Step 6: Capture screenshots and align durable documentation**

Capture English and existing Arabic/RTL desktop/mobile Fact View. Update feature map, implementation plan, task statuses, and project state with executed facts only; keep Phase 3 evaluation tasks pending.

- [ ] **Step 7: Run one bounded final critical review**

Review only the Phase 2 protected boundaries affected by these bundles. Fix confirmed P0/P1 findings once and re-run affected checks; record P2/P3 items without delaying the checkpoint.

- [ ] **Step 8: Commit and push**

```bash
git add apps/web/src/app packages/localization/src/catalogs tests/e2e docs/product docs/IMPLEMENTATION_PLAN.md TASKS.md project-state/PROJECT_STATE.md
git commit -m "feat: prepare the neutral evaluation fact view"
git push origin codex/phase-2-updates-evidence-readiness
```

- [ ] **Step 9: Stop at the protected Product Owner gate**

Do not merge Phase 2 or begin the complete Phase 3 self-assessment/manager-assessment workflow until the Product Owner reviews the running daily journey, GitHub automation, manual/voice fallback, Fact View, complexity impact, and protected-boundary evidence.

---

## Plan self-review checklist

- [ ] The real Codex employee Project uses an immutable approved source version and does not create a second architecture or performance record.
- [ ] Live AI drafts the Progress Contract through AI Router with versioned artifacts, source references, strict output validation, and no activation authority.
- [ ] Human revision, application, submission, and activation remain explicit, audited steps; AI and Codex cannot cross the protected approval gate.
- [ ] Every Update requires Project and permits null Workstream/Work Item.
- [ ] The first AI response contains a readable draft; clarification is conditional and one question at a time.
- [ ] Raw input, AI drafts, employee edits, evidence confirmation, Update confirmation, and Timeline events remain distinct and append-only.
- [ ] GitHub automation proves only mapped contract conditions and never uses volume.
- [ ] The live GitHub acceptance uses a GitHub App with minimum permissions and cannot silently fall back to fixtures.
- [ ] Project progress and employee contribution evidence are separate lifecycles.
- [ ] Unconfirmed GitHub suggestions do not enter employee facts.
- [ ] Manual text, image, file, code, CLI, URL, snapshot, and voice use the same Update lifecycle.
- [ ] Transcript confirmation and final Update confirmation are separate.
- [ ] Fact View distinguishes source-supported facts from interpretation and contains no rating fields.
- [ ] Phase 3 evaluation workflow remains outside this plan.
- [ ] English-only pilot permission and existing Arabic/RTL foundations are preserved.
- [ ] Each bundle has focused tests, related integration tests, runnable demo, screenshots, durable commit/push, and a Product Owner stop gate.

## Execution handoff

The standing project execution policy selects inline `superpowers:executing-plans` for routine bounded work. Use independent bounded reviewers only for migrations, GitHub security, AI Router/schema changes, privacy, audit, and historical immutability. Do not dispatch a reviewer loop for ordinary UI/copy work.
