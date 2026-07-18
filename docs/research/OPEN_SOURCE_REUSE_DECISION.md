# Open-Source Reuse Decision

**Decision date:** 2026-07-18
**Status:** Approved research recommendation pending product-owner review
**Assessment:** [`OPEN_SOURCE_REUSE_ASSESSMENT.md`](./OPEN_SOURCE_REUSE_ASSESSMENT.md)

## Decision

Choose **Option 3 — Interaction patterns only**.

Do not use a full repository base. Do not import candidate UI, backend, data-model, authentication, integration, translation, or asset code into the Product Reset prototype.

Use clean-room, original React/Next.js implementation over the current Phase 1 backend and its public module boundaries.

## Why this option wins

1. Five of the six candidate applications have a blocking AGPL, EPL, enterprise, or mixed source license for the useful code paths.
2. Super Productivity is MIT but is an Angular/NgRx, local-first personal productivity application. Its UI components are too coupled and its task semantics are too different to produce meaningful React/Next.js savings.
3. None implements the protected evaluation, privacy, historical attribution, dynamic criteria, evidence confirmation, human rating, or AI Router rules.
4. Adopting any candidate backend would discard or duplicate Phase 1 domain work and increase complexity.
5. Clean-room interaction reuse provides most of the design benefit without license, framework, or fork-maintenance exposure.

## Primary and secondary reference projects

### Primary reference: Plane

Use Plane as the primary interaction reference for:

- project-scoped Work Items;
- intake/inbox triage;
- consistent List, Board, Calendar, and Timeline/Gantt view switching;
- a Work Item side peek that preserves list context;
- activity, comments, and attachments within the Work Item;
- responsive project navigation.

Do not copy its source. Plane is AGPL-3.0.

### Secondary reference: Super Productivity

Use Super Productivity as the primary “My Work” and mobile-behavior reference for:

- a focused personal default home;
- Today/planner hierarchy;
- quick capture;
- compact task rows;
- task detail without losing personal context;
- touch gestures, responsive behavior, and reduced-motion handling.

Its MIT license makes small file-specific adaptation legally possible, but its Angular components should remain pattern references.

### Secondary reference: Twenty

Use Twenty as a reference for:

- record side-panel information hierarchy;
- month-grouped activity timeline;
- compact task and attachment rows;
- keeping communication and files near the record;
- Arabic localization coverage.

Do not copy source because the repository mixes AGPL and restricted enterprise code.

### Secondary reference: Vikunja

Use Vikunja as a reference for:

- clear List/Board/Table/Gantt switching;
- dense task details;
- attachment and comment composition;
- responsive project navigation;
- explicit Arabic RTL activation at the document root.

Do not copy source because it is AGPL-3.0-or-later.

Huly and Focalboard remain negative/secondary references only: Huly demonstrates the complexity to avoid, while Focalboard’s unmaintained status makes it unsuitable even where a pattern appears simple.

## Code legally and technically safe to reuse

### Directly reusable

None.

### Eligible only after a separate file-specific decision

The following Super Productivity files are MIT and can technically be adapted to React/Next.js:

| Exact path | Potential use | Integration estimate | Expected code avoided |
|---|---|---:|---:|
| `src/app/features/planner/planner-calendar-nav/planner-calendar-gesture-handler.ts` | Collapsible/swipeable mobile calendar with reduced motion | 1–2 engineer-days | 180–250 lines |
| `src/app/features/schedule/map-schedule-data/get-tasks-within-and-beyond-budget.ts` | Split ordered items across available schedule capacity | <1 engineer-day | 20–30 lines |
| `src/app/features/schedule/map-schedule-data/map-schedule-days-to-schedule-events.ts` | Map planned items to overlapping calendar lanes | 2–3 engineer-days | 80–110 lines |

These items are **not approved for copying by this decision**. They are only license-cleared candidates. Before any adaptation:

- confirm that the reset scope actually needs the behavior;
- preserve the MIT copyright and license notice;
- pin the inspected revision;
- remove personal-productivity and quota language;
- verify timezone, Arabic/RTL, reduced-motion, and accessibility behavior;
- keep readiness and operational planning separate from employee scoring.

The initial Product Reset prototype does not need these utilities. Original code is likely simpler until calendar scheduling is confirmed.

## Code and assets that must not be copied

- Any Plane source (AGPL).
- Any Vikunja source (AGPL) or bundled background assets.
- Any Huly source (EPL).
- Any Focalboard UI source (generally AGPL/commercial).
- Any Twenty source unless a future file-specific legal review proves both the exact license and approved commercial rights; enterprise-marked files are explicitly prohibited.
- Super Productivity’s Angular components, NgRx state, task model, sync model, and GitHub issue-provider plugin.
- Any candidate backend, database model, authentication subsystem, queue, sync engine, or activity history as a replacement for Phase 1.
- Logos, names, screenshots, marketing images, proprietary icons, trademarks, and unclear third-party assets.
- Candidate translation catalogs. Arabic product terminology and protected rubric language require our own approved translations.

