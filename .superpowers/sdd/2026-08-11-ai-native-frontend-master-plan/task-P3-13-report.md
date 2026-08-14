# P3-13 — Optional first Auto + Undo gate

## Status

DONE — no production action was selected; `auto_with_undo` remains intentionally disabled.

## Decision

The bounded review considered the existing reversible employee and Project actions. None satisfies
all approved requirements at once: explicit permission, expected version, idempotency, bounded side
effects, a real compensation command, durable receipt, undo expiry, and recovery from partial
failure.

- Connected Google/GitHub Project linking remains employee-confirmed. An unlink command exists, but
  model confidence cannot raise authority and there is no approved durable automatic-action receipt.
- Task state and deadline changes affect shared work and remain human-only.
- Evidence confirmation, progress confirmation, and ownership transfer retain their protected human
  gates.
- Deterministic retirement/dedupe/freshness of presentation projections remains automatic
  maintenance, not an employee-visible Auto + Undo action.

No generic runtime, database table, worker, command, or decorative Done for You interface was added.

## Files changed

- `docs/product/AI_NATIVE_INITIAL_AUTONOMY_MAP.md`
- `project-state/PROJECT_STATE.md`
- `.superpowers/sdd/2026-08-11-ai-native-frontend-master-plan/task-P3-13-report.md`

## Database changes

None.

## Verification

- The gate was checked against the approved Phase 3 plan and H-001–H-016 autonomy map.
- The documentation formatter and `git diff --check` passed.
- No production code changed, so no additional product test suite was required.

## Security and privacy impact

The result preserves every current permission and human gate. AI confidence, telemetry, acceptance
history, activity volume, readiness, and evaluation data still cannot increase authority.

## Remaining risk

A future Product Owner may approve one specifically named low-risk action. That future change must
deliver and verify the complete compensation and durable-recovery path before enabling
`auto_with_undo`.

## Project state

Updated. P3-14 contract-based Project charts are next.
