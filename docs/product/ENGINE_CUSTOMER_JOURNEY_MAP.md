# Engine Customer Journey Map

**Purpose:** hand the complete engine to the final intelligent-frontend program as user journeys,
not backend packages or temporary screens.

## Product experience principle

The employee should feel assisted, not administered. The default view answers three questions:

1. What needs my action now?
2. What changed automatically around my work?
3. What is the smallest useful next step?

Details, history, source lineage, and configuration stay progressively disclosed. AI prepares,
connects, summarizes, and asks one useful question at a time; the human confirms every consequential
claim, evidence link, progress change, development action, and evaluation decision.

## Employee journey

| Moment                   | What the employee sees first                                         | One primary action                     | Engine capabilities        | Recovery                                                 |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------- | -------------------------- | -------------------------------------------------------- |
| Start the day            | Needs My Action, Today, Overdue; then collapsed Inbox/later work     | complete or open the next item         | CAP-013–014, 018, 020, 039 | draft-safe retry and clear connection state              |
| Capture work             | one composer already tied to a Project/Task                          | type, speak, attach, paste code/link   | CAP-015–017                | keep input; continue manually if AI fails                |
| Clarify an update        | one missing question at a time with previous-state context           | answer, edit structured draft, confirm | CAP-003, 015–017           | never discard the raw update                             |
| Review automatic context | compact Gmail/Calendar/GitHub suggestion with source and reason      | confirm, correct, exclude, or dismiss  | CAP-019–022                | reconnect without duplicates                             |
| Work on a Project        | purpose, next milestone, honest contract-based progress, own actions | move one outcome forward               | CAP-006–012                | show ambiguity; never invent a percentage                |
| Research or experiment   | question/hypothesis, next test, latest result, limitation            | record result or decision              | CAP-025–027                | preserve failed/inconclusive outcomes                    |
| Prepare for evaluation   | neutral source facts before personal narrative                       | correct attribution, then self-assess  | CAP-024, 028–029           | flag unclear sources without scoring                     |
| Compare and close        | submitted self/manager views and relevant facts                      | discuss, acknowledge, or reserve       | CAP-031–032                | reservation preserves the manager rating                 |
| Give upward feedback     | explicit Identified notice and five criteria                         | submit named response                  | CAP-033                    | idempotent submit; truthful visibility                   |
| Improve continuously     | one explainable optional coaching action                             | accept, edit, defer, reject, or share  | CAP-035–036                | private remains private; manual action works without AI  |
| Take leave/return        | dates, affected work, handover gaps, delegate                        | confirm handover/return                | CAP-037–038                | authority expires safely; incomplete gaps remain visible |

## Manager journey

| Moment                  | What appears first                                             | Primary action                        | Protected boundary                               |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| Operational home        | blockers, overdue confirmations, handovers, reassignment       | resolve one queue item                | no employee score/rank/readiness percentage      |
| Project progress        | approved contract basis, proposed measurable change, ambiguity | confirm/reject/override with reason   | activity volume cannot calculate progress        |
| Employee assessment     | Fact View and anchors, then manager’s own draft                | select rating and justify             | self-rating hidden until manager submits         |
| Comparison/finalization | both submitted positions and factual differences               | discuss and set final human rating    | AI never recommends a rating or midpoint         |
| Upward feedback         | identified completion and original named responses             | read and follow up                    | pilot makes no anonymity promise                 |
| Development support     | only employee-shared action/plan details                       | agree/support a formal plan           | private actions/rejection reasons stay hidden    |
| Continuity              | leave/delegation/reassignment queue                            | approve bounded authority or reassign | manager, not administrator/AI, decides ownership |

## Project/Workstream owner journey

1. Create/maintain the main Project document.
2. Review AI-drafted criteria and Progress Contract; edit and approve humanly.
3. See updates, sources, research, and evidence in one source-labelled history.
4. Confirm only measurable milestone/KPI changes allowed by the contract.
5. Resolve ambiguous attribution and prepare a scoped handover when needed.

## System Administrator journey

1. See safe health and connection state with the smallest recovery action.
2. Execute only explicit configuration capabilities with expected version and required reason.
3. Manage identity/integration setup without receiving manager evaluation authority.
4. Generate/revoke authorized exports and inspect bounded audit receipts.
5. Deactivate access while preserving history; route ownerless work to the manager.
6. Follow protected backup/restore procedures; shared/production restore requires human approval.

## Global interface requirements

- Familiar compact Task interaction; no form maze or package-per-feature navigation.
- Universal capture accessible from daily work and Project context.
- Drawers/bottom sheets for focused actions; mobile bottom navigation remains.
- Arabic/English shell, RTL/LTR, mixed technical text, keyboard focus, reduced motion, and responsive
  behavior from the start; Arabic evaluation content remains gated.
- Visible source, confidence/ambiguity, human confirmation, and safe retry states for AI/connectors.
- Never show technical IDs, provider payloads, internal route names, rankings, productivity scores,
  predicted ratings, or manager-visible individual readiness percentages.

## Frontend build order

1. Shell, navigation, universal capture, My Work, Tasks, and Project overview.
2. Unified update/evidence/source review and Timeline.
3. Project setup, criteria, progress, Research/Experiments, and owner actions.
4. Employee evaluation, manager evaluation, comparison, and identified upward feedback.
5. Coaching/development and continuity journeys.
6. Notifications, exports, connections, and administrator operations.
7. End-to-end employee/manager/mobile/RTL product acceptance before launch.
