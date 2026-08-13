# T099 — Intelligent Universal Capture

## Outcome

The authenticated employee can share mixed text, URL, code, voice, image, or file input without
classifying it first. The server prepares one authorized, source-backed interpretation through the
AI Router, asks at most one missing question, and preserves the raw draft and private save path when
the provider is unavailable.

## Boundaries

- Understand is read/prepare only: it writes no official Update, Evidence, Work Item, Project
  progress, or evaluation record.
- Only authorized Project/Work Item candidates are exposed to the route.
- Uploaded/pasted content remains bounded untrusted input.
- No AI rating, ranking, productivity score, readiness value, or automatic Project progress exists.
- T100 owns the explicit employee Review & Confirmation gate.

## Files and database

- Added the capture-understanding service/controller, protected same-origin adapter, local session
  state, approved sheet UI, route registration, AI evaluation, localized copy, and visual evidence.
- No database or migration change.

## Verification

- Focused unit/route/AI registration and evaluation: 6 files, 38 tests passed.
- API, web, and UI typecheck passed; web production compile passed.
- API, web, and UI lint passed.
- Secret scan passed: 1,859 files.
- The repository-wide AI-boundary scan remains blocked by four pre-existing T096 deep imports in
  Home (`@evaluation/contracts/employee-experience`); no T099 file appears in that failure.
- In-app browser: authenticated desktop Capture and Clarify, 390px mobile, and provider-unavailable
  recovery states captured.

## Remaining risk

Provider output quality/latency needs deployment monitoring. Deterministic fallback is truthful and
private. Review and official command execution are intentionally deferred to T100.
