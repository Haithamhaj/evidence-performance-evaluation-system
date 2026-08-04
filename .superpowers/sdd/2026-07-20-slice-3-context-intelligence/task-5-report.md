# Slice 3 Task 5 Report — Smart Context Review Queue

## Status

Complete.

- Task ID: `P2R-S3 / S3-T5`
- Feature commit: `8e50ea7879a47be69b0a8ca176867db424506396`
- Feature commit message: `feat(web): add smart context review queue`
- Branch: `codex/phase-2-updates-evidence-readiness`
- Push: not performed

## RED evidence

All verification used the repository-pinned Node.js `24.18.0` and pnpm `11.13.0` via the pinned
Node 24 PATH and Corepack. The documented runtime activation file is absent in this worktree, so it
could not be sourced.

Tests were written before their production modules and each initial run failed for the intended
missing boundary:

- Browser gateway and review UI: `Cannot find module './context-intelligence-api.js'` and
  `Cannot find module './project-match-card.js'`.
- Same-origin review proxy: returned `404` rather than the expected `200`.
- Draft recovery storage: `Cannot find module './context-review-draft-storage.js'`.
- Focused-clarification regression: a prepared Project caused the Project and assignee controls to
  render together instead of moving to one next question.
- Same-origin Task-draft proxy: returned `400` because the request body was parsed after the new
  Context route branch; the regression test now proves the bounded payload is forwarded.

## What changed

- Added a compact Smart review section to My Work. Each item is either an explainable Project link
  or a prepared Task draft; no chat transcript is rendered by default.
- Project review exposes only employee actions: confirm, select another Project, or reject. It uses
  suggestive language: `Prepared`, `Likely linked because`, and `Needs your review`.
- Source inspection is on demand and uses the existing employee-only connected-context reader.
- Added the Task review sheet with editable title/description, an explicit preview of what becomes
  shared, and exactly one missing confirmation question at a time.
- When no assignee was proposed, the only available employee choice is `Assign to you`; the UI never
  presents a technical user ID as a control.
- Added session-scoped local draft recovery for editable fields. The server remains the durable
  source for the prepared draft, provenance, and currently authorized source context; after a new
  sign-in the queue/source read restores those governed records.
- Added a narrow same-origin `/api/daily-work/context/...` allowlist that forwards only the Task 4
  review and human-confirmation actions, validates request bodies, and strictly parses responses.
- Added complete English and Arabic queue vocabulary and explicit RTL direction on review cards and
  sheets. Mobile uses the existing bottom-sheet behavior, focus-visible styling, Escape close, and
  reduced-motion-safe existing shell behavior.

## Files changed

- `apps/web/src/platform/context-intelligence-contracts.ts`
- `apps/web/src/platform/context-intelligence-api.ts`
- `apps/web/src/platform/context-intelligence-api.test.ts`
- `apps/web/src/app/api/daily-work/[...path]/route.ts`
- `apps/web/src/app/api/daily-work/[...path]/route.test.ts`
- `apps/web/src/app/[locale]/my-work/my-work-client.tsx`
- `apps/web/src/app/[locale]/my-work/smart-review-queue.tsx`
- `apps/web/src/app/[locale]/my-work/smart-review-queue.test.tsx`
- `apps/web/src/app/[locale]/my-work/project-match-card.tsx`
- `apps/web/src/app/[locale]/my-work/task-draft-sheet.tsx`
- `apps/web/src/app/[locale]/my-work/context-review-draft-storage.ts`
- `apps/web/src/app/[locale]/my-work/context-review-draft-storage.test.ts`
- `apps/web/src/app/globals.css`
- `packages/localization/src/catalogs/en.json`
- `packages/localization/src/catalogs/ar.json`

## Database changes

None. This task uses Task 1's append-only Context Intelligence records and Task 4's protected API.

## Verification

| Check | Result |
| --- | --- |
| Focused web review/proxy/draft-recovery/My Work tests | 5 files, 23 tests passed |
| Localization tests | 2 files, 24 tests passed |
| Web typecheck | passed |
| Web lint | passed |
| Repository formatting check | passed |
| `git diff --check` | passed |
| AI/module boundary scan | 595 source files valid |
| Protected performance-input scan | 491 files valid |

## Security and privacy impact

- Client Components hold no bearer token, server session, provider credential, model route, or key
  material. All protected requests go through the same-origin server route.
- The browser proxy has a fixed allowlist, rejects malformed bodies, and strictly parses each
  upstream response; it accepts neither actor identity nor source/route/key material from the
  browser.
- The queue independently reads the existing owner-only source reader. Manager and administrator
  restrictions, current source authorization, Project membership checks, stale revision rejection,
  idempotency, official Task creation, and audit writes remain enforced by Task 4 on the server.
- Only the confirm endpoint can create an official Task. The preview labels the exact human-edited
  Task fields that will become shared; connected source context and review notes remain private.
- No rating, performance score, progress claim, documentation-readiness value, ranking, activity
  metric, or AI-created official Task was added.

## Accessibility and localization

- Semantic sections and dialogs use labelled headings, native controls, visible focus, Escape close,
  keyboard-operable details/select/buttons, RTL/LTR direction, and existing mobile sheet sizing.
- Both catalogs are key-compatible and review the same concepts without exposing technical IDs.

## Remaining risk

- The Task 4 API deliberately exposes no employee-directory projection. Consequently a draft with no
  proposed assignee can only be confirmed by the reviewing employee assigning it to themselves. A
  future bounded people picker would require an approved employee-scoped identity endpoint and its
  own authorization tests.
