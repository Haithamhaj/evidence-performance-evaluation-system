# AI-Native Experience Blueprint

**Status:** D0 approved on 2026-08-11; authoritative direction for Phase 0B planning
**Scope:** User moments and information hierarchy, not final navigation or production UI  
**Sources:** Engine Customer Journey Map, Phase 1–3 Handoffs, Persona Visibility Map, and the approved
AI-Native Frontend master plan.

## Product Promise

The employee should feel assisted, not administered. The product answers:

1. What needs my decision now?
2. What useful work is ready or due?
3. What changed around my work?
4. What is the smallest useful next step?

The assistant prepares, connects, summarizes, and explains. It does not become the only way to work,
does not silently change shared/protected state, and never evaluates the employee.

## Stable Mental Model

| Moment     | User intent                                         | Primary action                                             | Must see                                                                                | On demand                                                                    | Hidden by default                                                                                 |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Today      | Start calmly and act on what matters                | Decide, continue, or open one item                         | Needs Your Decision, Prepared for You, Today, Continue, What Changed, clear state       | Later work, private Inbox, source/why/freshness                              | IDs, routes, raw Agent/provider/job data                                                          |
| Work       | Plan and execute normal Tasks                       | Create/update/complete a Project-linked Task               | List/Board/Calendar, Project, owner, status, due/dependency                             | source/evidence/update relationships, history                                | private connector context unless employee opens it                                                |
| Project    | Understand and move an outcome                      | Act on next milestone/gap or own Task                      | purpose, official contract-based progress, source coverage, next milestone, own actions | contract/calculation, documents, sources, criteria, ownership, full timeline | task/activity-volume progress or employee score                                                   |
| Research   | Reduce uncertainty and apply learning               | Review a source, run next experiment, or record a decision | question, relevant sources, next test, latest result/limitation, decision impact        | method revisions, full runs, reproducibility, citation history               | source/experiment volume as a success measure                                                     |
| Evaluation | Complete a deliberate human assessment              | Select own rating and justify from facts                   | cycle type, criterion/anchors, authorized facts, human-selected rating                  | source history and wording help after rating                                 | AI rating advice, hidden readiness, telemetry, employee rank                                      |
| Manager    | Resolve operational and evaluation responsibilities | Resolve one queue item or make an independent judgment     | blockers/approvals/continuity or Fact View/anchors in evaluation                        | allowed trends and source history                                            | private connector/coaching, readiness percentage/rank, employee self-rating before manager submit |
| Admin      | Configure or recover the system safely              | Complete one explicit governed operation                   | health, impact, required action, safe next step                                         | authorized diagnostics/audit/runbook                                         | business/private content, manager decision authority, secrets                                     |

## Approved D0 Information Architecture

This is the approved Phase 0B planning direction, not yet production navigation:

```text
Today
Work
  My Work
  Calendar
Projects
Research            ← test top-level vs contextual placement
Evaluation
────────────
Manager             ← authorized roles only
Admin               ← System Administrator only
```

Universal Capture, Search/Command, Chat, What Changed/Notifications, locale, and user actions are
global entries. Chat is an alternate channel over the same readers/commands, never the sole workflow.

## Today Information Hierarchy

### 1. Needs Your Decision

Only items that cannot proceed safely without a human: confirm/correct/dismiss a Project link,
Evidence candidate, ambiguous contract condition, or other bounded proposal. Each item shows what,
why, source, freshness, consequence, and one clear decision.

### 2. Prepared for You

Editable drafts that reduce administration: a Task, Update, Evidence description, research framing,
or small development action. Nothing is shared or becomes authoritative until the named human gate.

### 3. Today

Deterministically due or planned real work. Ordering begins from due/overdue/blocking/dependency and
freshness rules, not AI ranking or activity volume.

### 4. Continue

Recent or newly unblocked work that the employee can resume. It is not a streak, productivity score,
or “most active” ranking.

### 5. What Changed

Meaningful receipts: a dependency unlocked, source linked, job completed, item resolved, or connection
state changed. Routine maintenance stays quiet unless recovery or understanding is useful.

### 6. Clear

When no action is required:

> You’re clear right now. Nothing needs your action.

The empty state offers normal Work, capture, or Project navigation without manufacturing urgency.

## Today State Catalogue

| State                | What appears                                                      | Primary action                  | Recovery                                           |
| -------------------- | ----------------------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| Normal               | Small decision/prepared/Today mix                                 | Act on one item                 | Manual views remain available                      |
| Busy                 | Compact rows, strongest zones first, later groups collapsed       | Filter or act on one item       | No oversized metric cards or urgency gamification  |
| Clear                | Calm confirmation and optional normal destinations                | Capture or browse Work/Projects | No fake recommendations                            |
| Prepared             | Editable draft with source, why, freshness, and impact            | Review/edit/confirm             | Continue manually or dismiss                       |
| Needs decision       | One bounded question with explicit choices                        | Confirm/correct/dismiss         | Candidate remains safe; stale reloads              |
| Deterministic status | Due/dependency/connection/job state and next safe action          | Open/retry if needed            | No Agent language for deterministic work           |
| Possibly stale/stale | Last known value, affected action, and refresh need               | Refresh/reload/reconnect        | Mutation blocked when current version is required  |
| Recoverable error    | Draft-safe explanation and bounded retry/manual path              | Retry or continue manually      | Correlation reference for support when needed      |
| Agent job            | Local component shows queued/working/succeeded/failed-recoverable | Continue elsewhere or retry     | No global blocking spinner; raw input remains safe |
| What Changed         | Meaningful result receipt linked to authoritative object          | Open or dismiss receipt         | Reopening cannot replay completed operation        |

