# Engine Completion, Feature Inventory, Full Frontend, and Product Acceptance

**Status:** Product Owner approved direction on 2026-08-05

**Scope:** Engine-first delivery order and acceptance gates after Phase 2 Slice 5

**Protected-rule impact:** None

## 1. Decision

The current Phase 2 interfaces are functional implementation surfaces used to verify domain behavior,
authorization, privacy, localization foundations, and integration. They are not the final product
experience and must not be presented to the Product Owner as sufficient evidence for usability or
product acceptance.

The approved delivery sequence is:

1. Accept and merge Slice 5 on technical evidence.
2. Complete Slice 6 as the final Phase 2 backend/data-preparation slice.
3. Complete the pilot engine and technical services across the remaining approved roadmap. Use only
   bounded internal verification surfaces where a browser is needed to prove behavior.
4. Perform a source-to-code inventory of every feature, workflow, service, state, permission, AI action,
   human gate, and integration in the completed engine.
5. Design and build the full product frontend in the existing `apps/web` application from that verified
   inventory.
6. Run complete realistic daily-work and evaluation cycles before requesting product and
   user-experience acceptance.

The dedicated frontend effort is a delivery program inside the existing modular monolith. It does not
create a second product repository, authentication system, API, state store, or competing domain model.
A separate repository would require a later explicit architecture decision.

## 2. Why This Sequence

Three approaches were considered:

1. **Approved — complete the pilot engine, inventory it, then build the full frontend.** This makes the
   final interface reflect the real feature set rather than provisional screens or incomplete contracts.
2. **Build Phase 3 backend and final frontend together.** This provides earlier visual feedback but can
   lock the interface around an incomplete engine and repeat the current fragmented experience.
3. **Start the full frontend before Slice 6 and the remaining engine contracts.** This produces another
   prototype against incomplete behavior and is likely to require substantial replacement.

The approved approach intentionally prioritizes engine completeness. Its main risk is discovering an
interface mismatch late. That risk is controlled through stable workflow contracts, representative
end-to-end technical tests, an explicit feature register during engine work, and a final capability audit
before frontend design. Temporary verification screens must not silently become the final design.

## 3. Meaning of Technical Acceptance

Technical acceptance permits a bounded slice to merge when its approved behavior and protected
boundaries are verified. It includes:

- domain rules and persistence integrity;
- server-side authorization and privacy tests;
- historical immutability and audit behavior where applicable;
- API and module-boundary conformance;
- AI Router, schema, and human-confirmation boundaries where applicable;
- localization and RTL foundations;
- focused and related integration tests, builds, scans, and hosted CI;
- operational documentation and known limitations.

Technical acceptance does **not** mean:

- the interface is final;
- the customer journey is understandable or efficient;
- visual design is approved;
- daily employee use is ready;
- the complete evaluation cycle exists;
- the Product Owner has accepted the product experience.

All engine slices use this technical-acceptance definition. Their temporary or minimal screens may be
used for deterministic verification but are not product-acceptance artifacts.

## 4. Slice 6 Boundary

Slice 6 prepares the neutral Evaluation Fact View and completes Phase 2. It may compose authorized,
source-supported facts, responsibility windows, effective criteria versions, confirmed evidence, and
employee interpretation as structurally separate information.

Slice 6 must not implement:

- employee self-assessment;
- manager assessment;
- rating comparison or discussion;
- final ratings or evaluation closure;
- AI-generated, predicted, or recommended ratings;
- manager-visible Documentation Readiness percentages;
- employee ranking, productivity scoring, or automatic Project averaging.

Completion of Slice 6 proves that the Phase 3 evaluation journey has trustworthy source data. It does
not prove that the evaluation product is usable.

## 5. Pilot Engine Completion

After Slice 6, work continues on the technical engine before final frontend design. The release-candidate
pilot engine includes the approved backend capabilities needed by the employee, Project owner, manager,
and administrator journeys:

