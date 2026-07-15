# PROJECT_STATE.md

## Current Goal

Start implementation of the complete Evidence-Based Performance Evaluation System for the LeapAI AI Department using the corrected Starter Pack Revision 1.1.

## Current Reality

- Product and workflow discovery is complete.
- `PROJECT_REFERENCE.md` Revision 1.1 is approved for implementation.
- `EVALUATION_RUBRIC.md` Revision 1.1 defines the English source rubric and bilingual governance.
- `IMPLEMENTATION_PLAN.md` Revision 1.1 contains the corrected architecture and build sequence.
- `TASKS.md` contains 77 phase-valid tasks with no later-phase dependency.
- AI Router, Worker infrastructure, evaluation eligibility, localization, Arabic rubric approval, and DAG validation are Phase 0 foundations.
- No code repository has been created yet.
- The first synchronized external source is GitHub.

## Active Decisions

- Modular monolith with separate Web, API, and Worker processes.
- TypeScript, Next.js, NestJS, PostgreSQL, Prisma, Redis/BullMQ, S3-compatible storage.
- OIDC authentication and scoped RBAC.
- GitHub App integration.
- Provider-neutral AI Router with local and external models.
- Arabic-first RTL pilot with English support.
- Approved bilingual rubric content is required before employee rollout.
- Thursday check-in applies only when no substantive update exists.
- Monthly Evaluation Readiness Review surfaces thin records without evidence quotas.
- Evaluation Fact View separates normalized facts from employee interpretation.
- Cycle 1 is `Calibration — Non-Baseline`.
- The manager issues final employee ratings.
- AI never assigns or recommends ratings.
- Pilot upward manager evaluation is `Identified`.
- The manager sees submitter identity, completion status, ratings, comments, and timestamps.
- Future Manager-Blinded and Anonymous Aggregated modes remain configurable.
- Manager sees operational Documentation Readiness states, not employee percentages or ranking.
- Historical records and closed evaluations are preserved.

## Protected Areas

- AI-rating prohibition.
- Documentation Readiness separation and manager-view limits.
- No employee ranking or activity-volume performance.
- Identified pilot feedback must not be described as anonymous.
- Feedback visibility mode is frozen per cycle.
- Active-cycle and closed-cycle immutability.
- Criteria effective dates and no retroactive application.
- Human final employee evaluation.
- Audit requirements.
- Cycle 1 calibration status.
- Arabic/English criterion version integrity.
- Evaluation Fact View distinction between facts and interpretation.

## Active Risks

- Workflow burden could reduce adoption.
- Employees may soften manager feedback because the pilot is identified.
- AI summaries and criteria may vary by model.
- Arabic translations may change criterion meaning if not reviewed carefully.
- Configuration UI may become complex.
- Attribution disputes may become operationally heavy.
- GitHub evidence may be overvalued despite explicit controls.
- Complete-system scope requires disciplined implementation order.

## Next Recommended Action

Create the repository and execute Tasks T001–T017.

Do not begin feature UI work before completing:

- Identity and permission boundaries.
- Database versioning and audit.
- AI Router and Worker foundation.
- Evaluation eligibility snapshot.
- Localization and RTL foundation.
- Approved Arabic rubric translation.
- Task dependency validation.

## Critical References

- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/REVIEW_RESOLUTION.md`
- `docs/VALIDATION_REPORT.md`
- `AGENTS.md`
- `TASKS.md`
- `project-state/SYSTEM_MAP.html`
