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

- `scripts/codex-dogfood-runtime.test.ts`: 6/6 passed after an observed RED for the missing v7 source.
- Focused formatting, lint, secret scan, and diff checks are recorded at checkpoint completion.

## Security and privacy

No credentials or private source content are stored in the document. AI remains behind the AI Router.
The generated contract cannot cross the existing human activation gate.

## Remaining gate

Run the real local append and AI generation, review every proposed contract component, and obtain
direct Product Owner approval before any save or activation action.

