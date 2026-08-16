# Evidence-Based Performance Evaluation System

## AI Implementation Starter Pack — Revision 1.2

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
- Arabic localization, RTL delivery, and Arabic/dialect AI fixtures remain protected foundations; Arabic employee release is gated by semantic approval.
- Cycle 1 is `Calibration — Non-Baseline`.
- The pilot upward manager evaluation is `Identified`.
- The manager sees who submitted, who did not, ratings, comments, and timestamps.
- Future Manager-Blinded and Anonymous Aggregated modes remain configurable.
- The manager sees operational Documentation Readiness states, not individual percentages or ranking.

## Current Status

- Product reference: approved Revision 1.1.
- Evaluation rubric: approved English source Version 1.1.
- Phase 0, Phase 1, Phase 2, and engine checkpoints E3–E7: merged into `main`.
- E7 state: `READY_FOR_FINAL_FRONTEND_DESIGN` (44 capabilities: 39 complete, 2 approved partial, 2 external gates, 1 approved deferred).
- The pilot engine (daily work, Projects, Research, evaluation, coaching, continuity, notifications, reports, administration, recovery) is technically complete and connected. Current Next.js pages are contract-verification surfaces, not the final daily employee/manager interface.
- AI-Native Frontend Phase 0A (product direction definition): complete. Product Owner approved Gate `D0` (Command Brief visual direction) on 2026-08-11.
- AI-Native Frontend Phase 0B (foundation plan): next recommended action, not yet started. Production frontend/Today runtime implementation remains blocked until Phase 0B passes Gate `G0`.
- English Pilot Readiness: available.
- Arabic rubric translation: deferred, draft, and inactive in `deferred/arabic-rubric-v1`.
- Arabic employee release: blocked until T016 approval; other engineering phases are not blocked.
- Architecture: defined.
- Task graph: 77 tasks, valid and acyclic.

## Pending Branch Work (Not Yet Merged)

- Branch `codex/ai-native-frontend-phase-1` (latest commit `9e2162d`, "docs(beta): prepare product owner launch review") contains 123 commits of additional implementation not yet merged into `main`, pending test completion.
- Scope observed on that branch: a built-out AI-native frontend covering Work/Today, universal capture, Projects (governed workspace, ownership transfer, contract-based progress), fact-first evaluation and identified feedback journeys, continuity/handover, manager operations brief, notifications and connection center, reports and safe recovery, and administration capabilities, plus accessible UI primitives, design tokens, and route/contract protection tests.
- This is ahead of what `main` and `PROJECT_STATE.md` currently describe (which still call for writing the Phase 0B foundation plan before any production Today/runtime work begins). Treat this branch as unreviewed, in-progress work awaiting test completion — not as merged, approved, or part of the current baseline.
- No merge has been performed. Do not treat this section as confirmation that Phase 1 frontend work is complete on `main`.

## Recommended First Action

Per `project-state/PROJECT_STATE.md`: write the separate Phase 0B foundation plan from the approved Command Brief direction, including the two bounded human validation sessions required before Gate `G0`. Do not begin Phase 1 runtime or production Today implementation as part of the Phase 0B plan. English-only pilot use of the existing pilot engine is permitted. Do not expose Arabic employee use until the deferred T016 human semantic approvals and activation conditions are complete.

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
