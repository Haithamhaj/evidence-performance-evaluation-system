# Slice 3 — Context Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for bounded tasks. Use one specification/AI-boundary reviewer and one security/code-quality reviewer for prompt, privacy, and migration changes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn private connected context into useful, explainable Project suggestions and complete employee-reviewable Task drafts without automatic official actions.

**Architecture:** Add one bounded Context Intelligence package. Deterministic anchors establish safe automatic links; AI through the existing Router summarizes and proposes. Every persisted AI output is versioned, validated, source-referenced, traced, and correctable. Human confirmation is the only path to an official Task.

**Tech Stack:** Existing AI Router, Zod structured outputs, Prisma/PostgreSQL, NestJS, React, Vitest AI evaluations, Playwright.

## Global Constraints

- Model confidence alone never authorizes an automatic Project link.
- Automatic linking requires a deterministic mapping or at least two non-conflicting independent anchors.
- AI-generated text is a draft, not a source fact.
- Uploaded or connected content is untrusted AI input and cannot override system instructions.
- No AI schema may include ratings, predicted ratings, rank, productivity score, or employee judgment.
- The employee can inspect sources, edit the draft, correct the Project, and reject the suggestion.

---

### Task 1: Define analyses, suggestions, and Task drafts

**Files:**

- Create: `packages/context-intelligence/package.json`
- Create: `packages/context-intelligence/tsconfig.json`
- Create: `packages/context-intelligence/src/index.ts`
- Create: `packages/contracts/src/context-intelligence.ts`
- Create: `packages/contracts/src/context-intelligence.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0019_context_intelligence/migration.sql`
- Create: `packages/database/src/context-intelligence-schema.integration.test.ts`
- Modify: `pnpm-workspace.yaml`

**Output schema:**

```ts
const TaskDraftSchema = z.object({
  title: z.string().min(1).max(240),
  description: z.string().max(8000),
  projectId: z.string().uuid().nullable(),
  workstreamId: z.string().uuid().nullable(),
  proposedAssigneeId: z.string().uuid().nullable(),
  dueAt: z.iso.datetime().nullable(),
  acceptanceConditions: z.array(z.string().min(1)).max(12),
  sourceReferences: z.array(SourceReferenceSchema).min(1),
  uncertainties: z.array(z.string()),
});
```

- [ ] Add failing tests for schema version, prompt version, route trace, source references, employee correction, review status, and superseding revisions.
- [ ] Add `ContextAnalysis`, `ProjectLinkSuggestion`, `TaskDraft`, and `SourceLinkCorrection` with append-only revisions where historical AI output matters.
- [ ] Ensure no rating-like fields exist in schema or contracts.
- [ ] Run focused contract/schema tests, `pnpm scan:performance-inputs`, and `pnpm db:verify`.
- [ ] Commit as `feat(context-ai): add governed analysis and draft schema`.

### Task 2: Implement deterministic matching policy

**Files:**

- Create: `packages/context-intelligence/src/matching-policy.ts`
- Create: `packages/context-intelligence/src/matching-policy.test.ts`
- Create: `packages/context-intelligence/src/project-anchor-reader.ts`
- Create: `packages/context-intelligence/src/project-anchor-reader.integration.test.ts`
- Create: `packages/context-intelligence/src/project-semantic-context-reader.ts`
- Create: `packages/context-intelligence/src/project-semantic-context-reader.integration.test.ts`

**Decision:**

```ts
type LinkDecision =
  | { kind: "AUTO_LINK"; projectId: string; anchors: ProjectAnchor[] }
  | { kind: "REVIEW"; candidates: ProjectCandidate[]; reasons: string[] }
  | { kind: "NO_MATCH"; reasons: string[] };
```

- [ ] Write rejection-first tests for conflicting anchors, one weak anchor, stale mappings, inaccessible Projects, and model-only confidence.
- [ ] Write acceptance tests for explicit user mapping and two independent non-conflicting anchors.
- [ ] Keep anchor types bounded: confirmed sender/domain mapping, Calendar attendee/context mapping, explicit Project term/reference, prior employee correction, and governed repository binding.
- [ ] Read purpose, outcomes, milestones, deliverables, terminology, stakeholders, operational KPIs, acceptance conditions, and evidence requirements only from the approved Project document version through the Documents public reader.
- [ ] Persist explanations and make auto-links reversible.
- [ ] Run package tests and typecheck.
- [ ] Commit as `feat(context-ai): add explainable project matching policy`.

### Task 3: Add AI summarization and Task drafting through AI Router

**Files:**

