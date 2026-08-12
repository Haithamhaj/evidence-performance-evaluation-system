# T090 implementation report

## Outcome

Implemented the production Intelligent Today vertical slice behind a server-read rollback flag. The
screen now opens with the bounded Command Brief order: Needs Your Decision, one Prepared for You
item, Needs My Action, Today, and Overdue. The previous My Work screen remains available when
`AI_NATIVE_INTELLIGENT_TODAY_ENABLED=false`.

## Changes

- Added a deterministic Today model that preserves Needs My Action, Today, and Overdue ordering and
  associates visible Project names without inventing progress or performance meaning.
- Added one owner-authorized Context Intelligence Project suggestion with source, why, freshness,
  consequence, and real confirm/correct/dismiss commands.
- Implemented dismissal through the existing correction-to-null command, preserving the private
  source candidate without creating evidence or changing Project progress.
- Added stale-command recovery that keeps the employee's correction visible and reloads the current
  review item before another decision.
- Added one editable prepared item from the T089 orchestration reader. Opaque source references are
  mapped to localized display labels and are not exposed in the interface.
- Added a narrow same-origin prepared-experience gateway and web-local strict validation boundary so
  the browser receives no API credential and the Next build does not depend on a package source
  barrel.
- Added English and Arabic localization, RTL layout, keyboard focus, forced-colors support, reduced
  motion, an accessible Storybook journey, and a 390px mobile overflow check.
- Extended the existing protected Context HTTP integration test to deny manager-only and cross-user
  confirm/correct/dismiss actions while retaining the owner-positive path.

## Files changed

- Intelligent Today UI and tests under `apps/web/src/product-ui/today/`.
- Decision and prepared cards under `apps/web/src/features/prepared-decision/`.
- Today composition under `apps/web/src/features/today/`.
- Web gateways/contracts under `apps/web/src/platform/` and the daily-work same-origin route.
- My Work route/client wiring and rollback flag under `apps/web/src/app/` and
  `apps/web/src/server/today/`.
- English/Arabic catalogs and the focused Context authorization integration test.

## Database changes

None.

## Verification

- Focused unit: 5 files, 46 tests passed.
- Focused Context HTTP integration: 1 file, 16 tests passed.
- Storybook browser journey: 2 tests passed (Arabic RTL/keyboard/axe and 390px viewport).
- Affected ESLint: passed.
- Affected Prettier check: passed.
- `@evaluation/web` typecheck: passed, including Next production compile.
- `@evaluation/web` production build: passed, including compile, TypeScript, and static generation.
- `git diff --check`: passed.

## Security / privacy / AI impact

- Every decision remains owned by `ContextIntelligenceWorkflow`; the UI does not mutate domain state
  directly.
- Positive owner authorization and negative manager/cross-employee authorization are verified at the
  protected server API.
- Dismissal creates no evidence or Project progress event.
- The prepared item consumes the existing T089 AI Router result and adds no provider SDK call or new
  AI route.
- The screen exposes display-safe source metadata only; no browser credential or opaque internal
  source identifier is rendered.
- No rating, ranking, readiness percentage, productivity score, or calculated Project progress was
  added.

## Remaining bounded acceptance

The controller completed the authenticated Arabic and English production journey and the fresh
Storybook decision/recovery journeys. The required evidence is stored as
`t090-today-en-desktop.png`, `t090-today-ar-mobile.png`, and `t090-stale-recovery.png` under
`docs/product/screenshots/ai-native-phase-1/`. The real employee surface loaded the persisted T089
prepared item and overdue Task; the synthetic decision story exercised the bounded 409 recovery
because the current employee had no pending real Context suggestion. Visual comparison confirmed
the selected Command Brief hierarchy, compact grouping, mobile stacking, and RTL direction. The
broader shell/navigation remains the already-approved T085 surface and is not duplicated in the
component-level recovery proof.

One implementation review and one corrected-findings re-review found no remaining P0/P1. No T091
streaming/SSE or T092 Task parity was implemented.
