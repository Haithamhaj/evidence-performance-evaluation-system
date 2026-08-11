# Engine → Frontend Handoff Schema

**E7 state:** `READY_FOR_FINAL_FRONTEND_DESIGN` (2026-08-10)

**Engine baseline:** `main` at `a631eaa81a5b462f329e5917c5be3301281f970a`

**Journey authority:** `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md`

## Purpose

This contract prevents the final frontend from being designed around backend packages, temporary screens, or a conventional project-management dashboard. The frontend program must start from the employee/manager journey and use the verified engine capabilities in `ENGINE_FEATURE_REGISTER.md`.

This document is a handoff schema, not a visual design. No current verification route is automatically retained.

## Required record for every frontend capability

Every capability selected for the final frontend must have one record with all fields below before implementation:

| Field                                    | Required content                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Capability ID                            | Stable `CAP-nnn` from the Engine Feature Register                                                             |
| User/persona                             | Employee, Project owner, Workstream owner, manager, System Administrator, or operations                       |
| User moment                              | The real-world moment that creates the need                                                                   |
| Primary action                           | One dominant action the screen, sheet, or assistant step enables                                              |
| Success outcome                          | Observable user result, not a backend mutation                                                                |
| Information priority                     | Ordered `must see`, `on demand`, and `technical/hidden` information                                           |
| Related capabilities                     | Other `CAP-nnn` records entered before, during, or after this action                                          |
| Engine read contract                     | Public API/query and projection; never an arbitrary cross-module table read                                   |
| Engine write contract                    | Protected command/API, expected version/idempotency, and human confirmation                                   |
| Assistance Mode                          | One or more approved modes, selected for this exact moment/action rather than the whole capability            |
| Assistance Owner                         | Domain/service/Agent that prepares the experience; this never implies domain authority                        |
| Trigger/Activation                       | Closed Work Signal, explicit user request, deterministic state change, scheduled check, or `none`             |
| Work Signal classification               | Domain, connector, scheduled-work-check, user-domain-action, or `none`; never UI telemetry                    |
| Experience Workflow Event classification | Confirm, correct, dismiss, retry, submit, recovery, or `none`; routed to the owning protected command         |
| Product Telemetry eligibility            | A minimized eligible key or `none`; never an authority, progress, evidence, or evaluation input               |
| AI role                                  | Exact assistance allowed in this moment                                                                       |
| AI boundary                              | Exact prohibited conclusion/action; rating and privacy prohibitions must be explicit                          |
| Human gate                               | Who confirms, approves, edits, or makes the final decision                                                    |
| Freshness requirement                    | Source time/version, safe freshness state, and whether refresh is required before mutation                    |
| Inspection projection                    | Safe mode/owner/source/freshness/result trace; no prompt, private body, secret, or chain-of-thought           |
| State model                              | Loading, ready, draft, pending, confirmed, failed, stale, empty, blocked, and completed states as applicable  |
| Empty state                              | Useful explanation and next safe action                                                                       |
| Error/recovery                           | What is preserved, how retry works, and when the user must reconnect or contact an administrator              |
| Manual fallback                          | Complete non-AI/non-automation path available within the same user goal                                       |
| Notification behavior                    | Trigger, recipient, channel, deep link, dedupe, and read/resolution state                                     |
| Responsive behavior                      | Desktop/mobile priority, drawer/bottom-sheet behavior, and content that must not move below an unrelated list |
| Localization/bidi                        | Arabic/English copy source, RTL/LTR layout, mixed technical text, locale gating                               |
| Accessibility                            | Keyboard path, focus entry/return, accessible name/status, reduced motion, and touch target                   |
| Protected visibility                     | Server-authorized audience, forbidden fields, and safe projection                                             |
| Audit/history cue                        | What history the user should see and what remains system-only                                                 |
| Analytics guardrail                      | Product-use analytics allowed; activity-volume/performance inference prohibited                               |
| Acceptance evidence                      | Focused tests, browser journey, screenshots, and owner acceptance gate                                        |

