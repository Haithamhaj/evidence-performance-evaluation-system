# P3-12 — Ownership and role matrix report

## Status

DONE_WITH_CONCERNS

## What changed

- Added a versioned, server-composed ownership projection to the existing Employee Project Experience contract.
- Derived the visible effective role from server-authorized responsibility windows plus the authenticated server-side manager role: owner, contributor, manager, or acting owner.
- Added a compact Command Brief-aligned Ownership and access panel to the existing Project Workspace. It shows current owner, the viewer role, active window, contributors, the coordination-not-manager boundary, and manager-only human-transfer context.
- Added English and Arabic catalog content; the Project surface continues to set RTL for Arabic.

## Files changed

- `packages/contracts/src/employee-experience.ts`
- `apps/api/src/daily-work/daily-work.controller.ts`
- `apps/api/src/daily-work/project-experience-query.service.ts`
- `apps/api/src/daily-work/project-experience-query.service.test.ts`
- `apps/web/src/features/project-experience/project-experience-model.test.ts`
- `apps/web/src/product-ui/project/project-workspace.tsx`
- `apps/web/src/product-ui/project/project-workspace.module.css`
- `apps/web/src/product-ui/project/project-workspace.test.tsx`
- `packages/localization/src/catalogs/en.json`
- `packages/localization/src/catalogs/ar.json`

## Database changes

None.

## TDD and verification evidence

- RED observed: the focused Project Workspace test could not find the new `Ownership and access` area.
- RED observed: the Project Experience service returned no `ownership` projection for owner, contributor, manager, or acting-owner cases.
- GREEN: `pnpm exec vitest run --project unit apps/web/src/product-ui/project/project-workspace.test.tsx apps/web/src/features/project-experience/project-experience-model.test.ts apps/api/src/daily-work/project-experience-query.service.test.ts` — 13 tests passed.
- Type checks passed for Contracts, API, and Web.
- Web lint passed.
- Production Web build passed.
- `git diff --check` passed.

## Security and privacy impact

- The browser receives only the existing server-authorized workspace facts plus a narrow ownership projection.
- The UI does not make authorization decisions. Transfer context is visible only when the server-side authenticated role contains `manager` and the existing Projects reader has already authorized the Project.
- Owner coordination remains explicitly distinct from manager authority. No performance, readiness, or activity metrics were introduced.

## Remaining risk / not yet closed

- This bounded change does **not** implement the required fail-closed, user-visible ended-access response. Current Projects authorization still denies ended access, but the final Project page has no dedicated access-ended recovery state.
- The manager context is explanatory only; it does not yet provide the required executable ownership-transfer form with new-owner selection, effective date, transfer type, continuity, reason, expected version, and stale conflict recovery.
- Planned return-owner identity remains unavailable in the current safe workspace projection, so acting-owner UI can show its end but not the named planned return owner.
- The focused test matrix covers server-derived owner/contributor/manager/acting roles, but does not add the requested positive/negative integration authorization matrix for ended access, wrong-department manager, or expired acting owner.
- No local browser demo/screenshot was captured and no preview was started, to avoid disturbing existing running services.

## Project state

Not updated: P3-12 is not fully verified against the required five-state outcome.
