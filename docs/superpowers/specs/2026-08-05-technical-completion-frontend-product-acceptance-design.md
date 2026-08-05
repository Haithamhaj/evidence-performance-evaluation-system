# Technical Completion, Full Frontend, and Product Acceptance Sequence

**Status:** Product Owner approved direction on 2026-08-05

**Scope:** Delivery order and acceptance gates after Phase 2 Slice 5

**Protected-rule impact:** None

## 1. Decision

The current Phase 2 interfaces are functional implementation surfaces used to verify domain behavior,
authorization, privacy, localization foundations, and integration. They are not the final product
experience and must not be presented to the Product Owner as sufficient evidence for usability or
product acceptance.

The approved delivery sequence is:

1. Accept and merge Slice 5 on technical evidence.
2. Complete Slice 6 as the final Phase 2 backend/data-preparation slice.
3. Establish the full product frontend foundation in the existing `apps/web` application.
4. Implement Phase 3 as visible vertical slices that deliver backend and frontend together.
5. Run one complete realistic evaluation cycle before requesting product and user-experience
   acceptance.

The dedicated frontend effort is a delivery program inside the existing modular monolith. It does not
create a second product repository, authentication system, API, state store, or competing domain model.
A separate repository would require a later explicit architecture decision.

## 2. Why This Sequence

Three approaches were considered:

1. **Approved — Phase 2 foundation, full frontend foundation, then Phase 3 vertical slices.** This
   exposes real journeys early enough to shape Phase 3 while preserving the verified backend and
   protected boundaries.
2. **Backend-first through all of Phase 3, then frontend.** This may simplify short-term engineering
   sequencing but delays usability feedback and creates a high risk of late API and interaction rework.
3. **Start the full frontend before Slice 6 and Phase 3 contracts.** This produces another prototype
   against incomplete contracts and is likely to repeat the temporary-interface problem.

The approved approach minimizes throwaway UI while avoiding a large frontend retrofit after all backend
decisions have already hardened.

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

Slice 5 and Slice 6 use this technical-acceptance definition. Their temporary or minimal screens may be
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

## 5. Full Frontend Foundation

After Slice 6, the frontend program begins with a design and interaction foundation in `apps/web`:

- one coherent information architecture for employee, manager, Project owner, and administrator roles;
- a reusable bilingual design system with correct RTL/LTR behavior;
- responsive desktop and mobile navigation;
- accessible components, keyboard operation, visible focus, and reduced-motion support;
- compact daily-work patterns rather than configuration-heavy forms;
- consistent loading, empty, error, recovery, confirmation, and audit-history states;
- role-authorized navigation without production persona switches;
- integration with the existing APIs, authentication, and modular domain boundaries;
- realistic synthetic data and stable local preview accounts.

Before implementation, this frontend program requires a visible design gate: journey maps, information
architecture, and high-fidelity clickable flows for the core roles. The Product Owner reviews something
that can actually be seen and followed rather than reviewing backend acceptance screenshots.

## 6. Phase 3 Vertical Slices

Phase 3 is delivered through visible end-to-end slices. Each slice includes its necessary backend,
frontend, authorization, tests, and runnable preview:

1. **Cycle and template foundation:** create the cycle, freeze the approved rubric and visibility mode,
   and preserve `Calibration — Non-Baseline` for Cycle 1.
2. **Evaluation preparation:** integrate the neutral Fact View into the real evaluation journey, with
   source facts shown before employee interpretation.
3. **Employee self-assessment:** use the approved rubric and anchors; AI assistance starts only after
   the employee selects a rating and never recommends a rating.
4. **Independent manager assessment:** keep the manager's initial judgment independent until submitted;
   preserve the manager's human authority and protected visibility rules.
5. **Comparison and discussion:** show differences and supporting context without deciding who is right
   or calculating an automatic final result.
6. **Final manager decision and acknowledgment:** preserve the manager-issued final evaluation,
   employee acknowledgment or reservation, and immutable closure snapshot.
7. **Reports and review readiness:** present the frozen result and audit lineage without ranking,
   payroll, promotion, or disciplinary automation.

No slice is product-accepted merely because its API or provisional screen works. Its technical checkpoint
may merge so the integrated journey can continue safely.

## 7. Full-Cycle Product Acceptance

The first meaningful Product Owner acceptance gate occurs after the integrated Phase 3 frontend supports
one complete realistic cycle. The acceptance environment must provide:

- exact local or hosted URLs;
- named synthetic test accounts for every required role;
- realistic Projects, Workstreams, Tasks, Updates, Evidence, responsibility windows, criteria versions,
  and an evaluation cycle;
- a documented employee journey from daily work context through self-assessment;
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

## 8. Verification and Review Policy

- Slice 5 merges only after its already completed technical verification remains green.
- Slice 6 follows its protected specification and privacy/neutrality reviews.
- The frontend foundation receives visual Product Owner review before implementation.
- Normal frontend slices use one independent review; protected evaluation slices use one specification
  review and one privacy/security review with bounded remediation of confirmed P0/P1 findings.
- Focused tests run per task, related integration tests per slice, and the full repository suite runs at
  the Phase 2 merge checkpoint and before full-cycle product acceptance.

## 9. Explicit Non-Changes

This sequencing decision does not change any approved rubric, weight, rating anchor, visibility mode,
privacy rule, historical rule, AI boundary, progress rule, or manager authority. It does not authorize
Arabic employee evaluation content, the complete Phase 3 workflow during Slice 6, or a second frontend
architecture.

## 10. Immediate Transition

After this written decision is reviewed:

1. update the Slice 5 acceptance language from Product Owner UX acceptance to technical acceptance;
2. merge Pull Request #10 after a final same-commit check;
3. update the Slice 6 plan references to the current branch and Pull Request sequence without expanding
   its protected scope;
4. execute Slice 6 under Fast Controlled Execution;
5. stop after Slice 6 technical completion to design the full frontend foundation visibly;
6. do not request final product acceptance until the complete Phase 3 cycle is runnable.
