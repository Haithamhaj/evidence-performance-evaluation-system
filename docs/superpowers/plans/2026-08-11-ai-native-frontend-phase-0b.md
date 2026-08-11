# AI-Native Frontend Phase 0B Implementation Plan

> **For agentic workers:** Execute this plan with `superpowers:executing-plans` in bounded bundles.
> Use `superpowers:subagent-driven-development` only for the protected Inspection Mode authorization
> boundary. Complete one independent review per normal bundle, fix only confirmed P0/P1 findings, and
> do not restart reviews from zero.

**Goal:** Convert the approved Command Brief experience into the smallest production frontend
foundation needed for Phase 1–2, then stop at Gate G0 before building Intelligent Today or any Agent
runtime.

**Architecture:** Keep the existing Next.js application and modular-monolith engine. Add owned UI
wrappers, tokens, Storybook/browser tests, explicit frontend import boundaries, and a role-aware
Stable Shell around the existing routes. The browser remains a presentation/composition client: it
does not own business truth, authorization, project progress, evidence, evaluation, or agent
decisions.

**Technology:** Next.js 16, React 19, TypeScript 7, CSS Modules, cascade layers, React Aria
Components, Lucide, Motion, Storybook 10, Vitest Browser Mode, Playwright, Testing Library, and MSW
only in stories/tests. All new dependency versions are exact pins.

**Approved sources:**

