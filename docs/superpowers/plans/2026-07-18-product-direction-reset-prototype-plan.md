# Product Direction Reset Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not use a Subagent-Driven Development loop; the approved execution policy requires one implementation owner.

**Goal:** Deliver a clickable Arabic-first Product Reset acceptance prototype that demonstrates daily Work Item, update, evidence, manager, and evaluation-readiness workflows without production backend implementation.

**Architecture:** Add a private Next.js workspace at `apps/product-reset-prototype` with a deterministic in-memory mock domain and no production API imports. One shared Work Item collection, filter state, and route state drive every screen and view. Documentation records the confirmed production delta while preserving the Phase 1 backend.

**Tech Stack:** Next.js 16, React 19, TypeScript 7, CSS logical properties, Vitest, Playwright.

## Global Constraints

- Original clean-room React/Next.js implementation only.
- Do not copy external source, translations, assets, branding, screenshots, schemas, authentication, backend, or sync logic.
- Do not resume T030–T044 or write production Work Item backend code.
- Do not modify or merge the Phase 1 branch or Pull Request #3.
- Do not create a database migration, production API, second store, authentication system, queue, or AI provider call.
- The prototype must expose a visible synthetic-data marker and make no production network request.
- Arabic is the default locale; English, RTL, LTR, mixed technical text, keyboard access, reduced motion, desktop, tablet, and mobile are required.
- AI never assigns or recommends a rating.
- Task, completion, update, GitHub, evidence, project, and Documentation Readiness counts never become employee performance.
- GitHub items remain suggestions until the employee confirms and contextualizes them.
- The manager sees no individual Documentation Readiness percentage or ranking.
- T016 remains protected and deferred.
- Verification is limited to prototype lint, typecheck, focused tests, accessibility smoke checks, Playwright navigation, and Arabic/English desktop/mobile screenshots.

---

### Task 1: Isolated prototype foundation and deterministic mock domain

**Files:**
- Create: `apps/product-reset-prototype/package.json`
- Create: `apps/product-reset-prototype/next.config.ts`
- Create: `apps/product-reset-prototype/next-env.d.ts`
- Create: `apps/product-reset-prototype/tsconfig.json`
- Create: `apps/product-reset-prototype/src/app/layout.tsx`
- Create: `apps/product-reset-prototype/src/app/page.tsx`
- Create: `apps/product-reset-prototype/src/app/[locale]/[[...screen]]/page.tsx`
- Create: `apps/product-reset-prototype/src/domain/types.ts`
- Create: `apps/product-reset-prototype/src/domain/mock-data.ts`
- Create: `apps/product-reset-prototype/src/domain/mock-ai.ts`
- Create: `apps/product-reset-prototype/src/domain/mock-ai.test.ts`

**Interfaces:**
- Produces: `Locale`, `Persona`, `Project`, `Workstream`, `WorkItem`, `InboxItem`, `ActivityEvent`, `EvidenceSuggestion`, `ReadinessFact`.
- Produces: `prototypeData` containing exactly two Projects, five Workstreams, and twenty Work Items.
- Produces: `structureTextUpdate(rawText, context)` and `structureTranscript(transcript, context)` deterministic functions.

- [ ] **Step 1: Add the private workspace configuration**

Use the same pinned `next`, `react`, `react-dom`, TypeScript, ESLint, Vitest, and Playwright versions already installed at the root. Add scripts:

```json
{
  "name": "@evaluation/product-reset-prototype",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3100",
    "build": "next build",
    "lint": "eslint src e2e playwright.config.ts",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run --root ../.. apps/product-reset-prototype/src"
  }
}
```

- [ ] **Step 2: Write deterministic AI tests**

Test that an update with result context produces approved descriptive fields, an update without result returns exactly one clarification question, and no output contains `rating`, `rank`, `productivityScore`, or `readinessScore`.

Run:

```bash
pnpm --filter @evaluation/product-reset-prototype test
```

Expected: FAIL because the deterministic adapter does not exist.

- [ ] **Step 3: Implement the mock types, data, and deterministic adapter**

The structured draft interface is:

