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
2. Run `pnpm continuity:seed` for a deterministic full lifecycle fixture. It is safe to rerun.
3. Open `/en/continuity` or `/ar/continuity`.
4. The API surface is under `/api/v1/continuity` and requires the existing OIDC bearer authentication.

The seed exercises real database-backed services in this order: approved leave and its neutral eligibility effect; versioned handover and exact-revision employee confirmation; manager-approved delegation and delegate receipt; an access-gap report and manager resolution; atomic acting-owner responsibility and exact action authority; acting-owner return draft, original-owner confirmation, and manager finalization; early return; administrator deactivation; manager queue; and permanent reassignment to a successor. The second run proves idempotent acceptance setup without restoring the deactivated account or duplicating history.

The Arabic route is RTL and the English route is LTR. The checkpoint intentionally explains the engine journey; final daily-work interaction design remains part of the later frontend program.

## Verification evidence

- Contract and domain tests cover minimized leave input, approval scope, leave neutrality, stale handover revisions, sensitive-field rejection, delegate confirmation, access gaps, emergency reason/audit, boundary times, cross-scope denial, return, duplicate reassignment cases, and manager/admin separation.
- Migration verification covers clean installation, upgrade from migration `0032`, append-only history, exact-scope checks, overlap rejection, retention constraints, and schema drift.
- API composition tests prove that controllers derive employee/delegate/manager/admin identity from the authenticated principal rather than trusting body identity fields.
- The PostgreSQL acceptance journey proves the production composition, including one-time delegation-scope binding, early-return responsibility-window correction, resolved manager queue, preserved inactive owner history, and a successor's permanent responsibility window.
- The focused browser journey verifies the bilingual technical checkpoint and RTL/LTR shell.

## Bounded P1 remediation

- Handover confirmation is bound to the exact current revision and stored leave/employee identity; secrets are rejected in keys and values.
- Delegation approval now requires the authoritative approved leave, a confirmed latest handover, eligible owner/delegate, and exact affected scopes. Activation and expiry are manager-authorized and atomically update real responsibility authority.
- Access-gap resolution is append-only, manager-authorized, and blocks activation while unresolved.
- Return is a three-principal workflow: acting-owner draft, original-owner confirmation, then manager finalization. Early return shortens only the continuity acting window and advances its paired scheduled return while the original plan remains preserved in delegation/transfer history.
- Approved leave now has a durable eligibility effect used by check-ins, readiness, and evaluation eligibility. It suppresses absence-based regularity only; missing sources and research decisions remain visible.
- Offboarding creates a durable department-scoped manager queue transactionally, preserves history, and resolves through the existing permanent owner-transfer command.
- Serializable transactions, optimistic version checks, nullable-scope-safe uniqueness, and the real acceptance seed cover concurrent retries and duplicate submission boundaries.

## Remaining operational gates

- Final employee-facing UX is intentionally deferred until the engine inventory and frontend program.
- Hosted CI and deployment-specific observability remain integration checkpoints after this branch is handed back.
- No live AI or external connector is required by E6A, and no provider credential is read or moved.
