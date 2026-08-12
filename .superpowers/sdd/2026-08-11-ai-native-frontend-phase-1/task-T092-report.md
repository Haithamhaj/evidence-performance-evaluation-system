# T092 implementation report

## Outcome

Implemented the compact Command Brief Work list and focused task-detail drawer behind a server-read
rollback flag. The surface uses the existing authorized Work Items readers and create/transition
commands; it does not recreate domain transition rules in the browser.

## Changes

- Added a compact Project-linked Work list with My/Team scope links and retained Board/Calendar
  destinations.
- Added URL-owned task selection, authoritative detail loading, Escape/backdrop close, and focus
  return to the originating row.
- Added existing protected create and transition parity. Stale transitions reload the authoritative
  task; denied access is displayed without widening authority.
- Added English/Arabic copy, RTL layout, mobile bottom-sheet detail, keyboard focus, forced-colors,
  and reduced-motion handling.
- Added `AI_NATIVE_WORK_WORKSPACE_ENABLED=false` rollback. It restores the existing Tasks/My Work
  navigation and legacy list without changing Work Item records or append-only history.
- Kept the existing Board and Calendar implementations available through the retained `/tasks`
  route. Assignment and general update authority were not added to the new drawer.

## Files changed

- Work UI under `apps/web/src/product-ui/work/`.
- Work-list model and task-detail drawer under `apps/web/src/features/`.
- Browser Work Items gateway and strict same-origin read/transition proxy contracts.
- Tasks page and Stable Shell routing adapters plus rollback flag.
- English and Arabic localization catalogs and focused tests.

## Database changes

None. T092 uses existing Work Item records, version checks, and append-only history.

## Verification

- Focused Work UI, model, rollback, shell, and same-origin gateway proof: 5 files, 35 tests passed.
- Existing Work Items protected controller allow/deny proof: 5 tests passed.
- `@evaluation/web` typecheck, including Next production compile: passed.
- Affected ESLint, Prettier, and `git diff --check`: passed.

## Security / privacy / AI impact

- Protected actor identity continues to come from the server session; the transition proxy rejects
  caller-controlled actor fields.
- `WorkItemsPolicyGuard` remains authoritative for read/create/transition allow/deny decisions.
- No new assignment or update authority was added. Project/Workstream ownership is not treated as
  task mutation authority.
- No AI/provider call, evidence inference, Project progress, readiness value, rating, ranking, or
  productivity score was added.

## Remaining bounded acceptance

The controller must capture the authenticated English Work list, open task detail, and Arabic mobile
states, then the Product Owner compares the new list with the retained route before any retirement
decision. Board/Calendar and the legacy list remain available for immediate rollback.
