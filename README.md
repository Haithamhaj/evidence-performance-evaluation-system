# Evidence-Based Performance Evaluation System

## AI Implementation Starter Pack — Revision 1.1

This folder is the corrected handoff from project discovery, evaluation-rubric design, external review, and implementation planning.

The pilot target is the LeapAI AI Department. The product remains configurable for other departments and organizations.

## Start Here

Read the files in this order:

1. `docs/PROJECT_REFERENCE.md` — approved product and operating reference.
2. `docs/EVALUATION_RUBRIC.md` — Version 1 employee and manager evaluation rubric.
3. `docs/REVIEW_RESOLUTION.md` — decisions taken after the handoff review.
4. `docs/IMPLEMENTATION_PLAN.md` — architecture, modules, data model, integrations, phases, and verification.
5. `docs/VALIDATION_REPORT.md` — automated consistency and dependency verification.
6. `project-state/SYSTEM_MAP.html` — visual operating and architecture map.
7. `TASKS.md` — 77 ordered, dependency-valid implementation tasks.
8. `AGENTS.md` — mandatory operating rules for Codex and other coding agents.
9. `project-state/PROJECT_STATE.md` — short current-state snapshot.
10. `scripts/README.md` — bounded repository-validation scope and known limitations.

The `source/` folder preserves the original master product definition.

## Revision 1.1 Corrections

- AI Router, Worker, eligibility, localization, Arabic rubric approval, and task-DAG validation moved into Phase 0.
- No task depends on a later implementation phase.
- Monthly Evaluation Readiness Review added to reduce thin quarter-end evidence.
- Evaluation Fact View added to reduce self-presentation bias.
- Arabic-first RTL delivery and Arabic/dialect AI fixtures are explicit blockers.
- Cycle 1 is `Calibration — Non-Baseline`.
- The pilot upward manager evaluation is `Identified`.
- The manager sees who submitted, who did not, ratings, comments, and timestamps.
- Future Manager-Blinded and Anonymous Aggregated modes remain configurable.
- The manager sees operational Documentation Readiness states, not individual percentages or ranking.

## Current Status

- Product reference: approved Revision 1.1.
- Evaluation rubric: approved English source Version 1.1.
- Arabic rubric translation: implementation blocker tracked in T016.
- Architecture: defined.
- Task graph: 77 tasks, valid and acyclic.
- Implementation code: not yet scaffolded; repository governance and the approved Phase 0 design are established.
- Implementation: ready to begin.

## Recommended First Action

Create a new Git repository using the monorepo structure in `docs/IMPLEMENTATION_PLAN.md`, then execute Tasks T001–T017.

Do not begin feature UI work before the Phase 0 governance, AI, eligibility, localization, and Arabic-rubric foundations are complete.

## Protected Product Rules

- AI never assigns or recommends performance ratings.
- Documentation Readiness never becomes Performance Score.
- The manager does not see employee readiness percentages or readiness ranking.
- Raw activity count never becomes employee performance.
- Project count never changes Project Contribution weight.
- Active cycles and closed evaluations remain immutable.
- Dynamic criteria never apply retroactively.
- Final employee ratings are human manager decisions.
- Pilot manager feedback must not be described as anonymous.
- Cycle 1 remains Calibration — Non-Baseline.
- Arabic and English rubric versions must preserve the same meaning.