- `docs/superpowers/plans/2026-08-11-ai-native-frontend-master-plan.md`
- `docs/product/AI_NATIVE_EXPERIENCE_BLUEPRINT.md`
- `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- `docs/product/AI_NATIVE_PHASE_1_3_HANDOFFS.md`
- `docs/product/ai-native-frontend-capabilities.json`
- `docs/product/AI_NATIVE_EVENT_TAXONOMY.md`
- `docs/decisions/AI_NATIVE_FRONTEND_D0_DECISION.md`
- `docs/reviews/AI_NATIVE_FRONTEND_D0_EVIDENCE.md`

## Non-negotiable boundaries

1. No `WorkSignalV1` runtime, Experience Orchestrator, production Today composition, SSE runtime,
   or proactive Agent is implemented before G0.
2. No master agent, second AI Router, second store, generic activity platform, global business
   client store, microfrontend, or package-per-screen structure.
3. Work Signals, Experience Workflow Events, and Product Telemetry remain different contracts and
   import zones. Product Telemetry cannot influence progress, evidence facts, evaluation, manager
   decisions, or autonomy.
4. The existing temporary routes remain available until a later route has parity evidence, a
   rollback path, and an approved removal gate.
5. Role-aware navigation is convenience, not authorization. Every protected read and command stays
   server-enforced.
6. AI never produces or recommends a rating, employee rank, productivity score, or manager judgment.
7. Arabic/RTL foundations are supported in the shell and primitives. Arabic employee evaluation
   stays blocked by T016.
8. The discarded `experimental/clickup-multi-agent-ui` branch contributes no code, schema,
   dependency, asset, screenshot, branding, or data.
9. Run focused checks after each task, affected integration checks after each bundle, and the full
   repository suite once at G0. Do not repeat the full suite after small corrections.

## Delivery sequence

| Bundle                                    | Tasks     | Durable checkpoint                              |
| ----------------------------------------- | --------- | ----------------------------------------------- |
| A — Contracts and visual foundation       | T078–T080 | Commit, push, update Phase 0B PR                |
| B — Review and boundary infrastructure    | T081–T082 | Commit, push, update Phase 0B PR                |
| C — Stable Shell and protected inspection | T083–T084 | Commit, push, update Phase 0B PR                |
| D — Phase 1 graph and G0                  | T085–T086 | Commit, push, record G0; stop for Product Owner |

### Approved-scope mapping

| Master-plan item                          | Implemented by |
| ----------------------------------------- | -------------- |
| P0B-01 Architecture ADRs                  | T078           |
| P0B-02 Exact Phase 1–2 handoffs           | T078           |
| P0B-03 Approved tokens                    | T079           |
| P0B-04 Primitive compatibility/adoption   | T080           |
| P0B-05 Styling foundation                 | T079–T080      |
| P0B-06 Storybook/test/a11y/RTL foundation | T081           |
| P0B-07 Frontend and telemetry boundaries  | T082           |
| P0B-08 Stable Shell                       | T083           |
| P0B-09 Global shell entries               | T083           |
| P0B-10 Inspection Mode contract           | T084           |
| P0B-11 Route retirement ledger            | T084           |
| P0B-12 Phase 1 task graph                 | T085           |
| Gate G0 evidence and decision             | T086           |

---

## Task T078 — Freeze Phase 0B architecture and exact Phase 1–2 handoffs

**Purpose:** Make every later frontend slice traceable to a real engine reader, command, state,
signal, stream, and test without inventing business behavior in the browser.

**Files:**

- Create: `docs/architecture/ADR-0002-ai-native-frontend-foundation.md`
- Create: `docs/product/AI_NATIVE_PHASE_1_2_IMPLEMENTATION_HANDOFFS.md`
- Create: `docs/product/ai-native-phase-1-2-handoffs.json`
- Create: `scripts/validate-ai-native-phase-1-2-handoffs.mjs`
- Create: `tests/repository/ai-native-phase-1-2-handoffs.test.ts`
- Modify: `package.json`
- Modify later in T085: `TASKS.md`

### Step 1: Write the failing validator test

The test must reject:

- an unknown capability ID;
- duplicate handoff IDs;
- a missing Reader or explicit `NONE` disposition;
- a Command without permission and negative-test references;
- a production SSE dependency in Phase 0B;
- an assistance classification not present in the approved taxonomy;
- any rating, ranking, productivity-score, or readiness-percentage output;
- counts other than the authoritative 44-row status totals.

Run:

```bash
pnpm exec vitest run --project unit tests/repository/ai-native-phase-1-2-handoffs.test.ts
```

Expected: fail because the validator and handoff artifact do not exist.

### Step 2: Record the architecture decisions

The ADR must decide, not merely discuss:

- routes compose feature entry points;
- features call public readers/protected commands and do not import another feature's internals;
- `product-ui` owns product composition; `packages/ui` owns generic primitives only;
- server-first initial reads and smallest-possible Client Components;
- URL owns shareable state; local client state owns drawers, local drafts, and focus return;
- no global business store or cache authority;
- future SSE consumes experience events after G0 and is not a business authority;
- agents sit above the existing AI Router and never replace domain commands;
- stable shell/adaptive content; fixed sensitive actions;
- three separate Work Signal / Experience Event / Product Telemetry systems.

### Step 3: Populate exact Phase 1–2 handoffs

Each JSON record must include:

```json
{
  "handoffId": "P1-TODAY-READ",
  "capabilityIds": ["CAP-..."],
  "phase": 1,
  "surface": "today",
  "assistanceMode": "CONTEXTUAL_STATUS_RECOVERY",
  "reader": { "owner": "...", "symbol": "...", "path": "..." },
  "commands": [],
  "states": ["loading", "ready", "empty", "stale", "error"],
  "workSignals": [],
  "experienceEvents": [],
  "sse": { "disposition": "PHASE_1" },
  "tests": { "positive": ["..."], "negative": ["..."] },
  "rollback": "Disable the feature entry and retain the temporary route."
}
```

Use repository symbols and paths that exist at the pinned `main` receipt. Use `NONE` plus a reason
where a category does not apply. Do not create production adapters in this task.

### Step 4: Implement and run the validator

Add `validate:frontend-handoffs` to the root scripts and to the integrity/quality path only after it
passes locally.

Run:

```bash
pnpm validate:frontend-capabilities
pnpm validate:frontend-events
pnpm validate:frontend-handoffs
pnpm exec vitest run --project unit tests/repository/ai-native-phase-1-2-handoffs.test.ts
```

Expected: exact authoritative counts and all handoff references pass.

### Step 5: Commit

```bash
git add docs/architecture/ADR-0002-ai-native-frontend-foundation.md \
  docs/product/AI_NATIVE_PHASE_1_2_IMPLEMENTATION_HANDOFFS.md \
  docs/product/ai-native-phase-1-2-handoffs.json \
  scripts/validate-ai-native-phase-1-2-handoffs.mjs \
  tests/repository/ai-native-phase-1-2-handoffs.test.ts package.json
