# Phase 9 P9-09 — Trace-safe Suggestion Feedback

## Outcome

The employee can now rate one prepared Work suggestion with a low-effort `Helpful` action or one
explicit improvement category. The feedback remains operational product feedback: it cannot include
free text, a rating, employee performance data, source bodies, or the prepared draft itself.

The server derives the employee from the authenticated principal, verifies ownership of the prepared
item, stores only the category plus stable output/correlation references, and returns a minimal
receipt. Another employee receives the same privacy-safe not-found response as a missing item.
Idempotency protects retries, and the new history is append-only.

## Files and architecture

- Closed feedback contracts live with Experience Orchestration.
- Experience Orchestration owns the feedback service and persistence boundary.
- The same-origin Work gateway accepts only the strict content-free input.
- Work renders one-click feedback and bilingual improvement categories beneath the prepared item.

No AI prompt, provider route, Project progress rule, evidence rule, evaluation rule, or employee
authority changed.

## Database change

Migration `0043_experience_suggestion_feedback` adds an append-only feedback receipt table linked to
the prepared item and authenticated employee. It stores the output reference and correlation ID for
reproducible internal diagnosis without storing suggestion content.

Migration verification passed from an empty database, from the previous `0042` snapshot, through
drift detection, and through rebuild equivalence. All 43 migrations and 77 database tests passed.

## Verification

- Focused feedback contract, owner/privacy service, same-origin gateway, and Work UI: 4 files / 57
  tests passed.
- Localization catalogs: 2 files / 25 tests passed; localization typecheck passed.
- Contracts, database, API, and web typechecks passed.
- API, web, and contracts lint passed.
- Web production compile passed.
- Protected API matrix passed: 55 controllers / 29 policy rows.
- Frontend boundaries passed: 1,288 files.
- Secret scan passed: 1,995 files.

## Security and privacy impact

Positive: feedback is owner-bound, content-free, strict-schema validated, idempotent, and append-only.
It does not become Project progress, Evidence, Product Telemetry authority, or employee performance.

## Remaining risk

The categories are intentionally fixed for the internal beta. Product review can later refine the
labels from aggregate product friction, but must not add private content or use feedback as an
employee metric.