```ts
export type StructuredUpdateDraft = {
  readonly activity: string;
  readonly result: string;
  readonly personalContribution: string;
  readonly teamContribution: string;
  readonly participants: readonly string[];
  readonly impact: string;
  readonly blocker: string;
  readonly decision: string;
  readonly learning: string;
  readonly nextStep: string;
  readonly relatedWorkItemId: string | null;
  readonly relatedCriteria: readonly string[];
  readonly suggestedEvidenceIds: readonly string[];
  readonly missingContext: readonly string[];
  readonly clarificationQuestion: string | null;
};
```

Use fixed fixtures only. Do not read environment variables or call `fetch`.

- [ ] **Step 4: Verify the mock foundation**

Run:

```bash
pnpm --filter @evaluation/product-reset-prototype test
pnpm --filter @evaluation/product-reset-prototype typecheck
```

Expected: all focused tests pass and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/product-reset-prototype
git commit -m "feat: add isolated product reset prototype foundation"
```

---

### Task 2: Original bilingual shell, route state, and visual system

**Files:**
- Create: `apps/product-reset-prototype/src/i18n/catalog.ts`
- Create: `apps/product-reset-prototype/src/i18n/catalog.test.ts`
- Create: `apps/product-reset-prototype/src/app/prototype-app.tsx`
- Create: `apps/product-reset-prototype/src/app/prototype-store.tsx`
- Create: `apps/product-reset-prototype/src/components/app-shell.tsx`
- Create: `apps/product-reset-prototype/src/components/icon.tsx`
- Create: `apps/product-reset-prototype/src/components/status-badge.tsx`
- Create: `apps/product-reset-prototype/src/components/empty-state.tsx`
- Create: `apps/product-reset-prototype/src/app/styles.css`

**Interfaces:**
- Consumes: all Task 1 mock domain types.
- Produces: `usePrototype()` for persona, locale, screen, selected Work Item, shared filters, mutable mock state, and navigation.
- Produces: `AppShell` with employee/manager navigation, persona switch, locale switch, synthetic marker, desktop sidebar, and mobile navigation.

- [ ] **Step 1: Write catalog completeness tests**

Assert Arabic and English have identical keys and that required navigation, status, health, verification, execution-mode, and accessibility labels exist.

- [ ] **Step 2: Run the catalog test and verify RED**

```bash
pnpm --filter @evaluation/product-reset-prototype test
```

Expected: FAIL because the catalog does not exist.

- [ ] **Step 3: Implement the store and shell**

Use one React provider. Route changes update `history.pushState`; query parameters preserve `persona`, `workItem`, `tab`, and `view`. `popstate` restores screen state.

Set root language/direction together:

```ts
document.documentElement.lang = locale === "ar" ? "ar" : "en";
document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
```

The visual system uses local fonts, logical properties, visible focus, text-labelled states, and a `prefers-reduced-motion` rule.

- [ ] **Step 4: Verify shell behavior**

```bash
pnpm --filter @evaluation/product-reset-prototype test
pnpm --filter @evaluation/product-reset-prototype lint
pnpm --filter @evaluation/product-reset-prototype typecheck
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/product-reset-prototype
git commit -m "feat: add bilingual product reset shell"
```

---

### Task 3: My Work, Inbox, Projects, Workstreams, shared views, and Work Item side panel

**Files:**
- Create: `apps/product-reset-prototype/src/components/work-item-row.tsx`
- Create: `apps/product-reset-prototype/src/components/work-item-panel.tsx`
- Create: `apps/product-reset-prototype/src/components/view-switcher.tsx`
- Create: `apps/product-reset-prototype/src/screens/my-work-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/inbox-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/projects-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/project-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/workstream-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/work-screens.test.tsx`

**Interfaces:**
- Consumes: `usePrototype()`, shared `WorkItem[]`, Projects, Workstreams, and filters.
- Produces: the required employee daily screens and a URL-addressable `WorkItemPanel`.
- Produces: List, Board, Calendar, and Timeline projections from the same filtered `WorkItem[]`.

- [ ] **Step 1: Write screen behavior tests**

Test:

- My Work contains all required groups.
- Rows omit UUID/version/model/prompt/repository/API/fixture content.
- changing Project view does not change Work Item identity;
- opening `wi-104` sets `workItem=wi-104`;
- Escape closes the panel;
- Inbox resolve/convert/link changes only mock state.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter @evaluation/product-reset-prototype test
```