git commit -m "docs: freeze phase 1 and 2 frontend handoffs"
```

---

## Task T079 — Build the approved token and styling foundation

**Purpose:** Express Command Brief as stable semantic tokens while leaving legacy screen styling
intact until route parity.

**Files:**

- Modify: `packages/ui/src/styles/tokens.css`
- Create: `packages/ui/src/styles/foundation.css`
- Create: `packages/ui/src/styles/motion.css`
- Create: `packages/ui/src/styles/token-contract.test.ts`
- Modify: `packages/ui/src/index.ts`
- Modify: `apps/web/src/app/globals.css`

### Step 1: Write the failing token contract

Test for named semantic tokens covering:

- canvas, surfaces, borders, text hierarchy, accent, focus, status, and overlays;
- compact density, spacing, radii, typography, and layer ordering;
- `inline`/`block` logical values rather than left/right ownership;
- high-contrast overrides;
- semantic durations/easings and a reduced-motion override;
- compatibility aliases for existing temporary pages.

Run:

```bash
pnpm exec vitest run --project unit packages/ui/src/styles/token-contract.test.ts
```

Expected: fail on the missing semantic contract.

### Step 2: Implement the token layers

Use owned cascade layers:

```css
@layer reset, tokens, foundation, primitives, product, utilities, legacy;
```

The new foundation must:

- derive from Command Brief, not from the synthetic prototype source files;
- use CSS logical properties and `:dir()` only where direction changes meaning;
- expose visible focus and minimum 44px touch targets where appropriate;
- preserve mixed Arabic/English identifiers and URLs;
- use `prefers-reduced-motion` and `prefers-contrast`/forced-color-safe styles;
- keep the old global selectors in `@layer legacy` until later routes reach parity.

### Step 3: Verify without visual migration

Run:

```bash
pnpm exec vitest run --project unit packages/ui/src/styles/token-contract.test.ts
pnpm --filter @evaluation/ui typecheck
pnpm --filter @evaluation/web build
```

Expected: old routes still compile and new token contracts pass.

### Step 4: Commit

```bash
git add packages/ui/src apps/web/src/app/globals.css
git commit -m "feat(ui): add command brief design tokens"
```

---

## Task T080 — Prove and adopt one accessible primitive suite

**Purpose:** Adopt only the smallest compatible primitive set behind product-owned wrappers.

**Files:**

- Modify: `packages/ui/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `packages/ui/src/actions/action-button.tsx`
- Create: `packages/ui/src/actions/action-button.module.css`
- Create: `packages/ui/src/disclosure/product-disclosure.tsx`
- Create: `packages/ui/src/disclosure/product-disclosure.module.css`
- Create: `packages/ui/src/overlays/focused-dialog.tsx`
- Create: `packages/ui/src/overlays/focused-dialog.module.css`
- Create: `packages/ui/src/icons/product-icon.tsx`
- Create: `packages/ui/src/motion/semantic-motion.tsx`
- Create: `packages/ui/src/primitives.compatibility.test.tsx`
- Modify: `packages/ui/src/index.ts`
- Create: `docs/reviews/AI_NATIVE_PRIMITIVE_COMPATIBILITY.md`

### Step 1: Add exact candidate versions

Use exact pins verified on 2026-08-11:

```text
react-aria-components 1.20.0
lucide-react 1.31.0
motion 13.1.0
```

React Aria is accepted only if the test proves React 19/Next 16 SSR and hydration, Arabic/RTL,
portals, keyboard focus, focus return, disabled state, and reduced motion. If it fails, record the
failure and test one alternative; never ship two suites.

### Step 2: Write the compatibility tests first

Cover:

- SSR output without browser globals;
- hydrate without warning;
- keyboard activation and disabled behavior;
- dialog focus trap, Escape, and return to trigger;
- Arabic accessible names and mixed-direction text;
- reduced-motion propagation through `MotionConfig`;
- only the local icon wrapper is exported to product code.

Run the focused test and confirm RED before adding wrappers.

### Step 3: Implement thin owned wrappers

Keep product meaning out of generic primitives. Export a small API with semantic variants, logical
placement, and no direct library types in feature contracts.

### Step 4: Record the decision and verify

The decision record must list compatibility evidence, rejected alternatives, dependency/license
facts, wrapper boundary, exit strategy, and known limitations.