- identity, authorization, audit, privacy, history, responsibilities, and configuration;
- Projects, Workstreams, authoritative documents, criteria versions, and Progress Contracts;
- official Tasks, private capture, Today composition, reminders, and recovery;
- connected work context, governed source linking, GitHub, Gmail, Calendar, and manual sources;
- text, voice, image, file, link, and code updates; evidence; attribution; and Timeline;
- check-ins, approved-leave exclusions, monthly non-scoring readiness, and manager operational queues;
- neutral Evaluation Fact View preparation;
- evaluation templates, cycle snapshots, evidence preparation, employee self-assessment, independent
  manager assessment, comparison/discussion, final human decision, acknowledgment, and immutable closure;
- identified upward manager evaluation, coaching/development services, leave/delegation/handover,
  notifications, offboarding/history preservation, reports, observability, backup/restore, and hardening
  to the extent required by the approved pilot scope;
- AI Router contracts, structured outputs, source lineage, privacy enforcement, recovery, and required
  human confirmation throughout.

### Research and Experiments capability

Research and experimentation are a required first-class capability, not a generic note type hidden in
Tasks. The engine must support the authoritative concepts needed to represent:

- the research problem or question;
- hypothesis, assumptions, constraints, and uncertainty;
- Project, Workstream, Task, and criterion context;
- experiment plan, baseline, measures, test cases, controls, and conditions;
- inputs, datasets, models, versions, code, and supporting sources where applicable;
- results, failures, limitations, and reproducibility information;
- employee-confirmed interpretation, conclusion, decision, next experiment, or applied learning;
- evidence, collaborators, responsibility period, and append-only history.

Raw research volume, number of papers, number of experiments, and model-generated confidence never become
performance scores. A failed experiment may still produce a valuable documented decision. AI may organize,
compare, identify missing methodological context, and draft follow-up actions, but the employee confirms
the record and the manager retains human evaluation judgment.

Before implementation, a bounded design decides whether this capability can be expressed cleanly through
the existing Work Items and Updates & Evidence modules or requires one small Research & Experiments domain.
The decision must avoid a generic laboratory platform or a duplicate evidence store.

### Engine completion definition

The engine is complete only when:

- every approved pilot capability is represented in the feature register;
- its domain rules, states, inputs, outputs, APIs/events, permissions, AI boundary, human gates, history,
  and failure recovery are implemented or explicitly marked deferred with approval;
- database migrations and public module interfaces are verified;
- realistic cross-feature technical journeys pass without relying on the final frontend;
- no protected capability exists only as a mock, screenshot, or in-memory prototype;
- known limitations and deployment gates are recorded truthfully.

## 6. Engine Feature Inventory and Frontend Handoff

The inventory is maintained during engine work and finalized after engine completion. It is not a simple
screen list. For every capability it records:

- user role and user goal;
- authoritative requirement and roadmap task;
- implemented domain/service and owning module;
- inputs and connected sources;
- AI responsibility and explicit prohibitions;
- human confirmation or approval gate;
- outputs, state transitions, errors, recovery, audit, and history;
- API, event, queue, storage, and authorization contracts;
- privacy and role visibility;
- localization, accessibility, mobile, and notification implications;
- tests and current readiness: complete, partial, deferred, blocked, or superseded;
- frontend entry point, primary action, information priority, and cross-feature dependency.

The final handoff must identify duplicate or overlapping capabilities, missing journeys, hidden technical
dependencies, and opportunities to simplify the employee experience without weakening the engine. It
must include an updated feature register, capability matrix, customer-journey map, and system map.

This inventory is the authoritative input for frontend information architecture. No feature is included
in the final navigation merely because a backend table or route exists; related capabilities may be
composed into one simpler intelligent journey.

## 7. Full Frontend Foundation and Delivery

Only after engine completion and the feature inventory does the frontend program begin with a design and
interaction foundation in `apps/web`:

