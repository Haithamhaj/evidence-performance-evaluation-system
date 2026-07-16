# PROJECT_STATE.md

## Current Goal

Execute the approved Phase 0 foundation plan (T001–T017) through Subagent-Driven Development, stopping only at the direct Arabic human-approval gate or another defined external blocker.

## Current Reality

- Approved product, rubric, architecture, review-resolution, and Phase 0 design artifacts govern implementation.
- The detailed Phase 0 plan is `docs/superpowers/plans/2026-07-15-phase-0-foundation-plan.md` on branch `codex/phase-0-foundation` in an isolated worktree.
- `TASKS.md` contains 77 phase-valid tasks. Five declarations were corrected with eight edges: `T003->T002`, `T009->T007`, `T009->T008`, `T010->T009`, `T013->T004`, `T013->T009`, `T013->T011`, and `T014->T009`.
- The local runtime is ready. Execute project commands in one shell with: `source .superpowers/runtime-env.zsh && node --version && pnpm --version && docker version --format '{{.Client.Version}}/{{.Server.Version}}' && docker compose version`. Verified values are Node `24.18.0`, pnpm `11.13.0`, Docker client/server `29.6.1/29.5.2`, and Compose `5.3.1`.
- The private GitHub repository is `https://github.com/Haithamhaj/evidence-performance-evaluation-system`; `main` is the default branch.
- Phase 0 Tasks T001–T015 are implemented and independently approved. Approved English rubric Version 1 is seeded as immutable, source-hashed infrastructure content with atomic bootstrap audit; the provider-neutral AI Router, bounded layered boundary controls, deterministic bilingual AI evaluation harness, durable worker/queue foundation, frozen evaluation-eligibility snapshots, and Arabic-first RTL application shell are complete; Arabic rubric approval remains a separate T016 gate before employee-facing use.

## Active Decisions

- Subagent-Driven Development is selected: one fresh implementer and independent task review per task, followed by whole-branch review.
- Phase 0 remains a modular monolith with separate Web, API, and Worker processes; PostgreSQL is authoritative and asynchronous work uses Redis/BullMQ.
- Arabic is the pilot default with English support, RTL, and `Asia/Riyadh` as the default display timezone.
- Pilot upward feedback remains `Identified`; authorized managers see identity, completion status, ratings, comments, and timestamps.
- AI never assigns/recommends ratings or rankings, and Documentation Readiness never becomes a performance input.
- Audit composition uses a lower-level writer port; persistence packages do not depend on the audit package.
- T011 boundary tooling is intentionally bounded: direct provider imports and the committed direct/meta-call cases are enforced without current-codebase false positives. Complete closure/container/reflection value-flow analysis is out of scope and remains covered by runtime provider-key isolation, CI import scanning, and human review. This narrows tooling only; the protected AI-Router-only rule is unchanged.
- T012 uses versioned English/Arabic fixtures, strict manifest and visibility contracts, synthetic Gulf/Levantine audio with provenance and checksums, whole-case timeouts, distinct-adapter fallback tests, and a manual environment-gated live-evaluation workflow. Full STT-quality evaluation remains assigned to T032/T044.
- T013 uses durable operation records, bounded database transactions for protected effects, stable external-provider idempotency keys with constrained receipts, lifecycle-managed BullMQ workers, and the exact approved BullMQ `5.80.3` version.
- T014 freezes versioned cycle eligibility and visibility mode at opening, exposes immediate `Identified` completion status without a full-team publication gate, and permits only a pre-close `pending` or `approved_leave` exclusion with bounded timestamps and an exact same-transaction audit event enforced at the persistence boundary.
- T015 uses key- and placeholder-compatible Arabic/English catalogs, Arabic-default production routing, localized direction-safe 404/error shells, bounded user-visible-copy enforcement, locally licensed fonts, and production-build Chromium verification. The exact approved `Identified` notice is pinned in both locales.

## Active Risks

- T016 cannot complete until separate Arabic subject-matter and employee-comprehension reviewers directly approve the exact review inventory.
- GitHub-hosted CI evidence depends on external runner availability after local verification.
- Locked package versions or immutable service images may expose compatibility issues during the first clean install or real integration run.
- The bounded static checker is not a proof of all possible JavaScript value flows; provider credential isolation and human review remain mandatory defense layers.
- Optional live-provider evaluations require protected environment credentials; deterministic T012 checks remain the required offline/CI baseline.
- External exactly-once effects in T013 depend on the downstream provider honoring the stable idempotency key; the platform records a safe durable receipt and does not claim stronger guarantees.
- T015 relies on Next.js `globalNotFound`, which is experimental in pinned Next `16.2.10`; production browser tests pin expected behavior and a future Next upgrade requires compatibility review.

## Protected Areas

- Protected rules in `AGENTS.md`, especially AI-rating prohibition, readiness separation, no employee ranking/activity-volume performance, identified-mode truthfulness, historical immutability, audit, and bilingual rubric integrity.
- `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, `docs/IMPLEMENTATION_PLAN.md`, and the approved Phase 0 design cannot be rewritten to fit implementation without explicit approval.

## Next Recommended Action

Push the independently approved T015 localization and RTL foundation, then execute T016 until the protected Arabic subject-matter and employee-comprehension approval gate is reached.

## Critical References

- `AGENTS.md`
- `TASKS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/superpowers/specs/2026-07-15-phase-0-foundation-design.md`
- `docs/superpowers/plans/2026-07-15-phase-0-foundation-plan.md`