Run:

```bash
pnpm --filter @evaluation/ui test
pnpm --filter @evaluation/ui typecheck
pnpm --filter @evaluation/ui lint
pnpm scan:secrets
```

### Step 5: Bundle A checkpoint

Run affected checks only:

```bash
pnpm validate:frontend-capabilities
pnpm validate:frontend-events
pnpm validate:frontend-handoffs
pnpm --filter @evaluation/ui test
pnpm --filter @evaluation/ui typecheck
pnpm --filter @evaluation/web build
```

Perform one independent normal review. Fix only confirmed P0/P1 findings. Commit and push Bundle A.

---

## Task T081 — Establish Storybook, browser interaction, accessibility, and RTL review

**Purpose:** Make each new component reviewable without running the whole product or real services.

**Files:**

- Modify: `apps/web/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/.storybook/main.ts`
- Create: `apps/web/.storybook/preview.tsx`
- Create: `apps/web/.storybook/vitest.setup.ts`
- Create: `apps/web/vitest.storybook.config.ts`
- Modify: `vitest.workspace.ts`
- Create: `apps/web/src/product-ui/foundation/foundation.stories.tsx`
- Create: `apps/web/src/product-ui/foundation/foundation.module.css`
- Modify: `.github/workflows/ci.yml`

### Step 1: Pin the review/test toolchain

Use exact compatible versions:

```text
storybook 10.5.7
@storybook/nextjs-vite 10.5.7
@storybook/addon-a11y 10.5.7
@storybook/addon-docs 10.5.7
@storybook/addon-vitest 10.5.7
vite 8.2.1
@vitest/browser 4.1.10
@vitest/browser-playwright 4.1.10
@testing-library/react 16.3.2
@testing-library/user-event 14.6.3
@testing-library/jest-dom 7.0.1
@testing-library/dom 10.4.1
msw 2.15.0
msw-storybook-addon 3.0.0
```

MSW must remain in dev/test code and may not intercept production requests.

### Step 2: Add a failing browser story test

The matrix must exercise:

- English/LTR and Arabic/RTL;
- desktop and 390px viewport;
- keyboard-only interaction and visible focus;
- normal/high-contrast and reduced-motion modes;
- dialog focus and focus return;
- loading, empty, error, and recovery examples.

Set Storybook accessibility tests to fail CI on violations:

```ts
parameters: {
  a11y: {
    test: "error";
  }
}
```

### Step 3: Configure isolated Storybook scripts

Add:

```text
storybook
build:storybook
test:storybook
```

Keep the existing unit/integration projects unchanged; the Storybook browser project must not pull
repository integration tests into a browser.

### Step 4: Add CI at the smallest useful gate

Add `test:storybook` to quality and `build:storybook` to build. Do not add a second full repository
suite.

Run:

```bash
pnpm test:storybook
pnpm build:storybook
pnpm format:check
pnpm typecheck
```

### Step 5: Commit

```bash
git add apps/web/.storybook apps/web/vitest.storybook.config.ts \
  apps/web/src/product-ui/foundation apps/web/package.json package.json pnpm-lock.yaml \
  vitest.workspace.ts .github/workflows/ci.yml
git commit -m "test(web): add accessible component review foundation"
```

---

## Task T082 — Enforce frontend and telemetry import boundaries

**Purpose:** Prevent the new frontend from becoming another business layer or allowing telemetry to
influence protected decisions.

**Files:**

