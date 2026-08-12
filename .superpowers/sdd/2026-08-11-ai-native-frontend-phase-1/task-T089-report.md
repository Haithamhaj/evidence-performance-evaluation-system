# T089 implementation report

## Outcome

Implemented a bounded Minimal Experience Orchestrator that composes at most one authorized,
source-backed next action or clarification question and waits for the employee. The on-demand API
uses only the exported Context Intelligence review queue and Daily Work snapshot. It never executes
an owning-domain command.

## Changes

- Added strict versioned contracts for orchestration states, one-item composition, source references,
  freshness, consequence, editable draft, assistance label, route trace, and worker job input.
- Added an employee-only API composition above the two existing authorized readers.
- Added a governed `experience.prepare-next.v1` route through the existing AI Router, with registered
  prompt/output artifacts and a confidential source trace.
- Added truthful deterministic selection when AI is disabled or specifically unavailable. It never
  claims an AI result or route trace.
- Added append-only/idempotent prepared-item persistence in migration `0041_experience_orchestration`.
- Added a dedicated worker lifecycle and closed BullMQ runtime for `experience.prepare-next` and
  excluded it from the generic test processor, preventing two consumers from binding the job. Replay
  uses the employee plus idempotency key against this domain's deterministic projection; no scheduler
  or owning-domain command was added.
- Added focused AI evaluation fixtures for Arabic/mixed input, prompt isolation, prohibited outputs,
  trusted provenance, and human review.
- Added a bilingual production semantic quarantine before every AI-assisted or deterministic append.
  It rejects rating/rank/readiness and calculated-progress language. Productivity and activity-volume
  wording is rejected only when connected to scoring, judgment, or employee performance, allowing
  neutral work such as developer-productivity tooling and commit-count logging.
- Cached results now recompute staleness at read time and return a stale projection without updating
  the append-only stored row.

## Verification

- Initial focused RED/GREEN: 5 files, 16 tests passed.
- Bounded remediation RED/GREEN: 31 focused contract/API/worker/registration assertions passed for
  semantic quarantine, cached staleness, and the dedicated worker runtime.
- AI evaluation: 4 bilingual protected-output and neutral-language fixtures passed.
- Migration verification: 41 migrations; empty database, previous snapshot, drift, and rebuild
  equivalence passed; 77 database integration tests passed.
- `@evaluation/contracts`, `@evaluation/api`, `@evaluation/worker`: lint and typecheck passed.
- AI provider boundary and secret scan passed.

## Database impact

Migration 0041 adds one append-only `ExperiencePreparedItem` table. It stores only the versioned
prepared projection, opaque source references, source/preparation timestamps, assistance truth label,
output reference, and correlation. No rating, readiness, progress, or command state is stored.

## Security / privacy / AI impact

- The orchestrator cannot query owning tables and cannot broaden reader access.
- Inactive or non-employee/non-contributor actors are rejected.
- Wrong-user sources are excluded by the owning authorized readers and verified by a negative test.
- Provider calls use the AI Router only; no provider SDK or direct provider import was added.
- Model-authored provenance and raw private-body fields are rejected by strict schemas. Bilingual
  prohibited semantics are quarantined before persistence, and the worker reads only its own
  deterministic projection rather than another module's tables.

## Remaining bounded work

The controller owns authenticated browser acceptance, screenshots, and final Task/project-state
updates. One live AI probe was quarantined without exposing content; additional prompt tuning is a
non-blocking follow-up because the deterministic fallback remains truthful. T090 owns
confirm/correct/dismiss and Intelligent Today composition.