Expected: FAIL because screens do not exist.

- [ ] **Step 3: Implement the daily work screens**

Group functions return references to the same objects:

```ts
export function groupMyWork(items: readonly WorkItem[], today: string): MyWorkGroups;
export function filterWorkItems(items: readonly WorkItem[], filters: WorkFilters): WorkItem[];
```

Project tabs use `Overview`, `Work`, `Updates`, `Evidence`, `Document`, `Criteria`, and `People and Responsibility`. Workstream detail uses the approved fields and responsibility history.

- [ ] **Step 4: Implement the accessible Work Item panel**

Use `role="dialog"`, `aria-modal="true"`, an accessible title, focus entry/return, Escape handling, a mobile full-screen mode, and query-addressable state. Include all approved fields and exact status vocabulary.

- [ ] **Step 5: Verify the screens**

```bash
pnpm --filter @evaluation/product-reset-prototype test
pnpm --filter @evaluation/product-reset-prototype lint
pnpm --filter @evaluation/product-reset-prototype typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/product-reset-prototype
git commit -m "feat: prototype daily work and project navigation"
```

---

### Task 4: Text/voice update, timeline, evidence, and GitHub suggestion flows

**Files:**
- Create: `apps/product-reset-prototype/src/components/text-update-dialog.tsx`
- Create: `apps/product-reset-prototype/src/components/voice-update-dialog.tsx`
- Create: `apps/product-reset-prototype/src/components/activity-timeline.tsx`
- Create: `apps/product-reset-prototype/src/components/evidence-review-panel.tsx`
- Create: `apps/product-reset-prototype/src/screens/evidence-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/update-flows.test.tsx`

**Interfaces:**
- Consumes: deterministic Task 1 adapters and the shared mock store.
- Produces: confirmed simulated Activity events and evidence dispositions in memory only.

- [ ] **Step 1: Write update and evidence flow tests**

Test:

- text flow requires employee confirmation before timeline insertion;
- missing context shows one question;
- voice flow preserves raw and edited transcript labels;
- GitHub suggestion remains suggested until context confirmation;
- execution mode never changes performance state;
- timeline labels each content kind.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter @evaluation/product-reset-prototype test
```

Expected: FAIL because flow components do not exist.

- [ ] **Step 3: Implement text and voice dialogs**

Use explicit step state machines. The prototype record includes a visible “simulated — not persisted” note. Confirming appends an `ActivityEvent` to the in-memory store.

- [ ] **Step 4: Implement evidence and GitHub review**

Support accept/contextualize, Work Item/update/criterion links, merge choice, team/partial contribution, Project reassignment, reject/ignore, and the four execution modes. No suggestion becomes confirmed evidence before the final mock confirmation.

- [ ] **Step 5: Verify flows**

```bash
pnpm --filter @evaluation/product-reset-prototype test
pnpm --filter @evaluation/product-reset-prototype lint
pnpm --filter @evaluation/product-reset-prototype typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/product-reset-prototype
git commit -m "feat: prototype updates timeline and evidence"
```

---

### Task 5: Manager operations and Evaluation Fact View readiness

**Files:**
- Create: `apps/product-reset-prototype/src/screens/manager-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/readiness-screen.tsx`
- Create: `apps/product-reset-prototype/src/screens/protected-rules.test.tsx`

**Interfaces:**
- Consumes: Projects, Workstreams, inbox actions, responsibility windows, evidence state, criteria, and readiness facts.
- Produces: operational manager dashboard and no-rating Evaluation Fact View preview.

- [ ] **Step 1: Write protected-display tests**

Assert the manager view does not contain ranking, productivity score, individual readiness percentage, commit/task leaderboards, predicted/suggested rating, or technical fixture content. Assert the Evaluation Fact View contains facts, interpretation, verification, attribution, criteria, and no rating recommendation.

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @evaluation/product-reset-prototype test
```

