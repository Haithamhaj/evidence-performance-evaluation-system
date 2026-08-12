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
- Reused the owning protected commands for Google Project unlink/link/exclusion and GitHub/manual
  evidence draft, revision, confirmation, and rejection.
- Required a separate Project confirmation before evidence review. Google corrections close the
  previous link before creating the replacement, preserve link history, and show an explicit
  unlinked recovery state if replacement fails. GitHub remains bound to its verified source Project
  and cannot be changed in the browser.
- Kept evidence creation and confirmation separate. The initial draft cannot be confirmed until an
  employee edit is saved; confirmation produces a visible neutral receipt stating that Project
  progress and employee evaluation did not change.
- Preserved manual evidence when connectors are unavailable and retained the existing Connected
  Context, Private Inbox, Timeline, and evidence-review routes for rollback.
- Added `AI_NATIVE_SOURCE_REVIEW_ENABLED=false` to restore the previous source surfaces without
  deleting confirmed evidence or history.
- Enforced `employee_edit` in the Evidence domain before any GitHub-linked evidence can be
  confirmed, including truthful manual-execution drafts submitted directly to the API.
- Filtered excluded Google context before composition and remove a dismissed source from the local
  queue immediately after the protected exclusion command succeeds.

## Files changed

- Source-review UI and focused tests under `apps/web/src/features/source-review/`.
- Browser composition gateway and tests under `apps/web/src/platform/source-review-api*`.
- Rollback flag under `apps/web/src/server/source-review/`.
- My Work wiring, evidence-prefill support, and focused CSS under `apps/web/src/app/`.
- English and Arabic catalogs under `packages/localization/src/catalogs/`.

## Database changes

None. T093 uses existing Connected Work, Private Inbox, Timeline, and Evidence records and commands.

## Verification

- Focused source, gateway, evidence, same-origin route, and rollback tests: 7 files, 65 tests passed.
- Connected Work/Evidence domain and HTTP authorization/privacy integration: 4 files, 51 tests
  passed against the local test database.
- `@evaluation/web` typecheck and Next production compile: passed.
- `@evaluation/updates-evidence` and `@evaluation/connected-work-context` typechecks: passed.
- The original T093 `@evaluation/web` production build, including static generation, passed before
  this bounded correction cycle; the correction cycle re-proved the affected compile/type boundary.
- Affected ESLint, Prettier, and `git diff --check`: passed.

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

The controller completed the authenticated browser journey on 2026-08-12:

- The employee reviewed real Gmail/Calendar metadata in the owner-private queue and linked a source
  to the selected Project.
- A manual source created an evidence draft, required an employee revision, and then confirmed with
  the neutral receipt “confirmed by you”; the receipt states that neither Project progress nor
  employee evaluation changed.
- A manager-only session showed the authorized manager shell but no source-review section, private
  Google titles, or manual-evidence action.
- The accepted screenshots are `docs/product/screenshots/ai-native-phase-1/t093-source-review.png`,
  `t093-evidence-confirmation.png`, and `t093-private-context-denied.png`.

The live journey also exposed and fixed two bounded presentation-boundary defects before closure:

- Evidence responses can contain an internal `githubSourceEventId`; the same-origin gateway now
  removes internal-only fields before strict browser validation.
- Manager/administrator-only workspaces no longer render the employee-private source review or its
  manual capture action.

T093 is complete. T094 final acceptance is now in progress; no route was retired or merged.
