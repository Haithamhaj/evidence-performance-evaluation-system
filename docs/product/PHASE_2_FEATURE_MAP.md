# Phase 2 AI-First Daily Workspace Feature Map

**Status:** Product-owner approved production feature map

**Design authority:** `docs/superpowers/specs/2026-07-20-ai-first-daily-workspace-design.md`

**Execution authority:** `docs/superpowers/plans/2026-07-20-ai-first-daily-workspace-master-plan.md`

**Current checkpoint:** Documentation alignment, followed by new Slice 1

**Historical plans:** Retained for traceability; they do not authorize the rejected employee experience

## Purpose

This map connects the approved AI-first Daily Workspace reset to the existing Phase 0/1 and applicable Phase 2 foundations. The product keeps the proven backend and replaces the complex employee interaction with a calm Today home, normal Tasks, connected work context, and human-controlled AI assistance.

## Foundation reuse

| Capability                            | Existing owner                        | Decision                                              |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Identity, sessions, deactivation      | Phase 0 auth/API                      | Reuse unchanged; no second authentication             |
| Server authorization                  | `packages/permissions` and API guards | Reuse; every protected action remains server-enforced |
| Audit                                 | `packages/audit`                      | Reuse append-only writer                              |
| Queue and workers                     | Existing worker/BullMQ                | Reuse; no second queue                                |
| AI providers                          | `packages/ai-routing`                 | Exclusive route for every AI call                     |
| Projects, Workstreams, responsibility | `packages/projects`                   | Reuse public interfaces                               |
| Documents and readiness               | `packages/documents`                  | Reuse approved-version readers                        |
| Dynamic criteria                      | `packages/criteria`                   | Reuse active-at-time readers                          |
| Progress Contract                     | `packages/projects`                   | Preserve versioned human-approved rules and snapshots |
| Work Items                            | `packages/work-items`                 | Extend into normal Tasks and private Inbox            |
| Updates and Evidence                  | `packages/updates-evidence`           | Preserve domain lifecycle; simplify employee capture  |
| Daily composition                     | `apps/api/src/daily-work`             | Compose public readers; never become a second store   |
| Employee web                          | `apps/web`                            | Replace rejected My Work interaction                  |
| Connected Work Context                | Missing                               | Add one bounded provider-neutral package              |
| Context Intelligence                  | Missing                               | Add one bounded AI Router consumer                    |

## Feature-to-slice mapping

| Feature                           | Source                                                  | Owner                      | Slice | Protected boundary                            |
| --------------------------------- | ------------------------------------------------------- | -------------------------- | ----: | --------------------------------------------- |
| Today default home                | Authorized Tasks, private Inbox, actions, Project pulse | Daily composition          |     1 | No scoring or ranking                         |
| Private quick capture             | Employee text                                           | Work Items                 |     1 | Employee-only until promotion                 |
| Official Task                     | Human-confirmed draft or authorized human command       | Work Items                 |     1 | Project required                              |
| My Tasks and Team Tasks           | Authorized Task queries                                 | Work Items                 |     1 | Server-side scope                             |
| List, Board, Calendar             | Same Task identity/query                                | Web + Work Items           |     1 | No duplicate task stores                      |
| Task side panel/sheet             | Authorized Task detail                                  | Web                        |     1 | Preserve list/board context                   |
| Gmail summaries                   | Employee-connected account                              | Connected Work Context     |     2 | Private, minimal, encrypted                   |
| Calendar context                  | Employee-connected account                              | Connected Work Context     |     2 | Private, minimal, encrypted                   |
| Exclusions and disconnect         | Employee decision                                       | Connected Work Context     |     2 | Reversible and audited                        |
| Manual Project linking            | Employee decision                                       | Connected Work Context     |     2 | No automatic shared object                    |
| Project semantic context          | Approved Project document version                       | Context Intelligence       |     3 | Read-only source anchor                       |
| Explainable auto-link             | Deterministic or two non-conflicting anchors            | Context Intelligence       |     3 | Model confidence alone insufficient           |
| Task draft                        | Authorized private context                              | Context Intelligence       |     3 | Human confirmation required                   |
| Smart review queue                | Suggestions and corrections                             | Daily composition/Web      |     3 | Private until confirmation                    |
| GitHub sources                    | GitHub App verified events                              | GitHub connector           |     4 | Minimum permissions, idempotent               |
| Text/image/file/code/link capture | Employee source                                         | Updates & Evidence         |     4 | Untrusted input, confirmation                 |
| Voice update                      | Audio/transcript revisions                              | Updates & Evidence         |     4 | Dual human gates                              |
| Evidence                          | Supported claim and source                              | Updates & Evidence         |     4 | Employee contribution confirmation            |
| Timeline                          | Accepted source-labelled events                         | Daily composition          |     4 | Append-only projection                        |
| Project progress setup            | Approved document + human owner                         | Projects                   |     5 | No AI activation                              |
| Project pulse                     | Active contract + confirmed sources                     | Projects/Daily composition |     5 | Operational, not performance                  |
| Thursday check-in                 | Substantive update state                                | Updates & Evidence         |     5 | Approved leave excluded                       |
| Monthly readiness                 | Source coverage                                         | Readiness composition      |     5 | No quota, percentage to manager, or penalty   |
| Manager operations                | Authorized actions and exceptions                       | Daily composition/Web      |     5 | No employee score or leaderboard              |
| Evaluation Fact View              | Period source facts                                     | Evaluation preparation     |     6 | Facts separate from interpretation; no rating |

