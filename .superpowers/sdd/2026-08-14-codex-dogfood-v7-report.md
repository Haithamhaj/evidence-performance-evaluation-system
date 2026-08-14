# Codex Dogfood Project Document v7 — Task Report

## Scope

Create the current bounded Project source, preserve v1–v6, select the current Phase 1 Pull Request
lineage, and prepare the repository checkpoint before running the real local append and AI draft.

## Changes

- Added Project Document v7 with the current verified baseline and seven remaining stage gates.
- Defined `stage_gate` with no weights and one zero-violation operational KPI.
- Excluded Task, Update, GitHub, commit, file, line, Evidence, Research, and Experiment volume from
  Project progress.
- Restricted the dogfood seed to the v7 document only.
- Updated dogfood lineage from obsolete Pull Request #5 to current Pull Request #30.
- Preserved save, submission, approval, and activation as direct human gates while letting AI prepare
  the source-backed draft and clarification context.
- Aligned Progress Contract decision reasons with the existing 500-character append-only audit limit.
- Made the Project progress page tolerate known adjacent Project fields without weakening validation
  of the core contract, components, snapshots, or progress projection.

## Database changes

No migration. The local dogfood journey appended document and contract history through existing
services and state transitions; it did not rewrite any historical version.

## Verification

- The original focused set passed 27/27 tests after observed RED cases for the missing v7 source,
  incomplete prompt shape, and prompt-version idempotency lineage.
- The activation follow-up added focused regressions for the audit-reason limit and Project progress
  page compatibility. Both focused files passed (3/3 tests); Contracts, Projects, API, and Web
  typechecks, affected ESLint, Prettier, and diff checks also passed.

## Live dogfood result

- Project Document v7 appended as document version `7`; v1–v6 remain unchanged.
- The first GPT-5.6 Sol response was rejected as `invalid_output`, with no revision persisted.
- Prompt v3 now supplies the complete closed JSON shape, field requirements, no-weight stage-gate
  rules, source-reference rules, and locale-stable field names.
- The dogfood idempotency key now includes the prompt version, preserving the failed v2 lineage and
  starting a new immutable v3 request instead of rewriting history.
- The governed retry succeeded: request `c938a606-be35-453e-98ca-1ae5a708f104`, revision `1`, document
  version `7`, AI run trace `a7db5fcb-473c-493a-9d7d-c9fecf7fd62e`.
- The product displays seven stage gates and one operational KPI, with no weights or official Project
  percentage.
- The Product Owner approved the operating balance: AI prepares, explains, and suggests; the employee
  reviews, edits, confirms, or rejects every official action.
- The human revision was saved, applied to a contract draft, submitted, approved, and activated through
  the existing protected workflow.
- Active contract `d62600c4-1624-44d0-be5f-984a4ec54f0b` is version `1`, state `active`, calculation
  kind `stage_gate`, and is grounded in Project Document version `7`.
- The active contract contains eight components with no weights: seven stage gates and one
  zero-violation operational KPI.
- No Progress Snapshot exists yet. The authoritative API therefore returns
  `awaiting_information` with no official percentage, which truthfully preserves the human-confirmed
  progress boundary.
- A real activation attempt exposed that the UI/API accepted reasons longer than the append-only Audit
  Event limit. The bounded Progress Contract inputs now consistently reject reasons above 500
  characters before persistence.
- The active Project page initially rejected the authoritative response because it contained the
  known adjacent `contractProposal` and `pendingChange` fields. Its local projection now strips only
  unknown top-level composition fields while keeping all core nested progress data strictly validated.

## Security and privacy

No credentials or private source content are stored in the document. AI remains behind the AI Router.
Temporary synthetic login access was revoked after the dogfood journey. The contract crossed the
activation gate only through explicit authorized human decisions; AI did not activate it or calculate
employee performance.

## Remaining gate

The protected activation gate is complete. The next review is visual: refresh the running Project page
and verify the active stage-gate state. It must show the accepted contract context and an honest
awaiting-information state, not invent a percentage. Browser automation could not perform the final
reload because the in-app browser policy rejected that navigation, so the Product Owner must perform
that one manual refresh before the P3-14 visual gate is closed.