- one coherent information architecture for employee, manager, Project owner, and administrator roles;
- a reusable bilingual design system with correct RTL/LTR behavior;
- responsive desktop and mobile navigation;
- accessible components, keyboard operation, visible focus, and reduced-motion support;
- compact daily-work patterns rather than configuration-heavy forms;
- consistent loading, empty, error, recovery, confirmation, and audit-history states;
- role-authorized navigation without production persona switches;
- integration with the existing APIs, authentication, and modular domain boundaries;
- realistic synthetic data and stable local preview accounts.

Before implementation, this frontend program requires a visible design gate using the completed feature
inventory: journey maps, information architecture, and high-fidelity clickable flows for the core roles.
The Product Owner reviews something that can actually be seen and followed rather than reviewing backend
acceptance screenshots.

Frontend implementation then proceeds by complete user journeys, not by mirroring backend packages or
creating one screen per feature. The AI-first daily workspace must reduce employee effort by composing
Today priorities, Projects, Tasks, research/experiments, connected context, updates, evidence, reminders,
and suggested next actions. Important shared records retain their human confirmation gates.

## 8. Full-Cycle Product Acceptance

The first meaningful Product Owner acceptance gate occurs after the completed engine is exposed through
the integrated final frontend and supports realistic daily-work and evaluation cycles. The acceptance
environment must provide:

- exact local or hosted URLs;
- named synthetic test accounts for every required role;
- realistic Projects, Workstreams, Tasks, Updates, Evidence, responsibility windows, criteria versions,
  and an evaluation cycle;
- a documented employee journey from daily work context through self-assessment;
- a documented research and experiment journey from question and hypothesis through evidence,
  conclusion, decision, and applied learning;
- a documented manager journey from source facts through independent assessment, comparison,
  discussion, and final human decision;
- a Project-owner journey for source documents, Progress Contracts, and operational progress;
- Arabic/English and RTL/LTR verification where approved content permits use;
- desktop and mobile screenshots captured from the real integrated application;
- accessibility checks and browser automation for the protected paths;
- a clear list of missing, partial, deferred, and intentionally out-of-scope behavior.

The Product Owner then evaluates clarity, usability, journey continuity, visual quality, and fitness for
daily work. Until this gate, project reporting must say **technically complete** or **integration-ready**,
not **product accepted**, **UX approved**, or **ready for employee rollout**.

## 9. Verification and Review Policy

- Slice 5 merges only after its already completed technical verification remains green.
- Slice 6 follows its protected specification and privacy/neutrality reviews.
- Later engine work follows the approved roadmap and adds a bounded specification where a capability,
  such as Research & Experiments, is not yet represented precisely enough for implementation.
- The frontend foundation receives visual Product Owner review before implementation.
- Normal frontend slices use one independent review; protected evaluation slices use one specification
  review and one privacy/security review with bounded remediation of confirmed P0/P1 findings.
- Focused tests run per task, related integration tests per slice, and the full repository suite runs at
  the Phase 2 merge checkpoint and before full-cycle product acceptance.

## 10. Explicit Non-Changes

This sequencing decision does not change any approved rubric, weight, rating anchor, visibility mode,
privacy rule, historical rule, AI boundary, progress rule, or manager authority. It does not authorize
Arabic employee evaluation content, the complete Phase 3 workflow during Slice 6, or a second frontend
architecture. It also does not authorize using research or experiment volume as a performance measure.

## 11. Immediate Transition

After this written decision is reviewed:

1. update the Slice 5 acceptance language from Product Owner UX acceptance to technical acceptance;
2. merge Pull Request #10 after a final same-commit check;
3. update the Slice 6 plan references to the current branch and Pull Request sequence without expanding
   its protected scope;
4. execute Slice 6 under Fast Controlled Execution;
5. replace the post-Slice-6 frontend transition with a bounded engine-completion roadmap covering the
   remaining approved pilot services and the Research & Experiments capability;
6. maintain the feature register during engine execution and perform the final capability audit after
   engine completion;
7. design and build the full frontend from the audited engine inventory;
8. do not request final product acceptance until complete daily-work, research/experiment, and evaluation
   cycles are runnable through the final frontend.
