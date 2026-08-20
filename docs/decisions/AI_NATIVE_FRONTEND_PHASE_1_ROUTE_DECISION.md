# AI-Native Frontend Phase 1 Route Decision

**Date:** 2026-08-12

**Owner:** Product Owner

**State:** `PENDING_PRODUCT_OWNER`

**Technical recommendation:** approve Phase 1 and defer physical route deletion

## Recommendation

Approve the Phase 1 experience as the default daily direction, but do **not** physically delete any
retained route in this checkpoint.

The lowest-risk decision is:

1. Treat `/` and `/my-work` as parity-proven for the employee Today experience.
2. Keep `/tasks` because the new compact list/detail is accepted while Board and Calendar still use
   the retained route.
3. Keep every P3–P8 route until its own target phase records focused parity evidence.
4. Keep `/[...unmatched]` permanently as safe recovery.
5. Preserve all Phase 1 rollback flags for the next phase and remove them only in a later bounded
   cleanup after production observation.

## Route disposition proposal

| Route group                                                                           | Evidence state                                                        | Proposed decision now                                                       |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/`, `/my-work`                                                                       | Phase 1 parity proven                                                 | Use the new Today experience; retain route files and rollback flags for now |
| `/tasks`                                                                              | Compact list/detail/create/transition proven; Board/Calendar retained | Retain                                                                      |
| `/settings/connections`                                                               | Connected source journey proven, administration still evolving        | Retain                                                                      |
| `/[...unmatched]`                                                                     | Safe localized recovery                                               | Permanent                                                                   |
| Project, Research, Evaluation, Manager, Admin, Continuity, Development, Notifications | Targeted for P3–P8                                                    | Retain until their target phase proves parity                               |

## Why deletion is deferred

The repository ledger deliberately separates **parity evidence** from **removal approval**. Phase 1
has proven the daily employee and manager-safe journeys, but deleting files now adds no user value and
would remove an immediate rollback option before the remaining frontend phases are built.

This is not a request to reopen the approved Command Brief direction. It is a controlled release
choice: adopt the new experience while retaining reversible routes until their successors are fully
accepted.

## Product Owner decision required

Approve or reject both statements:

- **A. Phase 1 experience:** accept Command Brief Phase 1 as the daily frontend baseline.
- **B. Route handling (recommended):** keep all existing route files and rollback flags during the
  next frontend phase; mark `/` and `/my-work` parity-proven without deleting them.

No merge or physical route retirement is authorized by this pending document.
