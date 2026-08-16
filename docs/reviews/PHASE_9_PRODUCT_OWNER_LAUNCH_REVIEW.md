# Phase 9 Product Owner Internal-Launch Review

## Decision requested

Decide whether to open **Cohort 0 — Codex dogfood** for daily internal use. This is not a production
launch, a department-wide rollout, or approval to retire rollback routes.

## Running review baseline

- Branch: `codex/ai-native-frontend-phase-1`
- Commit: `48633f5`
- English Home: `http://localhost:3000/en`
- Codex Project: `http://localhost:3000/en/projects/c2ab037e-e945-4ed9-a6cd-756099e2b066`
- Work: `http://localhost:3000/en/tasks`
- Local API readiness: `http://localhost:3001/health/ready`

The local environment currently contains the real Codex dogfood Project, seven Work Items, three
private Inbox captures, Project Document version 8, and one live OpenAI-generated Progress Contract
draft in `ready` state. The draft remains behind `human_activation_required`; no AI output changed
official Project progress or bypassed owner approval.

Live trace for the bounded draft run:

- Request: `8876c9b0-c85c-49cc-b660-15bc233350c0`
- AI run trace: `2197bd1a-0aef-4d6b-92ec-4c382c4befd5`

These identifiers are local synthetic acceptance references, not provider credentials.

## Review journey

1. Open **Home** and confirm the first screen explains the current day at a glance: decisions,
   prepared help, due work, confirmed Project progress, and the next source-backed action.
2. Open the **Evidence Performance System — Phase 2** Project and confirm that progress, current
   milestone, KPI context, next action, source, and freshness are understandable without opening
   technical records.
3. Open **Work** and confirm that normal Task creation, detail, and allowed status transitions feel
   like daily work rather than an evaluation form.
4. Use **Share anything** with text or a link. Confirm that the assistant prepares a private draft,
   asks only for missing context, and waits for employee review.
5. Review the prepared Progress Contract draft. Confirm that Codex can edit, reject, or approve it,
   and that activation remains a human decision.
6. Inspect one prepared suggestion and submit either `Helpful` or one fixed improvement category.
   Confirm that this feedback is clearly about the product and does not become employee evaluation,
   Project progress, Evidence, or manager judgment.
7. Confirm that manual work remains available when an AI or connector is unavailable.

## Product rules to verify visually

- Project progress comes only from approved contract rules or authorized human confirmation.
- Project progress is not employee performance.
- GitHub remains suggested Evidence until employee confirmation.
- AI prepares and explains; the employee edits, accepts, rejects, or ignores.
- AI never recommends a rating, ranking, productivity score, or performance judgment.
- Private employee source context is not exposed to managers.
- Retained routes and feature-level rollback remain available during Cohort 0.

## Technical evidence already complete

- Protected API matrix: 55 controllers / 29 policy rows passed.
- Frontend boundaries: 1,288 files passed.
- Secret scan: 1,995 files passed.
- Product-performance input boundary: 668 runtime files passed.
- Localization: 25 tests passed.
- Storybook critical journeys: 7 tests passed.
- Database verification: 43 migrations and 77 database tests passed from empty and previous release
  states with no drift.
- Web production compile and affected API/web/contracts checks passed.

Detailed evidence is recorded in `docs/reviews/PHASE_9_INTERNAL_BETA_RELEASE_EVIDENCE.md`.

## Known bounded constraints

- External production identity, Google, GitHub, email, storage, telemetry, deployment, backup, and
  restore remain administrator/accountable-human gates.
- Arabic daily-work foundations remain present, but Arabic employee evaluation is not released until
  the approved rubric translation and semantic review gate is complete.
- Real-user Core Web Vitals and product analytics require an approved internal deployment and privacy
  sink; local numbers must not be represented as deployed-user evidence.
- Retained Board, Calendar, and legacy Work routes stay available until this review accepts the final
  baseline and the separate P9-02 retirement checkpoint is completed.

## Recommendation

Approve **Cohort 0 only** if the visible journey is understandable and feels light enough for daily
employee use. Keep all rollback flags, require weekly product review, and do not expand to Cohort 1
until one realistic workday completes without unresolved P0/P1 defects.

## Product Owner decision

- [ ] Approve Cohort 0.
- [ ] Approve Cohort 0 with named corrections.
- [ ] Do not approve; return to the named journey or rule.

The decision must be recorded by the Product Owner after reviewing the running product. Code or AI
must not mark this gate approved automatically.
