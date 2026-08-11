# AI-Native Phase 1–2 Exact Implementation Handoffs

**Status:** Phase 0B implementation contract  
**Machine authority:** `docs/product/ai-native-phase-1-2-handoffs.json`  
**Source experience definition:** `docs/product/AI_NATIVE_PHASE_1_3_HANDOFFS.md`  
**Engine schema:** `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`

## Purpose

This register turns the approved Phase 1–2 experience moments into exact current reader, command,
state, Work Signal, Experience Event, future SSE, test, and rollback references. It does not create
runtime behavior. A `NONE` reader is an explicit engine delta for a later vertical slice, not
permission to infer the result in the browser.

## Closed Phase 1–2 set

| Handoff                | Surface                    | Existing authority                            | G0-safe disposition                                                       |
| ---------------------- | -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `P1-SESSION-RECOVERY`  | Stable Shell recovery      | `MeController.me`                             | Explicit authenticated read; no SSE                                       |
| `P1-TODAY-READ`        | Today                      | `DailyWorkQueryService.dailyWorkspace`        | Existing deterministic snapshot; composition/stream after G0              |
| `P1-PREPARED-DECISION` | Needs Your Decision        | Context Intelligence review/confirm/correct   | Existing protected commands; receipts after G0                            |
| `P1-WHAT-CHANGED`      | What Changed               | No cross-domain public composition reader yet | Add bounded receipt composition after G0; entry remains inert in Phase 0B |
| `P1-UNIVERSAL-CAPTURE` | Global Capture             | Private Inbox reader/capture/promote          | Manual path is already complete; AI preparation after G0                  |
| `P1-TASK-CREATE`       | Task creation              | Work Items read/create                        | Existing protected command                                                |
| `P1-TASK-TRANSITION`   | Today Task action          | Work Items read/transition                    | Existing protected command; durable receipt after G0                      |
| `P1-CONNECTED-CONTEXT` | Gmail/Calendar review      | Connected Context read/link/unlink            | Employee-private, protected commands; refresh receipts after G0           |
| `P1-GITHUB-EVIDENCE`   | Evidence suggestion review | Evidence read/create/confirm/reject           | Suggested evidence remains unconfirmed until employee action              |
| `P2-WORK-WORKSPACE`    | List/Board/Calendar/Detail | Work Items list/update/assign                 | Reuse Phase 1 stream; retain current Tasks route for rollback             |

## Binding rules

1. Every reader is an existing public API/query symbol or an explicit `NONE` with the smallest later
   delta.
2. Every command names its owner, server guard, positive test, and negative test.
3. The record may describe future `PHASE_1`/`PHASE_2` SSE work, but `IMPLEMENTED` is invalid in
   Phase 0B.
4. Work Signal and Experience Event keys must come from the approved closed taxonomy.
5. Output fields cannot contain ratings, ranks, productivity scores, or protected individual
   readiness values.
6. GitHub and Google sources cannot become confirmed evidence, progress, or shared employee facts
   without their existing human gates.
7. A role-visible frontend action never replaces server-side authorization.

## Authoritative coverage

The validator also rechecks the complete capability source distribution: exactly 44 records with 39
`COMPLETE`, 2 `PARTIAL`, 2 `EXTERNAL_GATE`, and 1 `DEFERRED_APPROVED`. This prevents a frontend plan
from hiding an engine status change.

## Verification

```bash
pnpm validate:frontend-capabilities
pnpm validate:frontend-events
pnpm validate:frontend-handoffs
pnpm exec vitest run --project unit tests/repository/ai-native-phase-1-2-handoffs.test.ts
```
