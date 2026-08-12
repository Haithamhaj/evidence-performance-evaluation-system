# T087 — Universal Capture and manual recovery

## Outcome

Implemented the bounded manual-first private capture path. Employee shell users can open Capture,
select text, link, pasted code, safe file, or image, review the raw draft, and explicitly save it to
their private Inbox. The capture command creates no Task, Update, Evidence, Project progress, or
evaluation input. File/image bytes use an unclassified owner-private Documents storage route. There
is no voice capture, direct provider call, or AI result.

## RED/GREEN evidence

- RED: `packages/contracts/src/work-items.test.ts` failed because `sourceType` was rejected as an
  unknown key; GREEN: bounded `text/link/code/file/image` capture contract and invalid input cases pass.
- RED: `packages/contracts/src/documents.test.ts` failed because private capture metadata did not
  exist; GREEN: only approved text/office/image upload formats are accepted and audio/executables deny.
- RED: `packages/documents/src/private-capture-upload-service.test.ts` failed because the service
  module did not exist; GREEN: storage inspection, malware scan, checksums, owner-only signed reads,
  and denial pass.
- RED: `apps/api/src/documents/private-capture-uploads.controller.test.ts` failed because the
  controller did not exist; GREEN: no caller-controlled owner/object key and principal-bound signed
  reads pass.
- RED: `apps/web/src/product-ui/capture/capture-dialog.test.tsx` failed because the dialog did not
  exist; GREEN: role-safe trigger and truthful private-review language pass.

## Files/modules changed

- Contracts: private capture source and private file staging schemas.
- Database: forward-only `0039_private_capture` migration, owner-private upload table, Inbox source
  fields and constraints.
- Documents: owner-private staging/signing service and protected API controller.
- Work Items: owner-bound private Inbox capture validates a staged upload belongs to the employee.
- Web: stable-shell Capture dialog with text/link/code/file/image selection, private-upload gateway,
  protected capture proxy, and English/Arabic catalog parity.

## Database change

Adds `PrivateCaptureSourceType`, `PrivateCaptureUpload`, strict source/upload invariants, and the
owner lookup index. The migration was verified from empty and prior-release schemas with no drift.

## Verification

- Focused contracts, Documents service, API controller, web dialog/proxy: passing (40 tests).
- `@evaluation/web`, `@evaluation/work-items`, `@evaluation/documents`, `@evaluation/api` typechecks: passing.
- Web affected compile build: passing.
- Formatting, frontend boundary validation, secret scan: passing.
- `pnpm db:verify`: passing (39 migrations; migration and schema drift checks passed).

## Privacy/security impact

- Owner identity is always derived from the authenticated principal; callers cannot supply an owner or
  object key.
- Raw content, file bytes, object keys, and signed URLs are absent from audit safe diffs and response
  models. Audits record only safety metadata.
- Managers, administrators, project owners, and unrelated employees cannot list, capture-as, or sign
  another employee's raw capture. Existing Work Items promotion remains separate.

## Remaining risk / review handoff

The runnable visual review route is `/{locale}/my-work` using the Stable Shell Capture button. File
and image selection posts to `/api/capture/uploads`, then saves the owner-private capture record.
Per controller direction, browser-driven visual verification and the required screenshots remain
deferred to the selected in-app browser reviewer:

- `docs/product/screenshots/ai-native-phase-1/t087-capture-en-desktop.png`
- `docs/product/screenshots/ai-native-phase-1/t087-capture-ar-mobile.png`
- `docs/product/screenshots/ai-native-phase-1/t087-capture-recovery.png`

`TASKS.md` and `project-state/PROJECT_STATE.md` remain unchanged until that final visual evidence is
recorded.

## P1 remediation — 2026-08-12

The bounded independent-review remediation fixes both confirmed P1 findings without addressing the
deferred foreign-key observation:

- Private capture now has one server-side employee/contributor authorization policy. Private Inbox
  capture, list, promote, and dismiss plus private-upload stage, ownership validation, and signed read
  deny inactive, manager-only, and system-administrator-only principals. A manager who is also an
  employee remains authorized.
- Work Items no longer reads the Documents-owned `PrivateCaptureUpload` persistence model. It depends
  on a narrow ownership-validation port, and the API module composes that port with Documents'
  public `PrivateCaptureUploadService.assertOwned` operation before an Inbox file/image is persisted.

### Remediation RED/GREEN evidence

- RED: the new policy test could not import `private-capture`, controller role-denial tests reached
  their mocked services for manager-only and administrator-only principals, and Documents accepted
  those roles because role context was absent. GREEN: direct policy, API, and Documents service tests
  deny those principals while employee, contributor, and manager-plus-employee cases pass.
