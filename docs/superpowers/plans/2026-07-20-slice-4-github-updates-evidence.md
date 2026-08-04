# Slice 4 — GitHub, Updates, Evidence, and Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for bounded work and bounded critical reviews for GitHub integrity, file/voice safety, AI routing, and evidence confirmation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring governed GitHub activity and fast text, voice, image, code, and file capture into one update/evidence lifecycle with a readable Timeline.

**Architecture:** Extend the existing Updates & Evidence package. Add one provider adapter package for GitHub App webhooks and reconciliation. All sources create source-labelled suggestions or update drafts; employee evidence still requires confirmation. Deterministic Progress Contract mappings may update operational Project progress only through the existing Projects service.

**Tech Stack:** GitHub App REST/webhooks, existing AI Router, existing file pipeline, Prisma/PostgreSQL, NestJS, React, Vitest, Playwright.

## Global Constraints

- GitHub PRs, commits, checks, and deployments are suggested evidence only.
- Raw activity volume is never progress or employee performance.
- Webhooks are idempotent, signatures are verified, and missed events are reconciled.
- Employee confirmation is required before suggested evidence becomes a contribution record.
- A verified GitHub event may satisfy a deterministic active Progress Contract condition; ambiguous mappings go to Project-owner review.
- Voice transcription and update structuring use the AI Router only.
- Every upload is untrusted and must pass type, size, and safety checks.

---

### Task 1: Add GitHub App binding and event persistence

**Files:**

- Create: `packages/github-integration/package.json`
- Create: `packages/github-integration/tsconfig.json`
- Create: `packages/github-integration/src/index.ts`
- Create: `packages/contracts/src/github-integration.ts`
- Create: `packages/contracts/src/github-integration.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0020_github_integration/migration.sql`
- Create: `packages/database/src/github-integration-schema.integration.test.ts`
- Modify: `pnpm-workspace.yaml`

**Models:**

```ts
type GitHubSourceEvent = {
  installationId: string;
  repositoryId: string;
  deliveryId: string;
  eventType: string;
  sourceId: string;
  sourceUrl: string;
  occurredAt: string;
  verificationState: "VERIFIED" | "REJECTED";
};
```

- [ ] Add failing tests for installation/Project bindings, delivery idempotency, original source IDs/URLs, reconciliation cursor, and event verification.
- [ ] Store minimum event metadata and normalized governed facts; do not create activity-score columns.
- [ ] Enforce one active binding rule per Project/repository pair and preserve binding history.
- [ ] Run contract/schema tests, migration verification, and performance-input scan.
- [ ] Commit as `feat(github): add governed app binding schema`.

### Task 2: Implement webhook verification and reconciliation

**Files:**

