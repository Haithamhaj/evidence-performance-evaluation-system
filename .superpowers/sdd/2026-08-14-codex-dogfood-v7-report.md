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
- Recorded that save, submission, approval, and activation remain a direct human gate.

## Database changes

None in this repository checkpoint. The later local dogfood command will append one document version
through the existing Documents service; it will not alter a migration or historical version.

## Verification

- The final focused set passed 27/27 tests after observed RED cases for the missing v7 source,
  incomplete prompt shape, and prompt-version idempotency lineage.
- Projects typecheck, affected lint/format, 1,914-file secret scan, and diff check passed.

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
- No save, apply, submit, approve, or activate action was invoked.

## Security and privacy

No credentials or private source content are stored in the document. AI remains behind the AI Router.
The generated contract cannot cross the existing human activation gate.

## Remaining gate

Obtain direct Product Owner approval or edits for the eight exact components and four ambiguities
before any save or activation action.