- RED: the Work Items ownership-boundary test could not construct the service with an ownership
  validator and the implementation still referenced `transaction.privateCaptureUpload`. GREEN:
  file/image capture invokes the injected Documents ownership operation before its transaction; both
  wrong-owner and missing-upload results deny without creating an Inbox record.
- Focused remediation verification: 6 files / 40 tests passed.
- Affected typechecks: Permissions, Work Items, Documents, and API passed.
- Boundary validation: `FRONTEND BOUNDARIES VALID (1101 files)`.
- `git diff --check`: passed.

The checks emitted the repository's existing Node-engine warning because verification ran on Node
22.23.1 while the repository declares Node 24.18.0; no test or typecheck failed.

## Progress Contract regression remediation — 2026-08-12

The Daily Work controller now uses separate actor projections: the private Inbox workspace receives
the authenticated role set, while strict Progress Contract propose/submit/approve/reject commands
receive only `{ userId, active }` as their domain schema requires.

- RED: 4 focused controller-to-real-service cases failed with `ZodError` because the proposed,
  submitted, approved, and rejected commands contained the unrecognized `actor.roles` key.
- GREEN: the same 4 cases reached the real Progress Contract service persistence boundary; the full
  focused file passed (18/18 tests).
- Affected API typecheck: passing.

## Stable Shell Capture trigger remediation — 2026-08-12

The visible Capture trigger now uses the existing React Aria-compatible `ActionButton` expected by
`FocusedDialog`. The foundation story's existing `ActionButton` dialog trigger remains unchanged.

- RED: a real jsdom interaction clicked the employee `Capture` button, emitted React Aria's
  `PressResponder` warning, and could not find the `Capture privately` dialog.
- GREEN: the same interaction opens the dialog and capture-note form, then Escape closes it and
  returns focus to the Capture trigger.
- Focused UI verification: 2 files / 7 tests passed (Capture journey plus UI primitive browser
  compatibility).
- Affected web typecheck/compile and focused lint: passing.

## Stable Shell Capture presentation remediation — 2026-08-12

The employee EN/AR Stable Shell stories now provide every Capture catalog entry plus the close label.
`CaptureDialog` owns a compact CSS module with Command Brief spacing, muted privacy guidance,
full-width labelled controls, a restrained review/recovery surface, and a clear primary action. The
shared dialog primitive and its existing desktop/mobile placement behavior are unchanged.

- RED: the real Stable Shell employee stories opened an unnamed dialog with blank controls; 2 EN/AR
  localization and accessible-label cases failed.
- GREEN: the story journey exercises note/link/code/file choices, review, recovery, and saved states
  in both locales; the focused file passed (5/5 tests).
- Web lint passed. Web typecheck and Next compile passed.
- Existing Node 22/24 engine and Vite native-config warnings remain informational only.

## Authenticated role hydration remediation — 2026-08-12

OIDC synchronization now reads the active internal user's current `RoleAssignment` rows inside the
same transaction and returns their unique role names on `AuthenticatedPrincipal`. It does not accept
or merge OIDC-provided roles, so the database remains authoritative. The schema has no role
effective-window or status fields; every persisted assignment is current, while inactive users still
fail before a role-bearing principal is returned.

- RED: synchronization of an employee/contributor returned `roles: []` instead of the unique
  database assignments, preventing real authenticated employees from passing private-capture policy.
- GREEN: synchronization returned `["employee", "contributor"]` from repeated authoritative rows.
- Focused auth, AuthGuard, private-capture policy, and capture API verification: 5 files / 28 tests
  passed.
- Auth and API typechecks passed; focused Auth files were formatted.

## Authenticated product acceptance — 2026-08-12

The full local stack ran from this Phase 1 worktree with the real local OIDC, API, PostgreSQL, Redis,
object storage, and web application. Using the documented synthetic employee account, the Arabic
employee journey opened Global Capture, entered a text note, reviewed the private draft, explicitly
confirmed save, and received `تم الحفظ في صندوقك الخاص.` The database independently confirmed one
owner-bound Inbox row with source type `text`; no Task, Update, Evidence, Project progress, or
evaluation record was created.

Visual evidence:

- `docs/product/screenshots/ai-native-phase-1/t087-capture-en-desktop.png` — English desktop review.
- `docs/product/screenshots/ai-native-phase-1/t087-capture-ar-mobile.png` — Arabic RTL at 390 × 844.
- `docs/product/screenshots/ai-native-phase-1/t087-capture-recovery.png` — recoverable save failure
  with the employee draft preserved.

Final acceptance result: **passed**. The bounded T087 outcome is complete and T088 is unblocked.
The non-blocking database foreign-key reinforcement was recorded for later as GitHub issue #31.
