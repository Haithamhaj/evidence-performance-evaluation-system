# Phase 2 Daily Work, Progress, Updates, and Evidence Design

**Status:** Product-owner approved on 2026-07-18; ready for implementation-plan review
**Scope:** Phase 2 production design only; no production implementation is authorized by this document
**Authority:** `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, `AGENTS.md`, and the approved Product Direction Reset decisions
**Supersedes for production planning:** `2026-07-18-phase-2-updates-evidence-readiness-design.md`
**Preserves as prototype history:** `2026-07-18-product-direction-reset-prototype-design.md`

## 1. Outcome

Phase 2 turns the approved Product Reset prototype into a production daily-work foundation without replacing the Phase 0 or Phase 1 backend.

The employee journey is:

> My Work → Work Item → required Project → optional Workstream → text or voice Update → dynamic AI clarification → manual or suggested Evidence → employee confirmation → Project/Workstream Progress Contract calculation → append-only Timeline → future Evaluation Fact View preparation.

The phase delivers operational project progress and evidence-supported work records. It does not implement the complete employee evaluation workflow and never turns project progress into employee performance.

## 2. Protected boundaries

Phase 2 must preserve all protected rules in `AGENTS.md`. In particular:

- AI never assigns or recommends an employee or manager rating.
- Project progress, Work Item completion, operational KPIs, update frequency, GitHub activity, evidence volume, and Documentation Readiness never become employee performance.
- Work Item count, task volume, update frequency, commit count, file count, and lines changed never calculate Project or Workstream progress.
- GitHub activity remains suggested evidence until employee confirmation.
- Documentation Readiness remains non-scoring and manager views expose no individual readiness percentage, value, or rank.
- Source-supported facts remain distinct from employee interpretation.
- Historical responsibility, documents, contracts, updates, evidence, and progress snapshots are append-only or successor-versioned.
- Arabic is the default pilot locale, with English, RTL/LTR, keyboard access, visible focus, reduced motion, and mixed technical text support.
- Every AI call uses the existing AI Router. Provider credentials are injected only into the AI-routing boundary and are never printed, moved, logged, committed, or persisted as domain data.

## 3. Approaches considered

### Approved: evolutionary modular monolith

Preserve the existing backend and add only two bounded domain modules:

1. `work-items`
2. `updates-evidence`

Extend the existing `projects` domain with focused Progress Contract services. Add an application-level daily-work composition layer for My Work, dashboards, timelines, and later Evaluation Fact View preparation.

This is the shortest total implementation path because it reuses Phase 0/1 identity, permissions, projects, workstreams, responsibility, documents, criteria, audit, queue, storage, and AI Router while avoiding a future rewrite of the prototype's in-memory state.

### Rejected: promote the prototype store

The prototype's client-side router, in-memory store, deterministic mock AI, mock progress percentage, and synthetic data remain acceptance artifacts only. Promoting them would create a second source of truth, bypass production authorization and history, and require later replacement.

### Rejected: package per feature

Separate packages for activity, progress, KPIs, updates, evidence, voice, GitHub, dashboards, and evaluation preparation would add boundaries without independent ownership needs. Activity and dashboards are read/composition concerns; voice and GitHub are connectors to the Updates & Evidence lifecycle.

## 4. Architecture

### 4.1 Existing foundations to preserve

- `packages/projects`: Projects, Workstreams, membership, ownership, responsibility windows, and the new Progress Contract capability.
- `packages/documents`: templates, immutable document versions, source inspection, analysis, comparison, and Documentation Readiness.
- `packages/criteria`: versioned Project/Workstream dynamic criteria and human approval.
- `packages/permissions`: server-side authorization decisions.
- `packages/ai-routing`: the only provider boundary.
- `packages/audit`: append-only audit events.
- `packages/database`: PostgreSQL and forward-only migrations.
- `packages/contracts`: public request, response, event, error, and AI schemas.
- `apps/worker`: durable asynchronous work through the existing queue.
- `apps/web`: Arabic-first Next.js interface through the same-origin server gateway.

### 4.2 New bounded modules

#### Work Items

`packages/work-items` owns:

- Work Item identity and lifecycle;
- required Project and optional same-Project Workstream;
- assignment, participants, dependencies, blocker, next action, requirements, and acceptance conditions;
- append-only status, assignment, and responsibility-relevant history;
- authorized My Work queries and stable filters.

It does not own Project progress, evidence, updates, criteria, or evaluation.

#### Updates & Evidence

`packages/updates-evidence` owns:

- original text or voice update source;
- transcript revisions;
- AI clarification sessions and structured-draft revisions;
- employee correction and confirmation;
- manual evidence sources, GitHub suggestions, verification state, contribution context, and execution mode;
- immutable evidence/update links and accepted activity events.

Voice and GitHub are adapters to this lifecycle, not independent domain stores.

### 4.3 Projects Progress Contract capability

The existing Projects domain owns versioned Project and Workstream Progress Contracts and official progress snapshots. The capability is implemented in focused files; it must not enlarge the existing `project-service.ts` or `workstream-service.ts`.

An application composition service gathers authorized facts from the public Work Items, Updates & Evidence, Documents, Criteria, and Projects interfaces. It sends exact source references to the Projects progress service. No module reads another module's tables directly.

### 4.4 Shared read/composition layer

`apps/api` owns read-only composition queries for:

- My Work;
- Project portfolio and Project/Workstream dashboards;
- ordered Timeline views;
- manager operational queues;
- later Evaluation Fact View preparation.

This layer does not own mutable domain state and is not a generic activity platform. Each returned item retains its authoritative source identity and authorization boundary.

## 5. Project and Workstream Progress Contract

### 5.1 Source of truth

The authoritative Project or Workstream Document is the source for the contract. AI:

1. analyzes the active document version;
2. identifies missing required information;
3. asks dynamic questions;
4. requires the employee to update and resubmit the original document;
5. proposes a contract only when the document is ready;
6. records the exact document version and analysis lineage.

A material document change may trigger a prospective contract revision. A Work Item, update, or evidence item may signal a material change or support measured progress, but it cannot redefine milestones, weights, KPIs, or calculation rules.

### 5.2 Contract fields

Every contract contains:

- stable contract identity;
- scope kind: Project or Workstream;
- Project and optional Workstream identity;
- source document identity and version;
- milestones;
- deliverables;
- operational KPIs;
- KPI baseline, target, unit, and direction;
- acceptance conditions;
- required evidence;
- optional approved weights;
- calculation rule and schema version;
- owner and approver;
- state: `draft`, `pending_approval`, `active`, `superseded`, or `rejected`;
- effective date;
- approved-at time;
- previous contract identity when superseding;
- created-at, actor, and audit correlation.

Weighted rules must validate to exactly 100 percent. A contract without weights must define explicit stage-gate or measurable completion rules. Project progress never automatically averages Projects, Workstreams, dynamic criteria, or employee contributions.

### 5.3 Approval and correction

AI proposes; the authorized owner reviews, corrects source information, requests an alternative, rejects, or approves.

No user can directly enter or override the official overall percentage. An authorized human may confirm a qualitative condition only when the active contract explicitly defines that condition as human-confirmed. Correcting source data or confirming a contract-defined condition causes the system to recalculate.

### 5.4 Official progress snapshots

Every accepted calculation creates an append-only snapshot containing:

- active contract identity and version;
- previous and new official percentage;
- source facts and immutable references;
- milestone/KPI state;
- calculation rule version;
- explanatory reason;
- AI route trace when AI interpretation was used;
- contract-defined human confirmations;
- actor, time, and correlation;
- confidence/coverage state.

If required information is missing or source coverage is insufficient:

- the previous official percentage remains unchanged;
- the state becomes `awaiting_information`;
- the employee sees every required clarification;
- no provisional percentage is presented as official.

Progress may decrease when rework, invalidated evidence, changed measurable state, or an approved prospective contract makes that result accurate. The snapshot must explain the decrease and preserve the previous value.

## 6. Work Item and My Work

Every Work Item requires one Project and may reference one Workstream belonging to that Project.

Initial states remain exactly:

- Planned
- Ready
- In Progress
- Blocked
- In Review
- Done
- Cancelled

Completing a Work Item does not change progress by itself. It can supply a source fact only when an active contract rule links an accepted output or evidence to a measurable milestone or KPI.

The employee's default My Work order is:

1. Needs My Action
2. Today
3. Overdue

Waiting/Blocked, Reviews and Criteria Responses, This Week, No Due Date, and Recent Activity use progressive disclosure. List, Board, Calendar, and Timeline share the same Work Item identities and filter state.

The employee/manager persona switch remains prototype-only. Production navigation and actions follow authenticated roles. Manager pages do not show employee Quick Add or Quick Update unless that authenticated user is separately acting as an authorized Project/Workstream contributor or owner.

## 7. Interactive update lifecycle

The production lifecycle is:

> raw text or voice → detect missing context → ask one question at a time, for as many turns as needed → attach or suggest evidence → compare with previous accepted state and active contract → structure update → employee edit → employee confirmation → accepted append-only Timeline event → progress recalculation request.

The clarification session:

- lists all unresolved required fields internally;
- presents one clear question at a time;
- may ask additional questions after an answer;
- resumes safely after interruption;
- never marks the update complete while required context remains;
- explains which answer affects the update, evidence, KPI, milestone, or closure state.

The employee can edit the transcript, structured update, evidence description, and contribution context before confirmation. Accepted revisions preserve original sources and prior drafts.

The first production text-update AI slice uses the live AI Router with a configured runtime credential. Deterministic simulated AI remains available only for tests and local demos.

## 8. Evidence and GitHub

Evidence can enter inside the update flow or through the Evidence workspace.

Supported manual sources include:

- image or screenshot;
- PR, CLI, terminal, test, or deployment snapshot;
- file or document;
- pasted code or text;
- URL;
- audio where relevant.

Every confirmed evidence item contains:

- supported claim;
- required Project;
- optional Workstream;
- optional Work Item, required when captured from a Work Item flow;
- optional related KPI or criterion when genuinely applicable;
- contribution context;
- Manual, AI-Assisted, Agent-Generated, or Mixed execution mode;
- verification state;
- original source identity and revisions;
- employee confirmation actor and time.

AI may draft the supported-claim description and identify missing context. The employee can edit it, and confirmation remains mandatory.

GitHub App events remain suggested evidence only. Webhooks are verified and idempotent, reconciliation covers missed events, and original IDs/URLs are retained. PR, commit, check, file, and line volume never enter progress or employee-performance calculations.

On mobile, opening an evidence item presents a visible review bottom sheet or full-height drawer and moves focus into it. The form must not appear unnoticed below the list.

## 9. Timeline and activity

Timeline is a source-labelled read projection over accepted domain events. It distinguishes:

- original employee input;
- AI-structured summary;
- verified source fact;
- employee interpretation;
- suggested evidence;
- confirmed evidence;
- blocker or decision;
- responsibility change;
- contract activation;
- official progress snapshot.

The projection is ordered, paginated, authorized, and append-only by source. It is not a mutable generic feed and has no arbitrary "create activity" API.

## 10. Dashboards and daily experience

### 10.1 Employee portfolio

The Project portfolio shows:

- official operational progress and its last-updated time;
- `awaiting_information` when calculation coverage is incomplete;
- milestone state;
- KPI status versus baseline and target;
- next action;
- blocker;
- required documentation or evidence;
- last accepted update;
- link to Project and Workstream detail.

It never substitutes Work Item completion for official progress.

### 10.2 Project and Workstream dashboard

The overview prioritizes:

1. current outcome and health;
2. official progress with explanation;
3. milestones and deliverables;
4. operational KPIs;
5. blockers and next actions;
6. missing required evidence/documentation;
7. recent updates and Timeline;
8. Work Items, documents, criteria, people, and responsibility.

Use compact rows and action lists. Drawers and bottom sheets handle focused actions. Internal implementation details and long technical identifiers remain hidden by default, with copyable stable identity available only where operationally useful.

### 10.3 Contextual AI assistant

The assistant is globally available but always displays the active Project and optional Workstream. It can start the same structured actions exposed by the UI, including update, evidence, clarification, contract review, and closure preparation. It does not maintain a second copy of domain state.

## 11. Manager operational view

The manager view prioritizes actionable queues:

- blockers requiring intervention;
- missing required operational updates;
- pending criteria objections;
- attribution questions;
- reassignment actions;
- Project/Workstream health;
- coarse team-level documentation gaps;
- future evaluation actions.

Oversized count-only cards are secondary. The API and UI exclude employee rankings, individual readiness percentages/values, productivity scores, completion leaderboards, GitHub leaderboards, predicted ratings, and suggested ratings.

Readiness and evaluation remain distinct routes and concepts.

## 12. Check-ins and monthly readiness

A Thursday Workstream check-in is required only when no substantive accepted update exists. Approved leave is excluded. Project check-in summarizes cross-Workstream state and does not duplicate detail.

Monthly Evaluation Readiness identifies thin records, missing context, unresolved attribution, unreviewed suggestions, and unsupported artifact-based criteria without quotas, penalties, employee scores, or rankings.

Employees receive actionable detail. Managers receive only authorized coarse operational projections and never individual readiness percentages or rating-screen readiness values.

## 13. Evaluation boundary

Phase 2 produces the source data required for later Evaluation Fact View preparation:

- responsibility windows;
- accepted employee claims;
- source-supported facts;
- unclear or unverified parts;
- results;
- evidence;
- verification and attribution;
- criteria active at the time;
- official Project/Workstream progress snapshots.

Phase 2 does not implement the complete self-assessment, independent manager assessment, rating discussion, final rating, acknowledgment, reservation, or cycle closure workflow.

The Fact View remains preparation for human self-assessment and manager assessment. It never recommends, predicts, preselects, or calculates a rating.

## 14. Localization, accessibility, and visual direction

- Keep the approved warm-neutral, compact visual direction.
- Prefer rows and action lists over oversized cards and empty space.
- Keep mobile bottom navigation.
- Use accessible drawers or bottom sheets for focused actions.
- Use the repository's approved icon set; do not use text glyphs as production icons.
- Arabic remains the default shell; English remains supported.
- Root `lang` and `dir` change together.
- Mixed code, URLs, SHAs, model names, and repository paths use directional isolation.
- All critical flows support keyboard operation, visible focus, labelled state changes, 390px reflow, zoom, and reduced motion.
- Locale switching preserves route, selected item, filters, assistant context, and unsubmitted draft state.

## 15. Open-source reuse

The approved strategy remains interaction patterns only:

- Plane: Project-scoped Work Items, shared views, side peek, and intake.
- Super Productivity: My Work hierarchy and compact daily planning.
- Twenty: record activity and evidence composition.
- Vikunja: view switching and RTL behavior.

No candidate source, schema, backend, authentication, translations, assets, branding, or screenshots are copied. Any later file-specific permissive reuse requires a separate decision.

## 16. Performance and maintainability

- Do not add Phase 2 behavior to the largest existing Phase 1 services.
- New domain files should normally stay below 300 lines; split by responsibility when a file exceeds that threshold.
- Keep query filters server-side and paginate Timeline, Inbox, Evidence, and My Work.
- Use stable cursors and bounded default page sizes.
- Avoid one React context containing the entire production workspace.
- Load Board, Calendar, Timeline, evidence review, voice, and manager screens on demand.
- Cache only authorized read projections; PostgreSQL remains authoritative.
- Avoid broad Phase 1 refactoring before Phase 2. Apply narrow simplification only in code touched by an approved slice.
- The known repository boundary-test CI timeout receives only its separately approved bounded timeout/performance fix; it does not broaden Phase 2.

## 17. Visible vertical slices

1. My Work + Work Items + Progress Contract foundation.
2. Interactive Text Update + live AI + Timeline + manual evidence.
3. GitHub suggested evidence.
4. Voice update.
5. Check-ins and monthly readiness.
6. Manager operational view.
7. Evaluation Fact View preparation.

Every slice must include a visible user outcome, exact backend delta, focused tests, runnable local demo, Arabic/English desktop/mobile screenshots, a commit and push checkpoint, and a product-owner stop gate.

## 18. Error handling

Stable error families include:

- authentication and scope errors;
- Project/Workstream mismatch;
- Work Item state/concurrency errors;
- Progress Contract source/version/state errors;
- invalid weights or calculation rules;
- insufficient progress source coverage;
- update clarification/confirmation errors;
- evidence source/link/verification errors;
- transcript confirmation and AI route errors;
- GitHub signature, permission, idempotency, and reconciliation errors;
- check-in and readiness privacy errors.

Errors expose no credential, private object key, raw protected content, internal stack, or unauthorized resource existence. Retriable AI/connector failures preserve the draft and offer safe retry; domain conflicts require refresh and explicit user review.

## 19. Verification and gates

Each slice follows test-driven implementation:

- unit tests for domain rules;
- migration verification from empty database and the Phase 1 snapshot;
- positive and negative authorization integration tests;
- append-only and concurrency tests;
- Arabic/English and RTL/LTR component tests;
- focused protected end-to-end flow;
- AI evaluation tests for every prompt/schema change;
- screenshots and a runnable local walkthrough.

Critical slices receive one specification-compliance review and one security/code-quality review, followed by one bounded P0/P1 remediation cycle and corrected-finding re-review only.

Writing this specification and its implementation plan does not authorize production code. After both documents are pushed, work stops for product-owner review.