- Create: `scripts/validate-frontend-import-boundaries.mjs`
- Create: `tests/repository/frontend-import-boundaries.test.ts`
- Create: `tests/repository/fixtures/frontend-boundaries/valid/**`
- Create: `tests/repository/fixtures/frontend-boundaries/invalid/**`
- Create: `apps/web/src/features/README.md`
- Create: `apps/web/src/product-ui/README.md`
- Create: `apps/web/src/platform/telemetry/README.md`
- Create: `apps/web/src/server/README.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

### Step 1: Write rejection fixtures

Prove rejection of:

- feature internals imported by another feature;
- product meaning imported into `packages/ui`;
- product UI importing server-only code;
- a Client Component importing `apps/web/src/server`;
- routes importing domain persistence internals;
- telemetry imported by orchestration, evaluation, manager decisions, progress, evidence facts, or
  autonomy;
- telemetry importing protected content or tokens;
- a direct AI-provider SDK import outside `@evaluation/ai-routing`.

Also include valid composition, localization, contracts, and public reader examples.

### Step 2: Implement the validator with explicit allowlists

Analyze static import declarations and dynamic literal imports. Do not attempt undecidable general
value-flow analysis. Document aliased/reflection limitations and keep the existing layered controls:
runtime key isolation, provider-import grep, CI, and review.

Grandfather only named legacy files recorded in the route retirement ledger; new files receive no
broad exemption.

### Step 3: Add the gate and verify

Add `validate:frontend-boundaries` to root scripts and CI quality.

Run:

```bash
pnpm exec vitest run --project unit tests/repository/frontend-import-boundaries.test.ts
pnpm validate:frontend-boundaries
pnpm lint
```

### Step 4: Bundle B checkpoint

Run Storybook, boundary validators, typecheck, and the web/UI builds. Perform one independent normal
review and one bounded remediation of confirmed P0/P1 findings. Commit and push Bundle B.

---

## Task T083 — Build the Stable Shell and inert global entries

**Purpose:** Provide the production shell, role-aware navigation, mobile navigation, locale/auth,
loading/error surfaces, and Phase 1 entry points without implementing Phase 1 behavior.

**Files:**

- Create: `apps/web/src/product-ui/shell/shell-model.ts`
- Create: `apps/web/src/product-ui/shell/shell-model.test.ts`
- Create: `apps/web/src/product-ui/shell/stable-shell.tsx`
- Create: `apps/web/src/product-ui/shell/stable-shell.module.css`
- Create: `apps/web/src/product-ui/shell/desktop-navigation.tsx`
- Create: `apps/web/src/product-ui/shell/mobile-navigation.tsx`
- Create: `apps/web/src/product-ui/shell/global-actions.tsx`
- Create: `apps/web/src/product-ui/shell/stable-shell.stories.tsx`
- Create: `apps/web/src/server/shell/load-shell-context.ts`
- Create: `apps/web/src/server/shell/load-shell-context.test.ts`
- Modify: `apps/web/src/app/[locale]/workspace-shell.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/app/[locale]/error.tsx`
- Create: `apps/web/src/app/[locale]/loading.tsx`
- Modify localization catalogs and catalog contract tests

### Step 1: Test the shell model before rendering

Define navigation from the authenticated `/api/v1/me` principal, not a prototype persona switch or
decoded browser token.

Test at least:

- employee sees Today, Work, Projects, Research, Evaluation, Settings/Help as authorized;
- manager adds operational manager destinations but no employee quick-update unless also a
  contributor/owner;
- System Administrator sees administration/health but no manager decision surface by role alone;
- Project/Workstream owner coordination does not imply manager evaluation access;
- unauthorized destinations are absent while APIs remain the authority;
- locale changes preserve the current safe path and query state;
- mobile bottom navigation is compact and overflow items remain discoverable.

### Step 2: Implement the safe server context reader

Reuse the existing same-origin authenticated reader and validated principal schema. Do not expose
the access token or introduce client-side permission assumptions. Loading failure must offer login or
retry as appropriate, with a correlation-safe user message.

### Step 3: Implement the shell

The desktop and 390px shell must preserve the approved Command Brief hierarchy. Add visible entries
for:

- universal capture;
- search/command;
- chat;
- What Changed.

These entries are typed, discoverable Phase 1 slots. Before Phase 1 they must be inert/disabled with
honest localized “available in the next slice” feedback; they may not simulate production AI or
persist fake data.

### Step 4: Preserve existing routes

Wrap temporary screens without deleting them or rewriting their domain behavior. Keep a clear skip
link, focus return, route-level loading, recoverable error, locale direction, and mobile bottom nav.

### Step 5: Verify the visible outcome

Run:

```bash
pnpm exec vitest run --project unit \
  apps/web/src/product-ui/shell/shell-model.test.ts \
  apps/web/src/server/shell/load-shell-context.test.ts
pnpm test:storybook
pnpm --filter @evaluation/web build
pnpm test:e2e -- --grep "stable shell"
```

Capture desktop/390 screenshots for employee and manager in English/Arabic. Do not claim a live
Phase 1 action.

### Step 6: Commit

```bash
git add apps/web/src/product-ui/shell apps/web/src/server/shell \
  'apps/web/src/app/[locale]' packages/localization