Assistance fields are experience classifications only. The owner-domain read/write contracts remain
the sole source of permissions, business state, progress, evidence, and evaluation authority.

## Experience laws

1. **Start with the next useful action.** Employee home begins with Needs My Action, Today, and Overdue. Everything else is progressively disclosed.
2. **The assistant works inside the task.** AI asks only the missing question, prepares a draft, explains sources, and then waits for the employee.
3. **Project context is persistent.** A Task, Update, Evidence item, email/calendar item, Research record, or Experiment always shows its required Project and optional Workstream without repeated setup.
4. **Automatic sources reduce work, not control.** Google and GitHub bring context or suggestions; humans confirm links, contribution, and ambiguous progress.
5. **Progress is operational.** Project progress is visibly tied to a human-approved contract; it is never presented as employee performance.
6. **Evaluation is a separate deliberate journey.** Facts precede interpretation; employee and manager select their own ratings; AI never recommends one.
7. **Privacy is visible and truthful.** Private employee context stays private. Identified upward feedback says it is identified. Manager readiness projections omit protected values.
8. **History is calm but available.** The primary UI shows the current state and next action; version/source/audit detail opens on demand and cannot be edited in place.
9. **Mobile actions use focused surfaces.** Capture, evidence review, clarification, and short decisions use drawers or bottom sheets with focus return.
10. **No internal implementation language.** UUIDs, route names, model identifiers, queue states, and raw provider errors stay out of normal user copy.

## Journey-level handoff map

| Journey entry                         | Capability IDs                             | Primary action                                       | Must see first                                                   | Progressively disclose                                           |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Employee opens the product            | CAP-013–020, CAP-022                       | complete or confirm the next useful action           | Needs My Action, Today, Overdue, assistant suggestions           | Inbox, later work, connection health, detailed source history    |
| Employee opens a Project              | CAP-006–012, CAP-017–018, CAP-025–027      | understand state and move one outcome forward        | purpose, current progress basis, next milestone/gap, own actions | contract versions, full timeline, source/audit detail            |
| Employee records new work             | CAP-015–017                                | capture and confirm one meaningful update            | Project/Task context, input mode, one missing question           | structured fields, evidence metadata, source/route trace         |
| Employee reviews automatic context    | CAP-019–022                                | confirm, correct, exclude, or dismiss                | source label, suggested Project, reason/confidence               | raw connector metadata, correction history                       |
| Employee conducts research/experiment | CAP-025–027                                | define next test or record a decision                | question/hypothesis, next action, current result/gap             | complete method, sources, reproducibility, version history       |
| Project owner reviews progress        | CAP-011–012, CAP-018, CAP-022              | confirm a measurable change or resolve a gap         | contract basis, proposed change, source, ambiguity               | calculation detail, prior versions/snapshots, override audit     |
| Manager opens operations              | CAP-023, CAP-037–039                       | resolve one operational queue item                   | blockers, overdue confirmations, handovers, reassignment         | team trends allowed by policy; never individual readiness values |
| Employee starts self-assessment       | CAP-024, CAP-028–029                       | select rating and explain it from facts              | criterion/anchors, source facts, own interpretation              | source history, AI wording assistance after rating               |
| Manager starts employee assessment    | CAP-024, CAP-028, CAP-030                  | make an independent human judgment                   | criterion/anchors, authorized facts, direct-observation note     | source history; employee rating stays hidden until submission    |
| Employee and manager discuss          | CAP-031                                    | clarify a meaningful difference                      | both submitted ratings/reasons and relevant facts                | full criterion/source history                                    |
| Employee gives upward feedback        | CAP-033                                    | submit identified rating/comment                     | explicit Identified notice, criterion/anchors                    | manager trends only after authorized submission                  |
| Employee reviews coaching             | CAP-035–036                                | accept, edit, or reject a development action         | observed pattern, sources, limitation, proposed next action      | history and formal plan details                                  |
| Administrator operates the system     | CAP-001–005, CAP-019, CAP-021, CAP-038–044 | complete a governed configuration or recovery action | health, required action, impact, safe next step                  | raw diagnostics and audit only with authorization                |

