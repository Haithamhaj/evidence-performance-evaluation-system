# P3-14 — Contract-based Project charts

## Status

TECHNICALLY COMPLETE — protected Project Owner visual gate remains.

## What changed

- The Project workspace renders progress visuals only when the authoritative projection contains an
  accepted Progress Contract and a verified measurement.
- The accepted state combines the approved circular progress indicator, previous/current summary,
  contract KPI, milestone path, source label, and a visible accessible data table.
- The no-contract state renders no percentage, chart image, or progress table. It explains exactly
  why the visualization is unavailable.
- English and Arabic copy explicitly excludes Task, Update, and GitHub activity volume from progress.

## Files changed

- `apps/web/src/product-ui/project/project-workspace.tsx`
- `apps/web/src/product-ui/project/project-workspace.module.css`
- `apps/web/src/product-ui/project/project-workspace.test.tsx`
- `packages/localization/src/catalogs/en.json`
- `packages/localization/src/catalogs/ar.json`
- `docs/product/screenshots/ai-native-final-design/p3-14-progress-contract-empty-en.png`
- `design-qa.md`
- `project-state/PROJECT_STATE.md`
- `.superpowers/sdd/2026-08-11-ai-native-frontend-master-plan/progress.md`
- `.superpowers/sdd/2026-08-11-ai-native-frontend-master-plan/task-P3-14-report.md`

## Database changes

None.

## Verification

- Focused Project workspace tests cover both the accepted contract/table state and the truthful
  no-contract state.
- Localization and web type checks, web lint, and the production web build passed after the change.
- The authenticated Codex contributor Project was opened in the in-app browser. It showed the real
  no-contract state, the authorized owner, and Codex's contributor role with no console errors.
- The browser screenshot is committed at
  `docs/product/screenshots/ai-native-final-design/p3-14-progress-contract-empty-en.png`.

## Security and privacy impact

- No permission, role, persistence, AI route, or protected command changed.
- The browser consumes the existing authorized Project projection only.
- The UI cannot manufacture progress from Task completion, Update frequency, GitHub activity, files,
  commits, or employee activity.

## Remaining protected gate

The real Codex Project has no approved Progress Contract. Codex is a contributor and cannot activate
one. The authorized Project Owner must review and activate a measurable contract before the active
circle/KPI/table state can be visually accepted on real data. No synthetic percentage was inserted to
bypass this gate.

## Project state

Updated. P3-15 capability closure must wait for this Project Owner visual acceptance gate.
