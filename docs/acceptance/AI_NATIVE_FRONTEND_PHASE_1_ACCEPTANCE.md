# AI-Native Frontend Phase 1 Acceptance

**Date:** 2026-08-12

**Branch:** `codex/ai-native-frontend-phase-1`

**Pull Request:** #30, draft and unmerged

**Technical state:** `READY_FOR_PRODUCT_OWNER_REVIEW`

**Protected gate:** route retirement and merge remain Product Owner decisions

## Executive result

The Command Brief Phase 1 daily journey is technically complete and runnable. A signed-in employee
can start from one explained decision, review one prepared action, see authorized daily work, capture
a private note, receive a durable What Changed receipt, create and transition a Project-linked Task,
and turn a verified GitHub suggestion into evidence only after editing and explicitly confirming it.

A manager now lands on the operational manager home rather than the employee Today experience. The
manager can act on delivery and governance queues, but cannot see or create employee-private source
context. No acceptance-only business command or authorization bypass was introduced.

## Complete user journey

1. The employee opens Today and sees one decision, one prepared draft, and compact work groups.
2. Capture stores text/link/code/file/image input in the employee's private Inbox only.
3. What Changed shows the durable, owner-filtered capture receipt.
4. Work creates a Project-linked Task through the existing Work Items command.
5. The detail sheet offers only transitions allowed by the Work Items domain.
6. Source Review combines private Google context, suggested GitHub evidence, and manual capture.
7. GitHub stays linked to its source-verified Project and remains a suggestion.
8. Evidence requires an employee edit and a separate confirmation.
9. The confirmation receipt states that Project progress and employee evaluation did not change.
10. The manager home presents operational queues and excludes employee-private Capture and sources.

## Fresh acceptance evidence

| Proof                      | Result                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Employee journey           | Pass — Capture → receipt → Task create/transition → GitHub evidence edit/confirm    |
| Manager-safe journey       | Pass — role-aware home, operational queues, no Capture, no private source review    |
| Explicit rollback          | Pass — retained My Work, Tasks, Board, Calendar, source, and refresh paths restored |
| Focused role/flag model    | Pass — 13 tests                                                                     |
| Phase 1 browser acceptance | Pass — 2 normal journeys and 1 rollback journey                                     |
| Web type check             | Pass                                                                                |

The browser test uses realistic deterministic local data and the same protected web gateways and
commands used by the product. It does not pretend to prove live Google/GitHub provider uptime; those
remain deployment integrations with their own recovery paths.

## Screenshots

- `docs/product/screenshots/ai-native-phase-1/t094-employee-complete.png`
- `docs/product/screenshots/ai-native-phase-1/t094-manager-safe-shell.png`
- `docs/product/screenshots/ai-native-phase-1/t094-retained-routes.png`
- The complete per-slice set is retained beside these T094 captures (`t087` through `t093`).

## Rollback result

The Phase 1 server flags can independently restore the retained Today, Work, source-review, and
explicit What Changed behavior. Rollback does not delete or rewrite Tasks, private Inbox records,
receipts, evidence revisions, confirmations, or append-only history.

## Protected-boundary result

- AI does not assign, predict, or recommend employee ratings.
- No activity count, Task volume, update frequency, commit count, or GitHub volume becomes Project
  progress or employee performance.
- Project progress remains governed by the approved Progress Contract and human confirmation.
- Google/manual context remains employee-private; GitHub remains suggested evidence only.
- Evidence confirmation remains a deliberate employee action after editing.
- Manager operations remain separate from evaluation and do not expose individual readiness values.

## Honest limitations and next refinements

- Source Review can become long for a heavily connected mailbox. Pagination/grouping is a useful P2
  interaction refinement, but it does not block the protected daily journey.
- Live provider quality, latency, consent, minimum permissions, and administrator configuration are
  deployment concerns; the UI retains manual and deterministic recovery paths.
- Arabic employee evaluation content remains blocked by the existing T016 language gate. This does
  not block the Arabic daily-work and task-management surfaces already verified here.
- The new Work surface covers compact list, detail, create, and valid transitions. Retained Board and
  Calendar remain available and should not be retired in this gate.

## Gate state

Phase 1 technical acceptance is complete. No route has been deleted and neither Pull Request #29 nor
#30 has been merged. The next action is direct Product Owner review of the running journey and the
route recommendation in `AI_NATIVE_FRONTEND_PHASE_1_ROUTE_DECISION.md`.