- Browser session storage restores editable fields only for the same browser tab/session. The
  durable prepared draft and source context are server-backed and reload after reauthentication, but
  cross-device recovery of unconfirmed local edits would require a new append-only draft-edit API.
- No project-state update: this bounded web task does not change architecture, protected decisions,
  or the slice-level recommended action.

## Fix Round 1 — Browser-safe review boundary

### Status

Complete.

- Fix commit: `3c0c3130d2be30c46fe54f5c5fa4cdbac65caf3c`
- Fix commit message: `fix(web): minimize context review responses`
- Push: not performed

### RED evidence

A new same-origin gateway network-contract test initially failed because the review queue returned
the full upstream suggestion record. That response included employee, source-item, project,
suggestion, and AI route identifiers, along with source references and route trace data.

### What changed

- Replaced all review-item and project IDs exposed to the browser with encrypted, expiring opaque
  action handles. The server opens a handle only for the matching confirmation/correction action
  and then calls the existing protected Task 4 API with the resolved internal identity.
- Projected the queue at the same-origin gateway into an exact employee-review DTO: safe Project
  name and explanation, safe source title/summary/link, editable Task content, and opaque handles.
  The browser receives no employee/source-item/source-reference IDs, database IDs, AI run IDs,
  route configuration IDs, or route keys.
- Removed the unused browser analyzer and source-ID task-preparation API. Browser mutations now
  accept only opaque review/project handles plus bounded human edits and reasons.
- Made every browser response contract used by the review feature strict. Upstream records are
  parsed privately and then projected before the gateway returns JSON; task confirmation returns
  only the safe task title.
- Updated the browser’s temporary draft recovery to store opaque handles rather than project,
  assignee, or draft identifiers.
- Replaced obsolete raw-DTO component/API tests with a gateway network-contract test that verifies
  the actual JSON response has none of the forbidden keys or raw identifier values.

### Files changed in this fix

- `apps/web/src/platform/context-intelligence-handles.ts`
- `apps/web/src/platform/context-intelligence-contracts.ts`
- `apps/web/src/platform/context-intelligence-api.ts`
- `apps/web/src/auth/oidc.ts`
- `apps/web/src/app/api/daily-work/[...path]/route.ts`
- `apps/web/src/app/api/daily-work/[...path]/route.test.ts`
- `apps/web/src/app/[locale]/my-work/my-work-client.tsx`
- `apps/web/src/app/[locale]/my-work/smart-review-queue.tsx`
- `apps/web/src/app/[locale]/my-work/project-match-card.tsx`
- `apps/web/src/app/[locale]/my-work/task-draft-sheet.tsx`
- `apps/web/src/app/[locale]/my-work/context-review-draft-storage.ts`
- `apps/web/src/app/[locale]/my-work/context-review-draft-storage.test.ts`

### Verification

| Check | Result |
| --- | --- |
| Focused same-origin proxy, My Work, and safe-draft-storage tests | 3 files, 16 tests passed |
| Localized home-route test (`en`, `ar`) | 1 file, 2 tests passed |
| Web typecheck (`next build --compile` and `tsc`) | passed |
| Web lint | passed |
| Focused Prettier check | passed |
| `git diff --check` | passed |

### Security/privacy impact

This closes the browser-response exposure in the review flow. Opaque handles are encrypted with
the server’s existing authentication secret and expire after 15 minutes. They are never interpreted
in the client, and every mutation still resolves to Task 4’s server-side authorization, ownership,
revision, audit, and validation checks. No database migration or project-state change is required.

## Fix Round 2 — Strict upstream Context projection

### Status

Complete.

- Fix commit: `49ca5e1b23ef805b09f406f6c6ee751d2fca5cdc`
- Fix commit message: `fix(web): strictly project context upstream responses`
- Push: not performed

### RED evidence

The new proxy-contract regression failed against the prior parser because the queue envelope
rejected an extra top-level field while nested queue/source/project records and action results could
retain unknown fields through `.passthrough()`.

### What changed

- Replaced every Task 5 upstream `.passthrough()` response schema with an explicit server-side
  projection followed by a `.strict()` schema.
- Queue records retain only the fields needed to create opaque review handles and display the
  employee-safe review DTO. Source records retain only source ID, title, summary, and URL; Project
  records retain only ID and name.
- Project confirmation/correction results are projected to an empty strict acknowledgment because
  the browser needs no returned upstream fields. Task confirmation retains only `workItem.title`
  before its already-strict browser DTO projection.
- Added a focused regression test that injects unexpected queue, item, source, Project,
  acknowledgment, and Task-result fields and proves each strict parser removes them before the
  response flow continues.

### Files changed in this fix

- `apps/web/src/app/api/daily-work/[...path]/route.ts`
- `apps/web/src/app/api/daily-work/[...path]/route.test.ts`

### Verification

| Check | Result |
| --- | --- |
| Focused same-origin gateway proxy tests | 13 tests passed |
| Web typecheck (`next build --compile` and `tsc`) | passed |
| Web lint | passed |
| Focused Prettier check | passed |
| `git diff --check` | passed |

### Security/privacy impact

Unexpected upstream fields are now explicitly discarded before strict validation, so a future
upstream expansion cannot silently cross the Task 5 gateway boundary. Browser response DTOs remain
unchanged and strict. No database migration or project-state update is required.
