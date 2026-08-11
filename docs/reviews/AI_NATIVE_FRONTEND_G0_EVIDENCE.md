# AI-Native Frontend Gate G0 Evidence

**Date:** 2026-08-11

**Branch:** `codex/ai-native-frontend-phase-0b`

**Gate state:** Technical evidence complete; Product Owner decision required
**Visual direction:** Command Brief (D0 approved)

## Executive result

Phase 0B establishes the frontend foundation without implementing Phase 1 runtime. The Stable Shell,
design tokens, accessible primitives, Storybook review surface, import boundaries, protected
Inspection Mode, route-retirement ledger, and executable Phase 1 graph are present and verified.

The technical recommendation is **proceed to the Product Owner G0 decision**. This document does not
approve G0, merge the branch, or authorize T087–T094.

## Capability and handoff reconciliation

| Evidence | Result |
| --- | --- |
| Engine capability distribution | Exactly 44 records: **39 COMPLETE, 2 PARTIAL, 2 EXTERNAL_GATE, 1 DEFERRED_APPROVED** |
| Frontend capability handoffs | 16 Phase 1–3 handoffs validated |
| Exact Phase 1–2 implementation handoffs | 10/10 validated against current APIs, readers, commands, guards, tests, events, and rollback paths |
| Work Signals | 14 closed keys |
| Experience Workflow Events | 6 closed keys |
| Telemetry eligibility | 7 minimized keys; collection remains disabled |
| Current route inventory | 20/20 routes classified with parity, approval, and rollback requirements |
| Executable task graph | 94 tasks valid; T087–T094 defined and still blocked |

The ten exact handoffs classify assistance without weakening authority: deterministic reads and
commands remain owned by their engine domains; AI preparation is routed through the existing AI
Router; Google and GitHub material stays private or suggested until the required human confirmation;
`NONE` means a declared later backend delta, never a browser inference.

## Architecture and protected-boundary proof

- There is no master agent, second AI Router, frontend agent framework, microfrontend, or global
  business store.
- Chat remains a future channel into governed capabilities, not a new authority.
- Browser state is limited to presentation, selection, drawers, dialogs, drafts, and focus return.
- Product telemetry cannot import protected content and cannot feed orchestration, permissions,
  autonomy, Project progress, evidence, evaluation, readiness, or manager decisions.
- The frontend boundary validator passed across 1,090 source files. The general source-boundary
  validator also passed across the same 1,090 files.
- Generated `.next`, `dist`, and `storybook-static` output is excluded from source-boundary analysis;
  an isolated regression fixture proves generated files cannot cause false source findings or memory
  exhaustion.
- Protected product rules remain unchanged: AI does not rate, rank, score, or recommend employee
  performance; Project progress remains independent from employee performance.

## Interaction, localization, and visual evidence

| Condition | Evidence | Result |
| --- | --- | --- |
| Keyboard and visible focus | Storybook browser interactions and primitive compatibility tests | Pass |
| Dialog focus trap, Escape, and focus return | Browser compatibility and focused-dialog tests | Pass |
| Accessibility | Storybook accessibility gate configured as error; 5/5 browser stories pass | Pass |
| English/LTR and Arabic/RTL | Stable Shell stories, localization tests, and authenticated E2E | Pass |
| Desktop and 390px mobile | Equal-size desktop comparison plus four desktop/mobile role journeys | Pass |
| Reduced motion and contrast | Semantic motion provider and normal/high-contrast stories | Pass |
| Loading, empty, error, and recovery | Dedicated review states and recovery interaction | Pass |
| Visual fidelity | `design-qa.md` final result is `passed` | Pass |

Primary screenshots:

- `docs/product/screenshots/ai-native-phase-0b/stable-shell-command-brief-comparison.png`
- `docs/product/screenshots/ai-native-phase-0b/stable-shell-story-en-desktop.png`
- `docs/product/screenshots/ai-native-phase-0b/stable-shell-story-ar-manager-mobile.png`

## Bounded participant sessions

### Daily employee session

The Product Owner selected Command Brief, reviewed the runnable Arabic employee route, emphasized a
simple daily employee journey, and approved D0 on 2026-08-11. The authenticated employee E2E session
then confirmed Today, Work, Projects, Research, Evaluation, locale switching, keyboard navigation,
global entries, and recovery at desktop and 390px.