git commit -m "feat(web): establish role-aware stable shell"
```

---

## Task T084 — Add the protected Inspection Mode contract and route retirement ledger

**Purpose:** Make internal traces diagnosable without exposing secrets, private content, hidden
reasoning, protected readiness, or rating influence; inventory every temporary route before later
retirement.

**Files:**

- Create: `packages/contracts/src/experience-inspection.ts`
- Create: `packages/contracts/src/experience-inspection.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `docs/product/AI_NATIVE_ROUTE_RETIREMENT_LEDGER.md`
- Create: `docs/product/ai-native-route-retirement-ledger.json`
- Create: `scripts/validate-ai-native-route-retirement-ledger.mjs`
- Create: `tests/repository/ai-native-route-retirement-ledger.test.ts`
- Modify: `package.json`

### Step 1: Write negative contract tests first

The contract must reject:

- prompts, chain-of-thought, access tokens, credentials, provider keys, and raw private content;
- individual Documentation Readiness values;
- rating suggestions/predictions, ranks, productivity scores, and manager judgment;
- unredacted evidence, email bodies, attachments, or Google/GitHub tokens;
- missing source/why/freshness/consequence/correlation fields;
- a deterministic path labeled as Agent-generated.

### Step 2: Define the bounded trace

Allowed fields include only redacted identifiers and operational facts:

- assistance mode and execution kind (`DETERMINISTIC`, `AGENT`, `STATUS_RECOVERY`, `MANUAL`);
- source references the current user is already authorized to see;
- localized why/freshness/consequence summary;
- schema/prompt version identifiers, AI Router run ID, fallback state, and correlation ID;
- command disposition and safe recovery action.

Access is disabled in production by default. In local/test internal mode it requires an authenticated
`system_administrator`; future private-mode source access additionally requires the existing audit
reason gate. No new business role is introduced.

### Step 3: Inventory every temporary route

Generate one ledger record per current `[locale]/**/page.tsx` route with:

- current route and purpose;
- owning engine capability IDs;
- target Phase/surface;
- parity evidence required;
- removal approval and rollback;
- current disposition (`RETAIN`, `REPLACE_AFTER_PARITY`, `PERMANENT`).

The validator must fail on an unlisted current route, a missing capability link, or premature
`REMOVE` disposition.

### Step 4: Verify the protected boundary

Run:

```bash
pnpm exec vitest run --project unit \
  packages/contracts/src/experience-inspection.test.ts \
  tests/repository/ai-native-route-retirement-ledger.test.ts
pnpm validate:frontend-boundaries
pnpm validate:frontend-routes
pnpm scan:secrets
```

Use one specification/security review for this critical authorization/privacy task, then one bounded
remediation cycle for confirmed P0/P1 findings and re-review only those findings.

### Step 5: Bundle C checkpoint

Run affected web/contracts/Storybook/boundary tests and a focused authenticated shell journey. Commit
and push Bundle C.

---

## Task T085 — Publish the executable Phase 1 task graph

**Purpose:** Turn Phase 1 into visible, independently reversible vertical slices rather than a broad
frontend rewrite.

**Files:**

- Modify: `TASKS.md`
- Create: `docs/superpowers/plans/2026-08-11-ai-native-frontend-phase-1.md`
- Create: `tests/repository/ai-native-phase-1-task-coverage.test.ts`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html` only if the implemented boundaries differ from its current
  architecture map

### Step 1: Add Phase 6 task IDs T078–T086

Record these Phase 0B tasks and their real status in `TASKS.md`. Preserve all historical T001–T077
entries. The task validator must remain green.

### Step 2: Define Phase 1 as vertical slices

Use subsequent unique task IDs and this required order:

1. Universal Capture manual behavior and recovery.
2. Work Signal and Experience Workflow Event contracts/runtime, still separate from telemetry.
3. Minimal Experience Orchestrator above the existing AI Router.
4. Intelligent Today read composition and one source-backed decision path.
5. What Changed and durable SSE delivery/reconnect.
6. Work List and Task Detail migration with parity.
7. First real GitHub/Google/manual source-to-protected-command journey.
8. Phase 1 acceptance, rollback, and route retirement decision.

Every task must name exact files/modules, public Reader/Command, permissions, assistance mode, states,
focused tests, runnable local demo, screenshots, rollback, and Product Owner stop gate. No task may
hide a protected rule in frontend acceptance copy.

### Step 3: Add graph coverage tests

Assert that each Phase 1 task maps to approved handoff IDs and capability IDs, contains rollback and
demo evidence, and depends only on known same/earlier-phase tasks.

Run:

```bash
pnpm validate:task-graph
pnpm test:task-graph
pnpm exec vitest run --project unit tests/repository/ai-native-phase-1-task-coverage.test.ts
```

### Step 4: Commit

```bash
git add TASKS.md docs/superpowers/plans/2026-08-11-ai-native-frontend-phase-1.md \
  tests/repository/ai-native-phase-1-task-coverage.test.ts project-state
