# Phase 2 Work Experience Benchmark

Date: 2026-08-13  
Reference: ClickUp interaction patterns only; no external code, assets, schemas, or branding were copied.

## Dogfood scenario

Codex is the employee and **Evidence Performance Evaluation System** is the active Project. The
representative journey uses the real protected Work Item readers and commands already exposed by the
engine:

1. Open Work and see the current Project-scoped Tasks.
2. Filter or search without leaving the screen.
3. Open one Task with keyboard or pointer into a URL-addressable detail drawer.
4. Review dependencies, authorized Updates, and suggested GitHub evidence.
5. Use contextual assistance to understand the next action or blocker.
6. Change status or due date through the protected command.
7. Return to List, Board, or Calendar and re-read the authoritative state.

GitHub activity remains suggested evidence. Task volume and completion do not calculate Project
progress or employee performance.

## Interaction benchmark

| Workflow         | Current Command Brief path                       | Interaction target                   | Result |
| ---------------- | ------------------------------------------------ | ------------------------------------ | ------ |
| Create a Task    | Quick Task → title → required Project → create   | Title-first, no full form            | Met    |
| Open Task detail | Select one compact row                           | One action; URL-owned drawer         | Met    |
| Move a Task      | Open detail/Board menu → choose an allowed state | Only server-authorized choices       | Met    |
| Change due date  | Calendar item → date → save                      | One focused edit                     | Met    |
| Find work        | Search or Project/status/sort filters            | No separate search screen            | Met    |
| Change view      | List / Board / Calendar                          | Same authoritative Tasks and filters | Met    |
| Keyboard path    | Arrow/Home/End → Enter → Escape                  | Pointer-free list and drawer path    | Met    |
| Recover retry    | Preserve local draft + stable request ID         | No duplicate Task                    | Met    |
| Review more work | Load more Tasks                                  | Keep the current screen and filters  | Met    |

## Density and performance evidence

- Representative composition fixtures cover 50, 200, and 1,000 Tasks.
- All three preserve Task identity and complete under the focused 100 ms composition guard on the
  local development machine.
- The server keeps bounded cursor pages; the screen requests the next page explicitly and merges it
  without duplicates.
- The normal page remains compact and does not render 1,000 Tasks at once. Virtualization is not
  justified yet because bounded paging already protects daily performance and is simpler to operate.
- If later production observation shows long-page interaction degradation, row virtualization can be
  added behind the same list model without changing domain APIs.

## Capability closure decision

P2-10, P2-11, and the bounded protected-command portion of P2-12 now use the real Codex dogfood
state. The Work Agent distinguishes overdue, due-today, ready-for-action, and required-check-in
follow-up triggers; Work refresh recomposes the next prepared action from the authoritative readers;
and Task detail can prepare a server-allowed status change without executing it. Codex must review
the exact before/after state and confirm before the existing protected command runs.

P2-15 and P2-16 are complete. P2-17 remains open only for the approved free-form AI Router slice:
the employee must be able to ask in natural language about the Task, receive a source-grounded
answer, and prepare the same bounded protected action without giving the model authority to execute
it. The deterministic contextual buttons remain the truthful fallback.

The next bundle should close those three gaps using the existing AI Router and domain commands. It
must not add a second task store, infer Project progress from Task volume, or turn chat into the only
way to manage work.
