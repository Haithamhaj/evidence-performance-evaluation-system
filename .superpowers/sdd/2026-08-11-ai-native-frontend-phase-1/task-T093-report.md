# T093 implementation report

## Outcome

Implemented the first bounded source-to-command journey behind an independent server-read rollback
flag. The employee can privately review Gmail/Calendar context, verified GitHub suggestions, and
manual captures in one compact queue; confirm or correct the Project; then create, edit, and
explicitly confirm a separate evidence record.

## Changes

- Added a source-review gateway that composes the existing owner-scoped Connected Work reader and
  Project-authorized activity timeline. It sends no actor, employee, or user selector from the
  browser.
- Added a compact English/Arabic source queue with private/suggested labels, Project context, an
  accessible focused drawer, mobile stacking, RTL, visible focus, and reduced-motion behavior.
- Reused the owning protected commands for Google Project linking/exclusion and GitHub/manual
  evidence draft, revision, confirmation, and rejection.
- Required a separate Project confirmation before evidence review. Google corrections persist via
  `ConnectedWorkConnectionService.linkProject`; GitHub remains bound to its verified Project and is
  never reclassified by the browser.
- Kept evidence creation and confirmation separate. The initial draft cannot be confirmed until an
  employee edit is saved; confirmation produces a visible neutral receipt stating that Project
  progress and employee evaluation did not change.
- Preserved manual evidence when connectors are unavailable and retained the existing Connected
  Context, Private Inbox, Timeline, and evidence-review routes for rollback.
- Added `AI_NATIVE_SOURCE_REVIEW_ENABLED=false` to restore the previous source surfaces without
  deleting confirmed evidence or history.

## Files changed

- Source-review UI and focused tests under `apps/web/src/features/source-review/`.
- Browser composition gateway and tests under `apps/web/src/platform/source-review-api*`.
- Rollback flag under `apps/web/src/server/source-review/`.
- My Work wiring, evidence-prefill support, and focused CSS under `apps/web/src/app/`.
- English and Arabic catalogs under `packages/localization/src/catalogs/`.

## Database changes

None. T093 uses existing Connected Work, Private Inbox, Timeline, and Evidence records and commands.

## Verification

- Focused source, gateway, evidence, same-origin route, and rollback tests: 7 files, 60 tests passed.
- Connected Work and Evidence HTTP authorization/privacy integration: 2 files, 38 tests passed.
- `@evaluation/web` typecheck and Next production compile: passed.
- `@evaluation/web` production build, including static generation: passed.
- Affected ESLint, Prettier, and `git diff --check`: passed.
- The DB-backed Connected Work/Evidence domain suites were not rerun locally because this worktree
  has no `TEST_DATABASE_URL`; T093 changes no domain or persistence code, and the protected HTTP
  integration proofs above passed.

## Security / privacy / AI impact

- Gmail/Calendar and manual context remain owner-private. Existing protected readers derive the
  actor from the server session; the new browser gateway has no cross-user selector.
- Existing authorization integration proves other employees/managers cannot read or act on the
  owner's private source, while the owner-positive path remains available.
- GitHub remains suggested evidence only. No Google, GitHub, or manual source creates evidence,
  contribution, Project progress, readiness, rating, ranking, or performance state automatically.
- Evidence confirmation remains a deliberate employee command after draft review and edit.
- No AI call or provider SDK was added. Source review records truthful `manual` execution mode; the
  existing AI Router boundary remains unchanged.

## Remaining bounded acceptance

The controller still owns the authenticated browser journey and screenshots:

- `docs/product/screenshots/ai-native-phase-1/t093-source-review.png`
- `docs/product/screenshots/ai-native-phase-1/t093-evidence-confirmation.png`
- `docs/product/screenshots/ai-native-phase-1/t093-private-context-denied.png`

T093 implementation is ready for that Product Owner stop gate. T094 was not started.
