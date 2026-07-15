# PROJECT_STATE.md

## Current Goal

Execute the approved Phase 0 foundation plan (T001–T017) through Subagent-Driven Development, stopping only at the direct Arabic human-approval gate or another defined external blocker.

## Current Reality

- Approved product, rubric, architecture, review-resolution, and Phase 0 design artifacts govern implementation.
- The detailed Phase 0 plan is `docs/superpowers/plans/2026-07-15-phase-0-foundation-plan.md` on branch `codex/phase-0-foundation` in an isolated worktree.
- `TASKS.md` contains 77 phase-valid tasks. Five declarations were corrected with eight edges: `T003->T002`, `T009->T007`, `T009->T008`, `T010->T009`, `T013->T004`, `T013->T009`, `T013->T011`, and `T014->T009`.
- The local runtime is ready. Execute project commands in one shell with: `source .superpowers/runtime-env.zsh && node --version && pnpm --version && docker version --format '{{.Client.Version}}/{{.Server.Version}}' && docker compose version`. Verified values are Node `24.18.0`, pnpm `11.13.0`, Docker client/server `29.6.1/29.5.2`, and Compose `5.3.1`.
- The private GitHub repository is `https://github.com/Haithamhaj/evidence-performance-evaluation-system`; `main` is the default branch.
- Phase 0 Tasks T001–T010 are implemented locally. Approved English rubric Version 1 is seeded as immutable, source-hashed infrastructure content with atomic bootstrap audit; Arabic approval remains a separate T016 gate before employee-facing use.

## Active Decisions

- Subagent-Driven Development is selected: one fresh implementer and independent task review per task, followed by whole-branch review.
- Phase 0 remains a modular monolith with separate Web, API, and Worker processes; PostgreSQL is authoritative and asynchronous work uses Redis/BullMQ.
- Arabic is the pilot default with English support, RTL, and `Asia/Riyadh` as the default display timezone.
- Pilot upward feedback remains `Identified`; authorized managers see identity, completion status, ratings, comments, and timestamps.
- AI never assigns/recommends ratings or rankings, and Documentation Readiness never becomes a performance input.
- Audit composition uses a lower-level writer port; persistence packages do not depend on the audit package.

## Active Risks

- T016 cannot complete until separate Arabic subject-matter and employee-comprehension reviewers directly approve the exact review inventory.
- GitHub-hosted CI evidence depends on external runner availability after local verification.
- Locked package versions or immutable service images may expose compatibility issues during the first clean install or real integration run.

## Protected Areas

- Protected rules in `AGENTS.md`, especially AI-rating prohibition, readiness separation, no employee ranking/activity-volume performance, identified-mode truthfulness, historical immutability, audit, and bilingual rubric integrity.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, `docs/IMPLEMENTATION_PLAN.md`, and the approved Phase 0 design cannot be rewritten to fit implementation without explicit approval.

## Next Recommended Action

Complete independent review of T010, then execute T011 (AI Router) using TDD and the selected Subagent-Driven Development review loop.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/superpowers/specs/2026-07-15-phase-0-foundation-design.md`
- `docs/superpowers/plans/2026-07-15-phase-0-foundation-plan.md`
