# AI-Native Frontend D0 Evidence

**Review date:** 2026-08-11  
**Prototype:** Command Brief, Phase 0A standalone prototype  
**Decision owner:** Product Owner  
**Result:** No confirmed P0/P1 blocker in the reviewed Today path

## What Was Reviewed

The Product Owner selected visual direction 2, **Command Brief**, then reviewed the runnable Arabic
employee Today experience in the in-app browser at the 390px/mobile and desktop layouts. The review
covered the busy state and the visible hierarchy of:

1. Needs Your Decision.
2. Prepared for You.
3. Today.
4. Continue.
5. What Changed.

The prototype also contains English/LTR and Arabic/RTL variants for normal, clear, decision,
prepared, stale/recovery, and role-visible navigation states. It remains synthetic and does not call
production APIs or select production components.

## Human Review Evidence

| Coverage                      | Evidence                                                                                                                                               | Result                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Product Owner                 | Selected Command Brief from three independent directions and reviewed the live Arabic employee route                                                   | Accepted: “ممتاز اكمل”                                                                 |
| Daily employee journey        | Product Owner directly exercised the employee Today route and judged the daily hierarchy and visual direction                                          | Accepted for Phase 0B planning                                                         |
| Less-technical perspective    | The Product Owner reviewed the experience as a non-technical business reviewer                                                                         | No blocking comprehension issue reported                                               |
| Manager/Project-owner journey | Scenario and role visibility are present in the automated prototype suite; no separate manager participant session occurred                            | Required as a bounded pre-G0 follow-up; no claim of completed human manager validation |
| Architecture feasibility      | Technical review checked the prototype against the 44-capability register, 16 handoffs, protected boundaries, and standalone/non-production constraint | Feasible; no production boundary was crossed                                           |

Participant roles overlap in this review. This record does not invent separate human participants or
claim a representative usability study that did not occur.

## Evidence by D0 Question

| D0 question               | Observation                                                                                                           | Disposition                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Start-of-day hierarchy    | The important decision is first, followed by prepared work and normal Tasks; mobile preserves the same order          | Keep Command Brief hierarchy                                            |
| Complete manual Work path | Tasks remain visible as normal work and the prototype does not require Chat                                           | Preserve manual path in Phase 0B contracts                              |
| Project progress boundary | Copy attributes progress to Project sources/contracts and does not present employee performance scoring               | Preserve protected separation                                           |
| Research placement        | Research remains a stable destination while Project and Today can deep-link into it                                   | Accept as the D0 IA hypothesis; validate frequency with users before G0 |
| Evaluation stability      | Evaluation remains a separate destination and no AI rating, rank, readiness percentage, or productivity score appears | Preserve protected boundary                                             |
| Role separation           | Employee navigation excludes manager/admin destinations; role previews remain synthetic                               | Preserve authorization-driven production navigation                     |
| Mobile and Arabic         | 390px Arabic/RTL layout fits without horizontal overflow and keeps mobile bottom navigation                           | Accepted for Phase 0B foundation planning                               |

## Executed Technical Evidence

- 11/11 focused Playwright journeys passed across English/Arabic, desktop/mobile, state changes,
  keyboard focus, reduced motion, and recovery.
- Frontend capability reconciliation passed: 44 records, with 39 complete, 2 approved partial, 2
  external gates, and 1 approved deferred.
- Event separation passed: 14 Work Signals, 6 Experience Workflow Events, and 7 telemetry-eligible
  keys with collection disabled.
- Browser inspection at 1440×1024 and 390×844 found no horizontal overflow, missing icons, console
  errors, or console warnings.
- `design-qa.md` records a final passing result.

## Confirmed Findings

- No P0/P1 usability or feasibility defect was confirmed in the primary Today path.
- The selected direction is calmer and more action-oriented than the rejected verification UI.
- The compact mobile hierarchy remains usable without exposing internal identifiers or technical
  implementation details.
- The prototype proves direction and hierarchy only. It does not prove production integration,
  latency, live AI behavior, or a complete role-separated usability study.

## Bounded Follow-up Before G0

Run one distinct daily-employee session and one manager/Project-owner session against the Phase 0B
shell story. Record only confirmed P0/P1 issues as blockers. This follow-up may refine labels,
placement, and progressive disclosure; it may not weaken protected product rules or turn D0 into an
open-ended redesign loop.