- Create: `packages/github-integration/src/signature-verifier.ts`
- Create: `packages/github-integration/src/webhook-service.ts`
- Create: `packages/github-integration/src/reconciliation-service.ts`
- Create: `packages/github-integration/src/github-app-client.ts`
- Create: `packages/github-integration/src/webhook-service.test.ts`
- Create: `packages/github-integration/src/reconciliation-service.integration.test.ts`
- Create: `apps/api/src/github-integration/github-webhook.controller.ts`
- Create: `apps/api/src/github-integration/github-integration.module.ts`
- Create: `apps/api/src/github-integration/github-integration.e2e.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] Write failing tests for invalid signature, replayed delivery, unsupported event, installation mismatch, deleted repository, rate limit, and missed-event recovery.
- [ ] Acknowledge webhook delivery only after durable idempotent receipt; process normalized facts separately.
- [ ] Use minimum GitHub App permissions and never store installation tokens.
- [ ] Add an external gate for GitHub App creation, installation, webhook secret, and organization approval.
- [ ] Run focused package/API tests and secret scan.
- [ ] Commit as `feat(github): verify and reconcile source events`.

### Task 3: Produce governed evidence and progress suggestions

**Files:**

- Create: `packages/github-integration/src/evidence-suggestion-service.ts`
- Create: `packages/github-integration/src/evidence-suggestion-service.integration.test.ts`
- Create: `packages/github-integration/src/progress-condition-matcher.ts`
- Create: `packages/github-integration/src/progress-condition-matcher.test.ts`
- Modify: `packages/updates-evidence/src/evidence-service.ts`
- Modify: `packages/updates-evidence/src/evidence-service.integration.test.ts`
- Modify: `packages/projects/src/progress-contract-service.ts`
- Modify: `packages/projects/src/progress-contract-service.integration.test.ts`

- [ ] Test that PR/commit/check/deployment facts create suggestions, not confirmed employee contribution.
- [ ] Test deterministic Progress Contract conditions by source identity, acceptance state, and active contract version.
- [ ] Reject raw counts, changed lines/files, commit frequency, and author-volume rules.
- [ ] Route ambiguous contract matches to authorized Project-owner review.
- [ ] Require employee confirmation and contribution context for personal evidence.
- [ ] Run focused GitHub, Updates & Evidence, and Projects tests plus protected scans.
- [ ] Commit as `feat(github): create governed source suggestions`.

### Task 4: Simplify universal text/file/code update capture

**Files:**

- Refactor: `apps/web/src/app/[locale]/my-work/update-composer.tsx`
- Refactor: `apps/web/src/app/[locale]/my-work/update-composer-view.tsx`
- Create: `apps/web/src/app/[locale]/my-work/universal-capture.tsx`
- Create: `apps/web/src/app/[locale]/my-work/update-draft-sheet.tsx`
- Modify: `packages/updates-evidence/src/update-service.ts`
- Modify: `packages/updates-evidence/src/update-service.integration.test.ts`
- Modify: `packages/contracts/src/updates-evidence.ts`
- Modify: `packages/contracts/src/updates-evidence.test.ts`

**Flow:**

```text
capture → useful draft → conditional focused question
→ attach/suggest evidence → compare previous state
→ employee edit → employee confirmation → append-only Timeline
```

- [ ] Write regression tests for Project-required update scope, optional Workstream/Task, draft-first behavior, one question at a time, and exact draft recovery.
- [ ] Accept text, image, safe file, code snippet, and source reference from one action.
- [ ] Keep evidence entry in the same flow and prefill only an editable claim.
- [ ] End in a compact result card, not a long form transcript.
- [ ] Preserve existing AI Router route governance and append-only Timeline events.
- [ ] Run focused Updates & Evidence and web tests.
- [ ] Commit as `feat(updates): simplify universal daily capture`.

### Task 5: Add governed voice capture

**Files:**

- Create: `packages/updates-evidence/src/voice-transcriber.ts`
- Create: `packages/updates-evidence/src/voice-transcriber.test.ts`
- Modify: `packages/updates-evidence/src/prompts.ts`
- Modify: `packages/updates-evidence/src/prompts.test.ts`
- Modify: `apps/api/src/updates-evidence/updates.controller.ts`
- Modify: `apps/api/src/updates-evidence/updates-evidence.e2e.integration.test.ts`
- Create: `apps/web/src/app/[locale]/my-work/voice-capture.tsx`
- Create: `tests/ai/voice-update.eval.test.ts`

- [ ] Test MIME/size/duration validation, safe temporary handling, cancellation, transcription failure, and retry.
- [ ] Route transcription through the governed AI Router; never call a provider SDK from Updates & Evidence.
- [ ] Add Gulf, Levantine, Fusha, English, and mixed technical term fixtures.
- [ ] Show editable transcript and structured draft before confirmation.
- [ ] Delete temporary audio according to the approved retention rule and audit only non-sensitive operational metadata.
- [ ] Run focused tests, AI evaluations, boundary scan, and secret scan.
- [ ] Commit as `feat(updates): add governed voice capture`.

### Task 6: Build source review and unified Timeline

**Files:**

- Create: `apps/web/src/app/[locale]/my-work/github-source-card.tsx`
- Create: `apps/web/src/app/[locale]/my-work/evidence-review-sheet.tsx`
- Modify: `apps/web/src/app/[locale]/timeline/page.tsx`
- Modify: `packages/updates-evidence/src/activity-reader.ts`
- Modify: `packages/updates-evidence/src/activity-reader.test.ts`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`

- [ ] Display source type, supported claim, Project/Workstream/Task, KPI/criterion link, contribution context, and verification state.
- [ ] Open mobile evidence review in a visible bottom sheet.
- [ ] Clearly distinguish automated Project facts, AI drafts, employee-confirmed evidence, and human decisions.
- [ ] Never show raw activity counts as a headline metric.
- [ ] Run focused web/activity/localization tests and typecheck.
- [ ] Commit as `feat(web): unify source review and timeline`.

### Task 7: Source integrity acceptance checkpoint

**Files:**

- Create: `tests/e2e/github-updates-evidence.spec.ts`
- Create: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_4.md`
- Create screenshots under: `docs/product/screenshots/ai-first-daily-workspace/slice-4/`

- [ ] Demonstrate deterministic GitHub fixtures before any live installation.
- [ ] Demonstrate manual text, voice, image/file, code, and GitHub suggestion through one lifecycle.
- [ ] Verify employee evidence confirmation, Project-owner ambiguous-progress review, and source-labelled Timeline.
- [ ] Verify raw GitHub volume never changes progress or performance.
- [ ] Run focused tests, integration tests, AI evaluations, migration verification, affected lint/typechecks, and protected scans.
- [ ] Complete bounded specification and security/integrity reviews; remediate confirmed P0/P1 only.
- [ ] Commit as `test: verify github update and evidence lifecycle`.
- [ ] Push, update Pull Request #5, publish URLs/screenshots, then stop.

## Product Owner Stop Gate

The Product Owner reviews whether manual updates are now genuinely fast, whether GitHub feels automated without becoming surveillance, and whether evidence and Project progress remain visibly different from employee evaluation.
