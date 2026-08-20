# P3-12 — Ownership and role matrix report

## Status

DONE — implementation commits `067853f`, `77badf9`, `5c63939`, and `8570a5f`; the real local Codex employee journey was verified on 14 August 2026.

## What changed

- Added a versioned, server-composed ownership projection to the existing Employee Project Experience contract.
- Derived the visible effective role from server-authorized responsibility windows plus the authenticated server-side manager role: owner, contributor, manager, or acting owner.
- Added a compact Command Brief-aligned Ownership and access panel to the existing Project Workspace. It shows current owner, the viewer role, active window, contributors, the coordination-not-manager boundary, and manager-only human-transfer context.
- Added English and Arabic catalog content; the Project surface continues to set RTL for Arabic.
- Remediation: moved transfer visibility and candidate selection to the Projects-owned scoped policy projection. A manager receives candidates only when the Projects policy permits `responsibility.transfer` for that Project's department.
- Remediation: added a compact manager-only ownership transfer form. It calls the existing protected Project transfer command, requires a human-selected owner, effective timestamp, transfer type, acting end when applicable, reason, and optimistic-concurrency version; a 409 result asks the manager to reload current responsibility before retrying.
- Remediation: acting ownership projection now exposes the prospective named return owner when the append-only return responsibility is scheduled.
- Remediation: former participants receive the intentionally content-free `access: ended` experience with safe Project-list navigation.
- Follow-up: the manager form now gives a read-only, localized continuity-impact summary. Permanent handoffs start a new responsibility window; acting coverage names the return owner. Both preserve historical attribution.

## Files changed

- `packages/contracts/src/employee-experience.ts`
- `apps/api/src/daily-work/daily-work.controller.ts`
- `apps/api/src/daily-work/project-experience-query.service.ts`
- `apps/api/src/daily-work/project-experience-query.service.test.ts`
- `apps/web/src/features/project-experience/project-experience-model.test.ts`
- `apps/web/src/product-ui/project/project-workspace.tsx`
- `apps/web/src/product-ui/project/project-workspace.module.css`
- `apps/web/src/product-ui/project/project-workspace.test.tsx`
- `apps/web/src/app/[locale]/projects/ownership-actions.ts`
- `apps/web/src/product-ui/project/project-ownership-transfer.tsx`
- `packages/localization/src/catalogs/en.json`
- `packages/localization/src/catalogs/ar.json`
- `packages/projects/src/project-service.integration.test.ts`
- `docs/product/screenshots/ai-native-final-design/p3-12-ownership-en.png`

## Database changes

None.

## TDD and verification evidence

- RED observed: the focused Project Workspace test could not find the new `Ownership and access` area.
- RED observed: the Project Experience service returned no `ownership` projection for owner, contributor, manager, or acting-owner cases.
- RED observed: the manager transfer form had no continuity-impact summary for permanent versus acting coverage.
- GREEN: focused unit/API tests — 64 tests passed; Projects integration ownership projection — 13 tests passed.
- GREEN: follow-up focused Project Workspace test — 4 tests passed; Projects integration projection/authorization matrix — 14 tests passed.
- GREEN: protected API matrix — 53 controllers and 29 policy rows valid.
- Type checks passed for Contracts, API, and Web.
- Web lint passed.
- Production Web build passed.
- `git diff --check` passed.
- Real local browser verification passed at
  `http://localhost:3000/en/projects/c2ab037e-e945-4ed9-a6cd-756099e2b066` using the actual
  PostgreSQL Project and a real short-lived OIDC session for the synthetic `Codex` employee. The
  page rendered the contributor-safe ownership projection, current owner, active window, Project
  document version, source-backed work/evidence, truthful missing Progress Contract state, and the
  Project Assistant next action.
- Captured browser evidence:
  `docs/product/screenshots/ai-native-final-design/p3-12-ownership-en.png`.

## Security and privacy impact

- The browser receives only the existing server-authorized workspace facts plus a narrow ownership projection.
- The UI does not make authorization decisions. Transfer context and safe candidate names are visible only when the Projects-owned, department-scoped `responsibility.transfer` policy projection permits that specific Project action.
- Owner coordination remains explicitly distinct from manager authority. No performance, readiness, or activity metrics were introduced.

## Remaining risk

- The focused composed integration matrix now proves: a current contributor receives no transfer projection and is denied by the protected transfer service; a current acting owner has named return coverage but no transfer capability; and the same actor becomes `access: ended` after acting coverage expires and remains denied. Existing protected authorization coverage separately proves owner-not-manager and wrong-department manager denial. No client-side authority was added.
- A fresh dogfood document upload remains blocked by the local ClamAV container becoming unhealthy
  under the current emulated local runtime. The safety gate was not bypassed, and the existing
  approved Project document/history was used for the live verification. This is a local operational
  dependency issue, not a P3-12 authorization or UI defect.

## Project state

Updated: P3-12 is complete. The next bounded action is the P3-13 Auto + Undo eligibility gate; no
automatic action may be enabled without a real compensation path and durable recovery receipt.
