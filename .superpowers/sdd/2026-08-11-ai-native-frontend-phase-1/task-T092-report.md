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

- Initial focused Work UI, model, rollback, shell, gateway, and protected controller proof: 7 files,
  61 tests passed.
- Selection-race and reauthentication-return regressions: 2 files, 12 tests passed.
- Authoritative allowed-transition serialization and UI proof: 4 files, 48 tests passed.
- `@evaluation/web` typecheck, including Next production compile: passed.
- `@evaluation/contracts` and `@evaluation/work-items` typechecks: passed.
- Affected ESLint, Prettier, and `git diff --check`: passed.
- Independent corrected-findings review: passed with no remaining P0/P1.
- Authenticated Arabic browser journey: created one Project-linked task, moved it from `planned` to
  `ready` and then `in_progress`, and verified the URL-owned drawer, list refresh, RTL, and 390px
  bottom navigation without a false stale-state error.

## Security / privacy / AI impact

- Protected actor identity continues to come from the server session; the transition proxy rejects
  caller-controlled actor fields.
- `WorkItemsPolicyGuard` remains authoritative for read/create/transition allow/deny decisions.
- No new assignment or update authority was added. Project/Workstream ownership is not treated as
  task mutation authority.
- No AI/provider call, evidence inference, Project progress, readiness value, rating, ranking, or
  productivity score was added.

## Product acceptance

Accepted on 2026-08-12. Evidence is stored in:

- `docs/product/screenshots/ai-native-phase-1/t092-work-list.png`
- `docs/product/screenshots/ai-native-phase-1/t092-task-detail.png`
- `docs/product/screenshots/ai-native-phase-1/t092-ar-mobile.png`

Board, Calendar, My Work, and the legacy list remain available for immediate rollback. Their final
retirement disposition remains a T094 Product Owner decision.
