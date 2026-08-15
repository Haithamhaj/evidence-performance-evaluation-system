# Phase 7 Manager Operations — P7-07 through P7-11

## Outcome

- P7-07: acting ownership now shows the exact Project/Workstream scope, allowed actions, start/end
  window, delegate confirmation, access-gap count, activation, and expiry. The employee chosen as
  delegate must confirm both receipt and access; the manager remains the human activator.
- P7-08: the acting owner prepares a return draft, the original owner confirms it, and the manager
  finalizes the return. Elapsed authority is projected as expired immediately even before a background
  state refresh. Authoritative deactivation reassignment cases also enter the manager ownership queue.
- P7-09: the Manager Command Brief selects one source-backed operational queue item as the next
  suggestion. It explains the source condition and links to the existing protected action; it does not
  execute a command or make a personnel judgment.
- P7-10: strict manager and continuity projections plus focused negative assertions exclude readiness
  percentages, ranking, leaderboard, productivity/predicted rating, activity-volume inference, and
  private handover bodies.
- P7-11: CAP-037–038 product entry points are reconciled in the capability matrix and Phase 7 is ready
  to hand off to Phase 8.

## Files and modules changed

- `apps/api/src/continuity`: role-aware delegation/return projection with effective expiry.
- `apps/api/src/daily-work`: authoritative deactivation reassignment cases in manager ownership work.
- `apps/web/src/product-ui/continuity`: exact-scope acting ownership and return human gates.
- `apps/web/src/app/api/continuity`: strict same-origin delegation/return commands without browser
  actor or manager identity.
- `apps/web/src/app/[locale]/manager/operations`: one bounded source-backed operational suggestion.
- English/Arabic catalogs, capability matrix, and project state.

## Database changes

None. Existing delegation periods/scopes, confirmations, responsibility windows, return handovers,
and reassignment queue records are reused.

## Verification

- Ten focused files passed 46 tests, including the PostgreSQL Continuity API journey, acting-authority
  expiry, delegation and return domain tests, manager reassignment projection, localization, gateway,
  and UI journeys.
- API, Web, and localization type checks passed; affected lint and formatting passed.
- Protected API matrix passed with 55 controllers and 29 policy rows.
- Frontend boundaries passed across 1,263 files; secret scan passed across 1,959 files.
- A fresh Web production build compiled and generated the continuity and manager routes.

## Security and privacy impact

- The server derives manager, employee, owner, and confirming actor identities from the authenticated
  principal. Browser payloads cannot inject manager/actor identity.
- Acting authority stays limited to the persisted scope, action, and time window. UI projection marks
  elapsed access expired; the engine remains the authority for command permission.
- Return requires distinct acting-owner draft, original-owner confirmation, and manager finalization.
- Manager suggestions use only authorized operational queue records and cannot score, rank, predict,
  or decide for employees.
- Handover body content remains absent from the manager projection.

## Remaining risk

- Authenticated Product Owner visual acceptance remains deferred at the user's direction; automated
  behavior, authorization, type, and build proof are the current acceptance evidence.
- Production notification/email delivery and Google/GitHub setup remain external administrator gates
  for Phase 8.
