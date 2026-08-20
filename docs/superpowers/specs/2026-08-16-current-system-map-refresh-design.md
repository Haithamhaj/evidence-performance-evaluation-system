# Current System Map Refresh Design

**Date:** 2026-08-16  
**Artifact:** `project-state/SYSTEM_MAP.html`  
**Scope:** Documentation and visualization only

## 1. Objective

Replace the outdated single-language system map with one self-contained bilingual reference that
explains the product as it exists on the current AI-native frontend branch. The map must help a smart
non-technical reviewer understand the daily experience first, while preserving enough architecture,
authority, and delivery detail for implementation review.

The refresh does not change production code, product behavior, permissions, evaluation rules,
progress calculation, AI authority, or historical data.

## 2. Source of Truth

The map will reconcile only repository-backed facts from:

- `AGENTS.md` and its protected product rules;
- `project-state/PROJECT_STATE.md`;
- `docs/PROJECT_REFERENCE.md`;
- `docs/EVALUATION_RUBRIC.md`;
- `docs/IMPLEMENTATION_PLAN.md` and `TASKS.md`;
- the engine feature register, capability matrix, customer journey map, and frontend handoff schema;
- the approved AI-native frontend plans and final employee-experience design;
- the GPT-5.6 routing policy;
- current Git branch and Pull Request status.

Transient local data may illustrate a journey only when clearly labelled as local Codex dogfood.
The map will not turn a local fixture into a product guarantee.

## 3. Audience and Language

The primary audiences are the Product Owner, pilot reviewers, designers, and implementers.

- English and Arabic must contain equivalent meaning.
- The language switch changes all visible map content, document direction, and navigation labels.
- Arabic uses RTL; English uses LTR.
- Mixed technical content such as URLs, route names, model names, and repository identifiers remains
  readable in either direction.
- English is the initial pilot language; Arabic evaluation release remains governed by the approved
  Arabic-rubric gate.

## 4. Information Architecture

The refreshed map will use a journey-first order:

1. **Executive overview** — product purpose, current value, human authority, and explicit non-goals.
2. **Employee daily journey** — Home, Work, Project, Capture, Review, Evidence, Research, and
   Evaluation.
3. **Manager journey** — operational queues, Project oversight, human evaluation, coaching, and
   continuity.
4. **Screen and capability map** — current Command Brief surfaces and retained routes.
5. **Source-to-record lifecycle** — GitHub, Google, manual text, voice, URLs, images, code, and files
   through private draft, AI assistance, employee review, confirmation, and append-only history.
6. **Project Progress Contract** — approved measures, milestones, KPIs, evidence, human approval,
   snapshots, and prohibited activity-volume calculations.
7. **Evaluation boundary** — source facts, employee interpretation, independent manager judgment,
   comparison, final human decision, acknowledgment/reservation, and immutable export.
8. **AI architecture** — AI Router, GPT-5.6 Luna/Terra/Sol task routing, structured outputs, traces,
   fallbacks, and human gates.
9. **Technical architecture** — modular monolith, public domain boundaries, Next.js, NestJS,
   PostgreSQL, Redis/BullMQ, MinIO, Keycloak/OIDC, workers, and audit history.
10. **Privacy and authority** — employee, manager, administrator, owner/contributor, private source
    context, and identified upward-feedback boundaries.
11. **Delivery state** — completed engine and journeys, current frontend branch, open PR chain,
    retained rollback routes, external gates, risks, and the next recommended action.

## 5. Visual Design

The artifact remains a dependency-free HTML file that can be opened locally or through GitHub.

- A compact sticky navigation bar follows the section order.
- A persistent language switch is keyboard accessible and remembers the choice for the browser
  session.
- The top of the page provides a concise status strip: engine, employee experience, manager
  experience, local dogfood, and merge state.
