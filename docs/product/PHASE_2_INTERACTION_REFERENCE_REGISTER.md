# Phase 2 Interaction Reference Register

**Decision:** Interaction patterns only
**Code reuse:** None
**Assets, text, translations, schemas, branding, and screenshots copied:** None

This register records which interaction ideas informed the clean-room prototype and where the product intentionally differs. The legal and maintenance assessment remains in `docs/research/OPEN_SOURCE_REUSE_ASSESSMENT.md` and `docs/research/OPEN_SOURCE_REUSE_DECISION.md`.

## Reference hierarchy

| Product | Pattern studied | Applied as an original product pattern | License warning | Explicit exclusions |
|---|---|---|---|---|
| Plane | Project-scoped Work Items, intake triage, shared views, side peek, responsive project navigation | Required Project, optional Workstream, shared Work Item identity, URL-addressable side panel, List/Board/Calendar/Timeline | AGPL/copyleft risk blocks copying into the private product without explicit approval and compliance analysis | No source, schema, assets, text, translation, branding, authentication, sync, or generic issue-platform model |
| Super Productivity | My Work home, today/overdue/upcoming/blocked/unscheduled grouping, quick capture, compact rows, responsive planning | Arabic-first My Work default, bounded daily groups, Quick Add/Update, compact responsive rows, reduced motion | GPL/copyleft obligations block component porting into the private product without explicit approval | No Angular/NgRx port, time tracking, productivity metrics, personal score, or source reuse |
| Twenty | Record side-panel hierarchy, chronological activity, compact evidence rows | Properties-first Work Item panel, activity history near the record, compact source-labelled evidence | Mixed package licensing requires file-level review; no source is approved for reuse | No source, CRM object model, branding, text, or assets |
| Vikunja | Clear view switching, dense task details, RTL activation, responsive navigation | One List/Board/Calendar/Timeline switcher, logical CSS direction, mobile bottom navigation | AGPL/copyleft risk blocks copying into the private product without explicit approval and compliance analysis | No source, translations, assets, backend, or schema |

## Prototype implementation mapping

| Product capability | Primary reference | Original implementation |
|---|---|---|
| Employee default home | Super Productivity | `MyWorkScreen` groups one shared Work Item collection by daily attention |
| Quick capture | Super Productivity | `QuickAddDialog` creates session-only synthetic Work Items with required Project |
| Project work hierarchy | Plane | Project → optional Workstream → Work Item in the prototype domain |
| Shared views | Plane + Vikunja | `AlternativeView` projects the same identities as List, Board, Calendar, and Timeline |
| Side panel | Plane + Twenty | `WorkItemPanel` with query identity, properties, evidence, and activity |
| Inbox triage | Plane | Action/information separation, related Work Item open, resolve, and evidence navigation |
| Activity near the record | Twenty | Work Item history and accepted update events remain alongside the item |
| Evidence rows | Twenty | Compact source label, state, title, Project/Workstream context |
| RTL and mobile navigation | Vikunja + Super Productivity | Root `lang/dir`, logical CSS, desktop sidebar, mobile bottom navigation |

## Product-specific behavior not taken from references

The following behavior comes from this product’s approved rules and must not be replaced by familiar project-management conventions:

- Work Items support evidence-backed periodic evaluation but do not calculate daily employee performance.
- GitHub activity remains suggested evidence until employee confirmation and context.
- Update structuring requires employee correction and confirmation.
- Execution mode distinguishes Manual, AI-Assisted, Agent-Generated, and Mixed contributions.
- Dynamic Project/Workstream criteria are versioned and never automatically averaged.
- Evaluation Fact View separates source facts from employee interpretation.
- Documentation Readiness remains non-scoring and manager visibility remains coarse.
- The manager makes the final rating decision; AI never assigns or recommends ratings.
- Responsibility and attribution follow the historical responsibility period.
- Arabic is the default shell while T016 evaluation-rubric activation remains protected and deferred.

## Clean-room record

Implementation was authored inside `apps/product-reset-prototype` from the approved requirements and repository-owned fonts. Candidate repositories were not placed in the production repository. No candidate script was installed or executed for prototype implementation.

No candidate:

- file or package was imported;
- component was translated or ported;
- CSS, icon, logo, screenshot, or visual asset was copied;
- schema, API, authentication, sync, queue, or activity model was adopted;
- wording or translation was copied.

The prototype’s mock data, catalog text, React components, state model, visual styling, and deterministic update structuring are original to this repository.

## Future reuse control

If a future implementation proposes copying or adapting code:

1. reopen the license assessment for the exact file and revision;
2. obtain explicit approval before importing AGPL, EPL, fair-code, enterprise, or source-available code;
3. record copyright notice, license, dependencies, local modifications, tests, and upstream maintenance risk;
4. prefer a small maintained permissive library over a full application;
5. reject the reuse if it introduces a parallel store, authentication system, queue, schema, or protected-rule conflict.

The current approved decision remains **interaction patterns only**.