## Public-contract rules

- The final web application consumes public module readers or protected API contracts only.
- A frontend need is not authority to read another module’s tables directly.
- Every mutation defines expected state/version and idempotency where repeated submission is possible.
- Every connector and AI action exposes a recoverable state without losing user input.
- Every `COMPLETE` frontend handoff cites the exact engine record and an acceptance test.
- If the frontend discovers a missing engine contract, the register changes to `PARTIAL` or `PLANNED`; the UI does not invent client-side business logic.

## Protected field map

| Context                       | Allowed                                                                 | Forbidden                                                                       |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Employee daily workspace      | own private Inbox/context, Tasks, updates, suggestions                  | another employee’s private Gmail/Calendar context                               |
| Manager operations            | operational queues, Project/Workstream gaps, blocked work               | employee readiness percentage/rank, productivity score, completion leaderboard  |
| Project progress              | approved rule, source, confirmed snapshot, override reason              | task/commit/update/file/line volume as progress                                 |
| Evaluation Fact View          | source facts, criteria/responsibility versions, labelled interpretation | suggested/predicted rating, employee rank, hidden readiness values              |
| Manager assessment            | approved anchors, facts, direct observation, manager-selected rating    | AI rating recommendation or automatic Project average                           |
| Upward feedback — pilot       | identity, completion, ratings, comments, timestamps                     | anonymity/confidentiality promise                                               |
| Future private feedback modes | only the cycle-approved safe projection                                 | identity/original content without mode-specific permission and pre-access audit |
| Research/Experiments          | method, results, limitations, decision, applied learning                | volume-based research/experiment productivity score                             |

## CAP-025–027 technical handoff note

The engine now exposes versioned Research, Experiment, Evidence-link, conclusion, decision, and
Applied Learning contracts with Project-scoped authorization, append-only history, stale-version
recovery, AI Router-only drafts, Timeline composition, readiness gaps, and neutral Fact View facts.
The route `/[locale]/projects/[projectId]/research` is only a bilingual technical verification surface
for explicit source review and proposal confirmation. It is not the final daily Research/Experiment
experience and does not yet render the complete method/run/decision lifecycle.

The final frontend must consume the protected contracts rather than infer lifecycle state in the
browser. It must provide one lightweight progression—question/source → next experiment or decision →
confirmed learning—while keeping full method revisions, runs, failed results, citations, limitations,
and history progressively disclosed. Failed or unsupported experiments remain visible; source or
experiment volume must never become Project progress or employee performance.

## Error and recovery vocabulary

The final interface should translate engine failures into a small shared vocabulary:

- **Your draft is safe:** local/server draft is retained; retry the assistant or continue manually.
- **Needs your review:** source exists but Project, evidence, progress, or conclusion is ambiguous.
- **Connection needs attention:** reconnect Google/GitHub without duplicating imported items.
- **Changed since you opened it:** reload the latest version; no historical data was overwritten.
- **You do not have access:** explain the required role/scope without exposing the resource.
- **Service is temporarily unavailable:** show a bounded retry and correlation reference for support.
- **Administrator setup required:** user action cannot solve an external credential/consent gate.

## Frontend readiness gates

The full frontend program may start only when E7 confirms:

1. every product capability has one current register status;
2. every `COMPLETE` claim has implementation and test evidence;
3. every `PARTIAL` or `PLANNED` capability needed for the pilot has an approved resolution or explicit exclusion;
4. public read/write contracts cover every primary journey without cross-module shortcuts;
5. error, empty, stale, offline/retry, authorization, localization, and mobile behavior are specified;
6. protected visibility fields have positive and negative authorization tests;
7. a user-journey feature map—not the package tree—controls information architecture;
8. Arabic evaluation remains gated until approved content and semantic review are complete.

E7 confirmed these gates at the engine-contract level. Final interface usability, visual quality,
responsive behavior, and end-to-end Product Owner acceptance are the next program; they are not
claims about the temporary verification pages.
