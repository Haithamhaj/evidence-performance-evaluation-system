# Phase 7 Manager Operations — P7-04 through P7-06

## Outcome

- P7-04: the manager Command Brief shows only employee-shared development actions and formal plans.
  Private actions, employee-selected private context, and rejection reasons are never queried into
  the projection.
- P7-05: the employee can submit a short leave request by choosing the affected Project or Workstream;
  the manager can approve or reject it with a reason. Existing owner-domain rules keep approved leave
  out of check-in obligations and negative regularity signals.
- P7-06: an approved/active leave exposes a scoped, versioned handover draft. The employee reviews the
  current state, completed/open work, blockers, and next step for each affected scope, then confirms a
  saved revision separately.
- AI remains assistance-only: it may later prepare source-backed wording, but cannot submit leave,
  confirm a handover, appoint a delegate, or make a manager decision.

## Files and modules changed

- `apps/api/src/coaching-development`: shared/formal manager projection and protected reader.
- `apps/api/src/continuity`: role-aware employee/manager continuity projection and protected reader.
- `apps/web/src/product-ui/continuity`: compact Command Brief leave and handover workspace.
- `apps/web/src/app/api/continuity`: bounded same-origin mutation gateway that never accepts browser
  actor, employee, or manager identity.
- `apps/web/src/app/[locale]/manager/operations`: shared/formal coaching panel.
- English/Arabic catalogs, capability matrix, and project state.

## Database changes

None. Existing append-only leave decisions/transitions, eligibility effects, handover revisions, and
coaching/formal-plan records are reused.

## Verification

- Ten focused query, coaching, continuity, gateway, UI, flag, and manager-screen files passed 25 tests.
- The existing PostgreSQL protected Continuity API journey passed after loading the documented local
  test database configuration.
- API and Web type checks passed; affected lint and formatting passed.
- The protected API matrix passed with 55 controllers and 29 policy rows.
- Frontend import boundaries passed across 1,263 files.
- A fresh Web production build compiled and generated the continuity, manager, and same-origin routes.

## Security and privacy impact

- Coaching projection selects only `SHARED` actions or formal plans assigned to the manager.
- Continuity projection returns handover completeness to the manager, not private handover body text.
- Server policies derive every actor from the authenticated principal; browser identity injection is
  rejected by strict same-origin schemas.
- Leave never enters performance scoring, ranking, readiness, or inferred risk.
- Employee confirmation and manager decisions remain separate human gates.

## Remaining risk

- Authenticated Product Owner visual acceptance remains deferred at the user's direction; automated
  interaction, authorization, type, and production-build proof are complete.
- P7-07 delegation/acting authority, P7-08 return/deactivation, P7-09 bounded manager assistance,
  P7-10 negative analytics, and P7-11 capability closure remain.
- Production notification/email delivery still depends on its external provider configuration.