Internal P0/P1/P2 labels never appear in product copy.

## Work Moment

- Familiar List, Board, and Calendar over the same Task identity.
- Quick create and focused Task detail; mobile uses a full-height sheet, desktop a side panel/route.
- Required Project and optional Workstream remain visible without repeating setup.
- Inline safe edits are manual and deterministic. AI may prepare a draft or follow-up but does not
  silently assign, complete, or change a shared deadline.
- Source, Evidence, Updates, dependencies, and history open progressively.

**Manual fallback:** every Task lifecycle action works without Chat or AI.  
**Smart state:** explainable draft/follow-up or dependency cue.  
**Recovery:** safe local/server draft, expected-version conflict, authoritative reload, idempotent
retry.  
**Deep links:** stable Task/Project/Calendar destinations; no internal IDs in visible copy.

## Project Moment

- First view: definition, current approved progress, calculation/source coverage, next milestone or
  gap, and the viewer’s authorized actions.
- Progress Contract, documents, criteria, sources, Work, ownership, and Timeline remain connected but
  progressively disclosed.
- Progress comes only from the active human-approved measurable contract and confirmed source facts.
- Missing or ambiguous source preserves prior official progress and creates a reviewable gap.

**Manual fallback:** owners can author/review contracts and confirm only contract-defined qualitative
conditions without AI.  
**Smart state:** draft contract, source explanation, ambiguity, or smallest next action.  
**Recovery:** stale versions fail without overwriting history; external source gate is stated
truthfully.  
**Deep links:** Project overview → focused contract/document/criteria/source/ownership context.

## Research Moment

- Lightweight progression: Question/Source → Experiment or Decision → Applied Learning.
- A URL, paper, repository, note, file, or connected source can be reviewed for relevance to the
  current Project before it becomes a research source.
- Failed, invalid, stopped, unsupported, and inconclusive results remain visible with limitations.
- Applied learning links to a real Task, Document version, next Research/Experiment, or confirmed
  Evidence target.

**Manual fallback:** add sources, frame the question, define method, record results/conclusion, and
link the applied target manually.  
**Smart state:** source relevance draft, synthesis, next experiment, or application proposal.  
**Recovery:** revoked/licensed source limits are explicit; stale/cross-Project writes fail closed.  
**Deep links:** from Project/Today/Search to exact Research/Experiment/Decision context.

## Evaluation Moment

Evaluation is stable and less adaptive than daily work:

1. Cycle entry truthfully shows `Calibration — Non-Baseline` where applicable.
2. Neutral Fact View precedes personal narrative.
3. Employee and manager independently select their own rating against the same anchors.
4. Only after rating selection may AI help word the human’s justification.
5. Comparison explains differences without recommending a midpoint.
6. The manager makes the final rating; employee acknowledgment/reservation preserves that decision.
7. Pilot upward feedback prominently states `Identified`.

**Manual fallback:** complete the full assessment and justification without AI.  
**Recovery:** drafts persist; cycle snapshot and closed records remain immutable.  
**Arabic boundary:** normal Arabic/RTL shell states are tested, but Arabic employee evaluation content
remains blocked by T016.

## Manager Moment

Operational home uses compact action queues: blockers, owner confirmations, check-ins, handovers,
leave/delegation, reassignment, and Project interventions. Employee quick-add/update actions appear
only when the same user separately has contributor/owner authority.

Evaluation remains a separate navigation and mental path. The manager receives Fact View and anchors,
not productivity cards, rankings, completion leaderboards, predicted ratings, or individual readiness
values.

**Manual fallback:** every queue item deep-links to the owning domain workflow.  
**Smart state:** bounded summary and smallest authorized intervention.  
**Recovery:** unavailable sources show an operational gap; permission denial reveals no hidden data.

## Admin and Operations Moment

Admin Console separates users/roles, connections, AI routes, retention/exports, audit, health, and
recovery. The manager role is never implied. External gates say “Administrator setup required” with
impact and safe next action.

Backup/restore remains a protected runbook: show verified status and evidence, not a casual Restore
button. Shared/production restore, credentials, paid services, and launch remain direct human gates.

## Global Interaction Language

- Compact rows and action lists before cards; cards group a meaningful object, not one number.
- Drawers/bottom sheets for capture, Evidence review, clarification, and short decisions.
- Source / Why / Freshness appears with smart results; technical trace is opt-in and authorized.
- Native controls, logical CSS direction, keyboard path, visible focus, focus return, 200% zoom,
  mixed bidi text, 390px layout, reduced motion, and live status announcements.
- Motion explains a state change once; no pulse, streak, confetti, surveillance cue, or rating
  animation.

## D0 Disposition

The Product Owner selected **Command Brief** and approved D0 after reviewing the runnable Arabic
employee Today route. The hierarchy, manual Work path, Project-progress separation, Research
placement hypothesis, stable Evaluation destination, role separation, and mobile/RTL direction carry
forward to Phase 0B planning.

The supporting evidence and explicit scope boundary are recorded in
`docs/reviews/AI_NATIVE_FRONTEND_D0_EVIDENCE.md` and
`docs/decisions/AI_NATIVE_FRONTEND_D0_DECISION.md`. Distinct employee and manager sessions remain a
bounded pre-G0 validation follow-up; they do not authorize production UI before G0.