## Exact interaction components worth adapting as original React

Priority order for the prototype:

1. **My Work shell**
   Reference Super Productivity’s `src/app/features/planner/planner.component.ts` and task-list/detail composition, but implement an original React page backed by current APIs.

2. **Work Item side peek**
   Reference Plane’s `apps/space/components/issues/peek-overview/side-peek-view.tsx` and Twenty’s `RecordShowSidePanelOpenRecordButton.tsx`, but implement an original accessible React dialog/sheet with URL-addressable state.

3. **Shared work-item views**
   Reference Plane’s Kanban/Calendar/Gantt roots and Vikunja’s `ProjectList.vue`, `ProjectKanban.vue`, `ProjectTable.vue`, and `ProjectGantt.vue`. Reuse one target Work Item query and one filter model across original List, Board, Calendar, and Timeline presentations.

4. **Activity and evidence composition**
   Reference Twenty’s `TimelineCard.tsx`, Plane’s issue activity root, and Vikunja’s attachment/comments sections. Preserve our distinction between source-supported facts, suggested evidence, confirmed contribution, and employee interpretation.

5. **RTL activation and responsive behavior**
   Reproduce the behavior demonstrated by Vikunja’s `frontend/src/i18n/index.ts`: set locale and root document direction together. Do not copy the AGPL implementation. Use Super Productivity only as a reference for touch and reduced-motion behavior.

## Expected time saved

Using the candidates as bounded interaction references is expected to save:

- **2–4 engineer-weeks** across UX discovery, state enumeration, responsive behavior, and prototype iteration;
- an additional **2–4 engineer-days** only if the three MIT calendar utilities are later approved and adapted.

The savings come from avoiding interaction dead ends, not from importing a foreign application.

Adopting a full repository would produce negative savings after license resolution, replatforming, protected-rule reconstruction, data migration, and fork maintenance.

## Maintenance impact

The selected strategy has a low maintenance impact:

- no upstream runtime dependency on any candidate application;
- no foreign database or authentication system;
- no upstream schema or migration coupling;
- no obligation to chase candidate application releases;
- no AGPL/EPL code provenance inside the product;
- a small reference register that can be rechecked only when a specific interaction is implemented.

If a MIT utility is later adapted, maintenance rises slightly because its source revision, notice, local modifications, tests, and upstream security history must be tracked.

## Impact on the current Phase 1 backend

**No replacement, rewrite, migration, or refactor.**

The Phase 1 backend remains authoritative. The Product Reset UI must consume current public module interfaces for Projects, Workstreams, documents, contributions, criteria, and protected history. Any missing endpoint must be proposed separately and added only when the prototype proves a concrete need.

The UI must not introduce:

- a parallel Work Item store;
- direct candidate database access;
- mutable replacement history;
- direct provider AI calls;
- direct GitHub issue import as contribution evidence;
- readiness percentages in manager rating screens;
- automatic employee scoring or ranking.

## Required Product Reset prompt revision

The current Product Reset prototype prompt should **not proceed unchanged**. Revise it before execution with the following bounded additions:

1. **Reference hierarchy**
   - Plane is the primary interaction reference for project work items, intake, shared views, and side peek.
   - Super Productivity is the reference for the employee My Work home and responsive planning behavior.
   - Twenty is the reference for record activity and attachments.
   - Vikunja is the reference for view switching and Arabic RTL behavior.

2. **Clean-room implementation**
   - Implement original React/Next.js code.
   - Do not copy source, translations, assets, branding, or screenshots from Plane, Twenty, Huly, Focalboard, or Vikunja.
   - Do not port Super Productivity Angular components.

3. **Backend preservation**
   - Keep the current Phase 1 backend and public module boundaries.
   - Do not add a second task store, authentication system, sync engine, queue, or generic object platform.

4. **Protected evidence behavior**
   - GitHub data remains suggested evidence only and requires employee confirmation before becoming a contribution.
   - Activity counts, task volume, time tracked, project count, and readiness do not become employee performance metrics.
   - The manager retains final human rating judgment; AI never assigns or recommends ratings.

5. **Prototype acceptance**
   - My Work is the employee default home.
   - Every Work Item requires a Project and may have one Workstream.
   - List, Board, Calendar, and Timeline use the same filters and Work Item identity.
   - The side panel is keyboard accessible, URL-addressable, responsive, Arabic-first, and RTL-correct.
   - Missing backend behavior is documented, not silently recreated in client state.

This is a prompt clarification, not an expansion of product scope. It prevents license contamination and protects the architecture already delivered in Phase 1.

## Stop condition

Research is complete after these two documents are committed and pushed. Do not implement the Product Reset, modify Phase 1, resume T030–T044, or merge Pull Request #3 until the product owner reviews this decision.
