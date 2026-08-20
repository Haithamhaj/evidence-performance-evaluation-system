# Phase 6 Evaluation — P6-01 through P6-05

## Outcome

The selected Command Brief experience now exposes the existing protected evaluation engine as one
fact-first employee/manager journey:

- P6-01: cycle entry identifies the cycle, deadline, stage, visibility mode, and human-decision
  boundary.
- P6-02: the source-supported Fact View is presented before employee interpretation.
- P6-03: the employee completes one criterion at a time against the approved anchors. The employee
  selects the rating; optional AI assistance only prepares editable wording after that selection.
- P6-04: the manager uses an independent initial draft and records direct-observation context when
  no source reference applies. Employee ratings remain hidden until the manager submits.
- P6-05: comparison appears only after both submissions and shows the two recorded positions and
  factual discussion cues without a midpoint, recommendation, or calculated result.

The English pilot journey is enabled. Arabic/RTL foundations are present, but the employee-facing
Arabic evaluation remains behind the approved T016 language and semantic gate.

## AI and live-provider proof

- All model calls remain inside the existing AI Router.
- The Evaluation justification route uses the registered prompt and structured-output artifacts.
- The service resolves the department authorization scope instead of passing a domain identifier.
- A live governed run completed successfully through OpenAI `gpt-5.6-terra` in 2,799 ms.
- The assistant returned editable wording only after the human selected rating 3; it returned no
  suggested, predicted, or recommended rating.
- The response truthfully disclosed that no authorized supporting facts were available for that
  wording and required human review.

## Files and modules changed

- Evaluation experience and protected same-origin gateway under `apps/web`.
- Evaluation composition and AI-scope resolution under `apps/api`.
- Human-gated wording assistance and prompt artifact under `packages/employee-evaluation`.
- English/Arabic catalog foundations under `packages/localization`.
- Fact View workstream-to-project source resolution under `packages/research-experiments`.
- Governed route registration and GPT-5.6 policy scripts under `scripts`.
- Focused unit and integration fixtures for the affected boundaries.

## Database changes

No schema or migration change. The local dogfood database received only the approved Evaluation AI
route/artifact configuration and the normal append-only AI run trace.

## Verification evidence

- Focused unit/UI/API suites: 6 files, 24 tests passed.
- Direct TypeScript checks: web, API, and employee-evaluation passed.
- Affected lint checks passed before the final verification checkpoint.
- Affected Prettier check passed.
- Live database trace: `evaluation.justification`, state `succeeded`, provider `openai`, model
  `gpt-5.6-terra`, no error category.
- Desktop browser review at 1280 px: no horizontal overflow; cycle, Fact View, self-assessment, fixed
  criterion composition, and protected boundary wording render correctly.

## Security and privacy impact

- No provider credential is exposed, moved, printed, or committed.
- Server-side authorization remains authoritative; the browser receives only the authorized
  evaluation projection.
- Fact View sources remain distinct from employee interpretation.
- Employee and manager drafts remain independent.
- No readiness percentage, ranking, activity-derived metric, or AI rating path was introduced.

## Remaining work and risk

- P6-06 through P6-14 remain: human finalization, acknowledgment/reservation, identified upward
  feedback, exports, preparation-agent closure, fixed-composition proof, Arabic gate proof, negative
  boundary suite, and capability closure.
- Manager final rating is a protected human action. Implementation and verification can continue,
  but the live final rating itself cannot be selected by the assistant.
- Normal deployment-time observation remains necessary for live-provider latency and wording quality.