git commit -m "docs: publish executable phase 1 frontend graph"
```

---

## Task T086 — Prove Gate G0 and stop for Product Owner

**Purpose:** Verify the technical foundation without pretending Phase 1 behavior exists.

**Files:**

- Create: `docs/reviews/AI_NATIVE_FRONTEND_G0_EVIDENCE.md`
- Create only after approval: `docs/decisions/AI_NATIVE_FRONTEND_G0_DECISION.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `TASKS.md`
- Add screenshots under the established review-artifact location; do not add generated images to
  source folders

### Step 1: Run the two bounded human sessions

Use the real Phase 0B shell story/local route for:

- one daily employee session;
- one manager/Project-owner session.

Record participant overlap truthfully. Ask both to find Today/Work/Projects/Research/Evaluation,
switch locale, use keyboard/mobile navigation, discover global entries, and recover from one error.
Only confirmed P0/P1 defects block G0. P2/P3 observations enter the Phase 1 backlog.

### Step 2: Run the full G0 matrix once

```bash
pnpm validate:frontend-capabilities
pnpm validate:frontend-events
pnpm validate:frontend-handoffs
pnpm validate:frontend-boundaries
pnpm validate:frontend-routes
pnpm validate:task-graph
pnpm scan:secrets
pnpm scan:performance-inputs
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm test:storybook
pnpm build:storybook
pnpm build
pnpm test:e2e -- --grep "stable shell|frontend foundation"
```

Do not run database, backup/restore, AI-evaluation, or the full engine integration suite unless the
Phase 0B diff actually changes their shared foundation. Phase 0B must not change those areas.

### Step 3: Record evidence against every G0 condition

The evidence must state:

- exact 44-row distribution: 39 complete, 2 partial, 2 external gates, 1 approved deferred;
- handoff completeness and assistance classification;
- no master agent, second router, or global business store;
- telemetry import prohibition proof;
- keyboard, focus, RTL, reduced motion, axe, desktop, and 390px results;
- Storybook/CI and boundary validation results;
- temporary route retention and rollback proof;
- executable Phase 1 tasks;
- human-session findings and any deferred P2/P3 items;
- explicit statement that Phase 1 runtime has not started.

### Step 4: Product Owner gate

Push the final Phase 0B branch and update the PR. Stop and request the Product Owner's G0 decision.
Only after explicit approval may the decision file mark G0 approved and Phase 1 execution begin.

### Step 5: Final checkpoint

If G0 is approved, update `TASKS.md` and `PROJECT_STATE.md`, commit the decision record, push, and
stop. Do not merge or start Phase 1 without the Product Owner's merge/execution instruction.

---

## Plan acceptance checklist

- [ ] T078–T086 are present in `TASKS.md` with phase-valid dependencies.
- [ ] All 12 approved P0B items map to at least one task above.
- [ ] Every bundle has a visible/reviewable outcome and rollback.
- [ ] No Phase 1 production runtime is hidden in the foundation tasks.
- [ ] Existing routes remain until parity and removal approval.
- [ ] Protected AI/evaluation/progress/privacy rules are explicit in tests.
- [ ] Normal tasks use one review; the protected inspection boundary uses the bounded critical policy.
- [ ] Full repository verification runs once at G0, not after each small change.
- [ ] Product Owner receives a runnable shell, screenshots, and evidence before deciding G0.