- Create: `packages/context-intelligence/src/prompts.ts`
- Create: `packages/context-intelligence/src/prompts.test.ts`
- Create: `packages/context-intelligence/src/analysis-service.ts`
- Create: `packages/context-intelligence/src/analysis-service.integration.test.ts`
- Create: `packages/context-intelligence/src/task-draft-service.ts`
- Create: `packages/context-intelligence/src/task-draft-service.integration.test.ts`
- Modify: `apps/api/src/ai-routing/system-ai-scope.ts`
- Modify: `apps/api/src/ai-routing/system-ai-scope.test.ts`
- Create: `tests/ai/context-intelligence.eval.test.ts`

**Routes:**

```text
context.summarize.v1
context.project-match.v1
task.draft.v1
```

- [ ] Write failing AI evaluations for faithful summary, missing-context uncertainty, prompt injection, Arabic/mixed technical text, source grounding, and prohibited rating output.
- [ ] Register versioned schemas and prompts through the AI Router only.
- [ ] Sanitize and delimit untrusted source content; ignore instructions embedded in email, event, document, code, or comment content.
- [ ] Combine deterministic decision output with AI explanation; AI cannot upgrade `REVIEW` to `AUTO_LINK`.
- [ ] Persist route trace and validated structured output without provider credentials.
- [ ] Run `pnpm test:ai -- context-intelligence` and `pnpm scan:ai-boundary`.
- [ ] Commit as `feat(context-ai): add routed summaries and task drafts`.

### Task 4: Expose review and confirmation APIs

**Files:**

- Create: `apps/api/src/context-intelligence/context-intelligence.module.ts`
- Create: `apps/api/src/context-intelligence/context-analysis.controller.ts`
- Create: `apps/api/src/context-intelligence/task-drafts.controller.ts`
- Create: `apps/api/src/context-intelligence/context-intelligence-policy.guard.ts`
- Create: `apps/api/src/context-intelligence/context-intelligence.e2e.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

**Endpoints:**

```text
POST /api/v1/context/items/:id/analyze
GET  /api/v1/context/review-queue
POST /api/v1/context/project-suggestions/:id/confirm
POST /api/v1/context/project-suggestions/:id/correct
POST /api/v1/context/task-drafts
POST /api/v1/context/task-drafts/:id/confirm
```

- [ ] Test that confirmation requires the owning active employee and a currently authorized Project.
- [ ] Test that Task confirmation calls the public Work Items service and is transactionally idempotent.
- [ ] Test cross-employee denial, stale draft version, invalid source access, and revoked Project membership.
- [ ] Return an editable draft even when optional fields are uncertain; ask focused clarification only when required for confirmation.
- [ ] Run API integration tests and affected typechecks.
- [ ] Commit as `feat(api): expose context review and task confirmation`.

### Task 5: Add the smart review queue

**Files:**

- Create: `apps/web/src/platform/context-intelligence-api.ts`
- Create: `apps/web/src/platform/context-intelligence-api.test.ts`
- Create: `apps/web/src/app/[locale]/my-work/smart-review-queue.tsx`
- Create: `apps/web/src/app/[locale]/my-work/project-match-card.tsx`
- Create: `apps/web/src/app/[locale]/my-work/task-draft-sheet.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/my-work-client.tsx`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`

- [ ] Test explainable auto-links, uncertain choices, source inspection, correction, rejection, draft editing, and human confirmation.
- [ ] Use one compact queue item per decision; do not display a chat transcript by default.
- [ ] When clarification is necessary, ask one focused question at a time inside the draft sheet.
- [ ] Show what will become shared before confirmation.
- [ ] Persist the editable draft locally/server-side so reauthentication restores the same draft and source context.
- [ ] Keep AI language as suggestions: “Prepared,” “Likely linked because…,” and “Needs your review.”
- [ ] Run focused web/localization tests and typecheck.
- [ ] Commit as `feat(web): add smart context review queue`.

### Task 6: AI and privacy acceptance checkpoint

**Files:**

- Create: `tests/e2e/context-intelligence.spec.ts`
- Create: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_3.md`
- Create screenshots under: `docs/product/screenshots/ai-first-daily-workspace/slice-3/`

- [ ] Demonstrate an explainable high-confidence link, an uncertain review, a correction, a rejected suggestion, and an employee-confirmed Task.
- [ ] Prove an AI draft never creates or assigns an official Task before confirmation.
- [ ] Disable AI and prove manual browsing, linking, and Task completion remain usable with raw input preserved.
- [ ] Prove private source content is absent from manager and other-employee responses.
- [ ] Run focused unit/integration/AI tests, migration verification, affected lint/typechecks, and protected scans.
- [ ] Complete bounded specification/AI and security reviews; remediate confirmed P0/P1 only.
- [ ] Commit as `test: verify context intelligence boundaries`.
- [ ] Push, update Pull Request #5, publish URLs/screenshots, then stop.

## Product Owner Stop Gate

The Product Owner judges whether the assistant reduces work, explains itself plainly, and produces a useful complete draft without taking control from the employee. Do not begin Slice 4 until the assistant feels trustworthy and faster than manual organization.