## Protected separation

### Task versus Project progress

A Task may support a milestone, deliverable, KPI, acceptance condition, or evidence request. Completing Tasks, creating more Tasks, or updating them frequently never calculates Project progress.

### Project progress versus employee performance

Project progress is calculated only by the active versioned Progress Contract and confirmed contract inputs. It is an operational Project state, not an employee score, productivity value, rating, or rating recommendation.

### Context versus shared record

Gmail and Calendar summaries are private employee context. They become visible beyond the employee only after the employee confirms a governed Task, Update, Evidence item, or decision record with clearly presented shared content.

### AI draft versus official action

AI may summarize, link, ask a focused question, and prepare a complete Task or Update draft. AI never creates or assigns an official Task, confirms evidence, activates a Progress Contract, or assigns/recommends a rating.

## Slice summaries

### Slice 1 — Daily home and Tasks

**Visible outcome:** Today shows Needs My Action, Today, and Overdue first. The employee can capture privately, review a Project-linked Task draft, create an official Task, and work through Inbox, My Tasks, Team Tasks, List, Board, Calendar, and a focused detail panel.

**Primary delta:** `0017_task_workspace`, private Inbox, checklist/edit support, protected Task APIs, Today composition, new daily and Task UI.

**Gate:** Product Owner validates that the daily journey is immediately understandable and lighter than the rejected flow.

### Slice 2 — Google Workspace context

**Visible outcome:** The employee connects Google Workspace, reviews private Gmail/Calendar summaries, excludes sources, and links context manually to a Project.

**Primary delta:** one Connected Work Context package, encrypted minimal summaries, credential-vault port, sync cursors, exclusions, links, connection UI.

**Gate:** Organization-approved OAuth configuration, retention/deletion policy, and privacy review before live mode.

### Slice 3 — Context Intelligence

**Visible outcome:** The assistant explains Project matches, sends uncertain items to review, learns from corrections, and prepares a complete editable Task draft.

**Primary delta:** versioned analyses/suggestions/drafts, deterministic matching policy, approved Project-document reader, AI Router routes, review queue.

**Gate:** Product Owner validates usefulness, transparency, and human control.

### Slice 4 — GitHub, Updates, Evidence, and voice

**Visible outcome:** Verified GitHub events and employee text/voice/image/file/code/link sources enter one compact confirmed lifecycle and source-labelled Timeline.

**Primary delta:** GitHub App connector, webhook/reconciliation, source suggestions, simplified universal capture, voice transcription, evidence review.

**Gate:** External GitHub App approval plus integrity, upload, AI, and evidence-confirmation review.

### Slice 5 — Project owner and manager operations

**Visible outcome:** Project owners configure measurable progress outside the employee daily flow; employees see a compact Project pulse; managers act from queues rather than score-like dashboards.

**Primary delta:** guided owner setup, Project pulse, check-ins, non-scoring readiness, manager action queues.

**Gate:** Product Owner validates owner clarity, employee neutrality, and manager usefulness.

### Slice 6 — Evaluation preparation

**Visible outcome:** Employee and authorized manager see neutral source facts before future quarterly assessment, with employee interpretation clearly separated.

**Primary delta:** read-only Evaluation Preparation package, authorized composition, Fact View API and UI.

**Gate:** Neutrality/privacy approval. Complete evaluation remains Phase 3.

## Original T030–T044 trace

| Original task                 | Current disposition                                                          |
| ----------------------------- | ---------------------------------------------------------------------------- |
| T030 Activity Timeline        | Existing domain foundation retained; unified presentation in Slice 4         |
| T031 Text Update              | Existing domain foundation retained; simplified universal capture in Slice 4 |
| T032 Voice Update             | Slice 4                                                                      |
| T033 Evidence                 | Existing foundation retained and presented in Slice 4                        |
| T034 Multimodal Analysis      | Slice 4; claim support only                                                  |
| T035 Contribution Attribution | Existing foundation retained; confirmation in Slice 4                        |
| T036–T037 Check-ins           | Slice 5                                                                      |
| T038–T041 GitHub              | Slice 4                                                                      |
| T042 UI                       | Delivered visibly across Slices 1–5                                          |
| T043 Monthly Readiness        | Slice 5                                                                      |
| T044 Arabic/dialect fixtures  | Added only in Slices 3–4 when prompt/schema/voice changes                    |

## Cross-slice completion rule

Each slice ends with:

1. Focused tests and related integration tests.
2. Protected scans.
3. A runnable local employee/manager journey as applicable.
4. Arabic/English desktop and 390px screenshots where UI changes.
5. Commit and push to Pull Request #5.
6. Updated task and project state.
7. Product Owner stop gate.

The full repository suite runs after shared-foundation changes, at major integration checkpoints, and before Pull Request #5 becomes ready. Pull Request #5 is not merged without explicit Product Owner approval.
