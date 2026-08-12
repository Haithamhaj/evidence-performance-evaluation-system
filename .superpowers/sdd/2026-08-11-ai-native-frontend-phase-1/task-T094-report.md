# T094 implementation report

## Outcome

Completed the bounded Phase 1 technical acceptance journey and prepared the protected Product Owner
route decision. No route was retired and no pull request was merged.

## Changes

- Added a deterministic end-to-end employee journey covering private Capture, durable What Changed,
  Project-linked Work creation/transition, and GitHub evidence edit/confirmation.
- Added a manager-safe journey that lands the manager on operational queues and proves the absence of
  employee-private Capture and Source Review.
- Added an explicit rollback journey covering retained Today, Work, source, refresh, Board, and
  Calendar surfaces.
- Made `/[locale]` role-aware so manager and administrator accounts land on their authorized homes;
  the employee Today assistant remains employee-only.
- Published technical acceptance and a non-destructive route-retirement recommendation.

## Files changed

- `apps/web/src/app/[locale]/page.tsx`
- `apps/web/src/app/[locale]/my-work/page.tsx`
- `apps/web/src/product-ui/shell/shell-model.ts` and focused test
- `apps/web/src/server/today/intelligent-today-flag.ts` and focused test
- `tests/e2e/ai-native-phase-1/phase-1-acceptance.spec.ts`
- `tests/e2e/fixtures/workspace-api-server.mjs`
- Phase 1 acceptance, decision, screenshots, task, and project-state artifacts

## Database changes

None. The acceptance fixture is deterministic and isolated. Production records and migrations are
unchanged.

## Verification

- Employee and manager browser acceptance: 2/2 passed.
- Explicit rollback browser acceptance: 1/1 passed.
- Role/feature-flag focused unit tests: 13/13 passed.
- Web direct TypeScript check: passed.
- Final lint, format, route/task validators, secret scan, and affected build are recorded in the
  acceptance commit: web lint/typecheck/build, frontend boundaries, route ledger, task graph,
  secrets, Prettier, and diff checks all passed.

## Security / privacy impact

Manager/admin entry is now role-aware. Employee-only Intelligent Today, Capture, and Source Review do
not render in manager/administrator-only workspaces. Server-side domain authorization remains the
authority; this routing change does not widen any permission.

## Remaining risk

Live external-provider behavior still depends on deployment credentials and consent. The Source
Review list will benefit from later pagination/grouping for large mailboxes. Neither issue changes the
protected confirmation and privacy boundaries.

## Product Owner gate

Technical acceptance is complete. T094 remains at the explicit Product Owner gate for the running
journey, non-destructive route disposition, and next-phase authorization.