### Manager / Project-owner session

The role-correct manager journey was exercised in Storybook and authenticated E2E in English and
Arabic at desktop and 390px. It exposes manager operations and does not expose employee Capture.
There was **no separate independent manager participant**; participant overlap is recorded rather
than represented as two humans. The Product Owner G0 decision must explicitly accept this bounded
overlap or request a direct manager session before authorizing Phase 1.

## Full G0 verification matrix

All commands used the repository-required Node.js 24 runtime.

| Command | Fresh result |
| --- | --- |
| `pnpm validate:frontend-capabilities` | Pass — 44 records; 39/2/2/1 distribution; 16 handoffs |
| `pnpm validate:frontend-events` | Pass — 14 Work Signals, 6 Experience Events, 7 telemetry keys; collection disabled |
| `pnpm validate:frontend-handoffs` | Pass — 10 exact handoffs |
| `pnpm validate:frontend-boundaries` | Pass — 1,090 files |
| `pnpm validate:frontend-routes` | Pass — 20/20 routes |
| `pnpm validate:task-graph` | Pass — 94 tasks |
| `pnpm scan:secrets` | Pass — 1,681 files |
| `pnpm scan:performance-inputs` | Pass — 878 files |
| `pnpm format:check` | Pass |
| `pnpm lint` | Pass — 32/32 packages, 1,090 source boundaries, visible-copy check |
| `pnpm typecheck` | Pass — 32/32 packages |
| `pnpm test:coverage` | Pass — 227 files, 1,427 tests; 33.51% statements, 35.07% lines |
| `pnpm test:storybook` | Pass — 5/5 browser tests |
| `pnpm build:storybook` | Pass |
| `pnpm build` | Pass — 32/32 packages |
| focused Stable Shell E2E | Pass — 4/4 Chromium journeys |

The Phase 0B diff does not change database behavior, migrations, backup/restore, provider prompts,
AI evaluation schemas, or shared engine integration behavior. Per the approved plan, those unrelated
full suites were not rerun.

## Failures found and bounded corrections

The first G0 run exposed test-infrastructure and generated-output issues, not product behavior:

1. Storybook browser tests were discovered by the unit coverage project. They now have their own
   project exclusion.
2. The CI policy fixture was missing the existing `msw: false` allow-build entry.
3. Two repository tests matched an obsolete exact configuration string. They now assert each required
   exclusion independently.
4. Boundary tests created temporary forbidden files inside the live source tree. All generated and
   rejection fixtures now use isolated temporary repository roots, and no live fixture remains.
5. The source-boundary scanner entered generated `storybook-static` bundles and exhausted memory.
   Generated Storybook output is now explicitly ignored and regression-tested.
6. The shell brand mark was a hard-coded visible string. It now comes from the English/Arabic catalog.

No business rule, authorization rule, AI rule, evaluation rule, or database behavior changed.

## Retention and rollback

- All 20 current routes remain present. No temporary route was removed.
- A route may be removed only after parity evidence and Product Owner approval.
- Every retirement record has a release-artifact rollback path.
- Phase 1 entries in the shell are truthfully inert; they do not simulate SSE, proactive Today,
  orchestration, capture intelligence, or What Changed runtime.
- Rolling back Phase 0B means returning to the retained pre-Phase-0B routes and release artifact; no
  migration or historical-data rollback is required.

## Deferred P2/P3 observations

| Priority | Observation | Disposition |
| --- | --- | --- |
| P2 | No independent manager participant session occurred | Product Owner acknowledges at G0 or requests one direct session |
| P2 | Future Agent inspection trace should require prompt version and AI Router run ID | Carry into the protected T089/T094 implementation backlog; not Phase 0B runtime |
| P3 | Vite warns that an extensionless config import may be unsupported by a future native loader | Defer until the toolchain changes; current test and build gates pass |
| P3 | Storybook review bundles report large chunks | Review-only artifact; production build is separate and passes |

## Explicit stop statement

**Phase 1 runtime has not started.** No Work Signal runtime, Experience Orchestrator, proactive Agent,
production Intelligent Today composition, What Changed SSE, universal-capture intelligence, or new
business store was implemented in Phase 0B.

The next authorized action is the Product Owner's explicit G0 decision. T087–T094 remain blocked.