- Journey flows use compact connected steps rather than large decorative cards.
- Capability and authority comparisons use tables only where exact mappings matter.
- Status chips distinguish `Implemented`, `Human gate`, `External gate`, `Retained`, and `Not in
  scope`.
- Protected rules use a visually distinct guardrail treatment.
- Desktop, tablet, and mobile layouts remain readable without horizontal page scrolling; wide tables
  may scroll inside their own container.
- Reduced-motion preferences disable nonessential transitions.
- No external fonts, scripts, trackers, images, or packages are introduced.

## 6. Current Product Story to Show

The map will describe the current experience as one connected system:

- Home is a multi-Project operational overview, not an employee scorecard.
- Work prioritizes Needs My Action, Today, and Overdue, then List/Board/Calendar and focused Task
  detail.
- Project Workspace connects Overview, Plan, Work, Progress, Timeline, Documents, Criteria,
  Evidence, Research, and Project Assistant.
- Universal Capture accepts text, voice, URL, image, code, and files without asking the employee to
  classify input first.
- AI prepares a source-backed draft and asks only for missing context; the employee can edit, reject,
  defer, or confirm.
- GitHub and Google provide private or suggested context. They do not become confirmed evidence or
  official Project progress without the required human gate.
- Project progress comes only from an approved, versioned Progress Contract and an approved
  measurement or authorized human confirmation.
- Evaluation is fact-first and human-decided. AI never assigns, predicts, or recommends ratings.
- Managers receive operational queues, not employee rankings, productivity scores, or private
  connected-work context.
- Administration governs identity, configuration, AI routing, audit, retention, and recovery without
  taking over manager decisions.

## 7. Delivery-State Accuracy

The map must distinguish three layers instead of presenting everything as merged production:

1. **Engine baseline on `main`** — the merged technical foundation and engine capabilities.
2. **AI-native frontend branch** — the current Command Brief experiences and current local dogfood.
3. **External or human gates** — deployment credentials, production telemetry/privacy approvals,
   Arabic rubric release, and Product Owner merge/retirement decisions.

At the time of this design, the active frontend work is on
`codex/ai-native-frontend-phase-1`. Pull Request #30 targets the Phase 0B branch, and Pull Request #29
targets `main`; both remain open drafts. The HTML will label this as a current status snapshot rather
than a permanent architecture rule.

## 8. Interaction and Accessibility

- The language switch is a real button group with `aria-pressed` state.
- Navigation links have visible focus and meaningful accessible names.
- Sections use semantic headings and landmarks.
- Color is never the only indication of status.
- The map remains usable with JavaScript disabled in its default English form; JavaScript enhances
  language switching only.
- Printing produces a readable static system reference without sticky overlays.

## 9. Verification

Implementation verification will include:

- HTML structure and link-target validation;
- automated checks that every translatable element has both English and Arabic content;
- browser verification at desktop and 390px mobile widths;
- keyboard verification for language switching and section navigation;
- RTL/LTR and mixed-content review;
- reduced-motion and print-style review;
- content checks for protected phrases: no AI ratings, no employee ranking, no readiness percentage
  in manager evaluation, no activity-volume progress, and human confirmation for official actions;
- a diff review confirming that only documentation artifacts changed.

## 10. Explicit Non-Goals

- No production UI or API changes.
- No new product capability or requirement.
- No change to protected product rules.
- No copied branding, assets, or code from external products.
- No live API calls, analytics, trackers, or generated status data inside the HTML.
- No removal of the detailed authoritative documents that the map summarizes.

## 11. Acceptance Criteria

The update is accepted when a reviewer can answer, from one file and in either language:

1. What does the system help an employee and manager do?
2. What is automated, what is only prepared, and what requires a human decision?
3. How do sources become Updates, Evidence, Project progress, and evaluation facts?
4. What may AI do, and what is it forbidden to do?
5. Which services and domain boundaries support the experience?
6. What is implemented, what is still on the frontend branch, and what remains externally gated?
7. What should happen next without confusing Project progress with employee performance?
