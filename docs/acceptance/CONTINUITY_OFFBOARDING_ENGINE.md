# Continuity & Offboarding Engine — Technical Acceptance

## Outcome

E6A now provides one bounded continuity domain for approved leave, versioned handover, exact temporary authority, return, account deactivation, reassignment-required cases, and retention foundations. This is a technical verification surface, not the final employee-facing product design.

## Protected behavior

- Approved leave removes check-in obligations and never creates a negative regularity or performance signal.
- Leave records contain only a period, a minimal category, and affected Project/Workstream scopes. They contain no balance, payroll, entitlement, or medical narrative.
- Normal delegation needs manager approval and the delegate's receipt/access confirmation. An open access gap blocks activation.
- Emergency delegation needs a non-empty manager reason and an append-only audit event.
- Acting authority is checked at request time against one exact action, one exact Project/Workstream, and a half-open UTC period (`startsAt <= now < endsAt`).
- Acting authority cannot transfer permanent ownership.
- Return immediately ends temporary authority while preserving the handover and responsibility history.
- Deactivation blocks later authentication without deleting the user or historical foreign keys.
- System Administrators deactivate accounts; only the authorized manager resolves permanent reassignment through the existing Projects owner-transfer command.
- Retention is archive/policy based. Automatic historical deletion is prohibited by schema constraints.

## Runnable checkpoint

1. Start the standard local infrastructure and application.
2. Run `pnpm continuity:seed` for a deterministic approved-leave and active-delegation fixture.
3. Open `/en/continuity` or `/ar/continuity`.
4. The API surface is under `/api/v1/continuity` and requires the existing OIDC bearer authentication.

The Arabic route is RTL and the English route is LTR. The checkpoint intentionally explains the engine journey; final daily-work interaction design remains part of the later frontend program.

## Verification evidence

- Contract and domain tests cover minimized leave input, approval scope, leave neutrality, stale handover revisions, sensitive-field rejection, delegate confirmation, access gaps, emergency reason/audit, boundary times, cross-scope denial, return, duplicate reassignment cases, and manager/admin separation.
- Migration verification covers clean installation, upgrade from migration `0032`, append-only history, exact-scope checks, overlap rejection, retention constraints, and schema drift.
- API composition tests prove that controllers derive employee/delegate/manager/admin identity from the authenticated principal rather than trusting body identity fields.
- The focused browser journey verifies the bilingual technical checkpoint and RTL/LTR shell.

## Remaining operational gates

- Final employee-facing UX is intentionally deferred until the engine inventory and frontend program.
- Hosted CI and deployment-specific observability remain integration checkpoints after this branch is handed back.
- No live AI or external connector is required by E6A, and no provider credential is read or moved.