Expected: FAIL because manager/readiness screens do not exist.

- [ ] **Step 3: Implement operational manager dashboard**

Render Needs Review, missing Thursday check-ins, blocked Projects/Workstreams, criteria objections, attribution questions, Reassignment Required, open evaluation actions, and team-level readiness gaps.

- [ ] **Step 4: Implement readiness and Evaluation Fact View**

Show period, scope, responsibility window, employee claim, source-supported facts, unsupported/unclear parts, result, evidence, verification, attribution, and related criteria. Explicitly label the preview as non-scoring.

- [ ] **Step 5: Verify protected views**

```bash
pnpm --filter @evaluation/product-reset-prototype test
pnpm --filter @evaluation/product-reset-prototype lint
pnpm --filter @evaluation/product-reset-prototype typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/product-reset-prototype
git commit -m "feat: prototype manager operations and fact view"
```

---

### Task 6: Product documents, browser acceptance, screenshots, and checkpoint

**Files:**
- Create: `docs/product/PHASE_2_DAILY_WORK_EXPERIENCE.md`
- Create: `docs/product/PHASE_2_BACKEND_DELTA.md`
- Create: `docs/product/PHASE_2_VERTICAL_SLICES.md`
- Create: `docs/product/PHASE_2_INTERACTION_REFERENCE_REGISTER.md`
- Create: `apps/product-reset-prototype/playwright.config.ts`
- Create: `apps/product-reset-prototype/e2e/product-reset.spec.ts`
- Create: `docs/product/screenshots/product-reset-ar-desktop.png`
- Create: `docs/product/screenshots/product-reset-en-desktop.png`
- Create: `docs/product/screenshots/product-reset-ar-mobile.png`
- Create: `docs/product/screenshots/product-reset-en-mobile.png`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**
- Consumes: the complete prototype.
- Produces: documented user experience, exact Phase 1 backend delta, eight vertical production slices, provenance register, runnable URL, and acceptance evidence.

- [ ] **Step 1: Write the four product documents**

The Backend Delta must name the existing Phase 1 capability, exact missing production entity/query/command/endpoint, blocker status, smallest safe change, protected rule, expected module/files, and complexity impact. It must not describe mock state as production capability.

- [ ] **Step 2: Add Playwright acceptance**

Cover:

- Arabic default and English switching;
- employee/manager persona switch;
- My Work → Work Item panel → close with Escape;
- Inbox action;
- Project view switching with stable Work Item identity;
- text and voice simulated confirmations;
- GitHub suggestion contextualization;
- manager prohibited-content assertions;
- 390px no-overflow and panel usability;
- keyboard focus and reduced-motion smoke behavior.

- [ ] **Step 3: Run bounded verification**

```bash
pnpm --filter @evaluation/product-reset-prototype test
pnpm --filter @evaluation/product-reset-prototype lint
pnpm --filter @evaluation/product-reset-prototype typecheck
pnpm --filter @evaluation/product-reset-prototype exec playwright test
```

Expected: all focused checks pass.

- [ ] **Step 4: Capture required screenshots**

Use Playwright at 1440×1000 and 390×844. Capture Arabic and English at both sizes into `docs/product/screenshots`.

- [ ] **Step 5: Self-review and one focused UX/spec review**

Check every required screen and protected rule against the approved design. Fix only confirmed P0/P1 acceptance issues. Record nonblocking polish in `PHASE_2_DAILY_WORK_EXPERIENCE.md`.

- [ ] **Step 6: Start the prototype and verify the handoff URL**

```bash
pnpm --filter @evaluation/product-reset-prototype dev
```

Expected URL: `http://127.0.0.1:3100/ar`

- [ ] **Step 7: Commit and push**

```bash
git add apps/product-reset-prototype docs/product project-state/PROJECT_STATE.md
git commit -m "feat: deliver product direction reset prototype"
git push origin codex/phase-2-updates-evidence-readiness
```

- [ ] **Step 8: Stop at the product-owner gate**

Report:

- exact URL;
- persona switch;
- screenshots;
- missing backend capabilities;
- focused verification;
- branch/commit/push status.

Ask only:

> Approve product direction / Request modifications.
