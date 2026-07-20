# AI-First Daily Workspace Product Reset

**Date:** 2026-07-20
**Status:** Product-owner-approved design; written-spec review required before planning
**Branch:** `codex/phase-2-updates-evidence-readiness`

## 1. Decision

Replace the current employee-facing daily-work experience with an AI-first Daily Workspace.

The new default home is a smart daily brief that combines:

- Tasks;
- Projects and Workstreams;
- Gmail work context;
- Google Calendar work context;
- GitHub activity;
- manual text, voice, file, image, code, CLI, URL, and snapshot sources;
- confirmed Updates and Evidence;
- operational Project progress.

The employee should understand the day within seconds and intervene only when a decision, correction, or missing fact genuinely requires human input.

This is an employee-experience reset, not a full-system rewrite.

## 2. Authority and supersession

This design records the product-owner decisions made during the 2026-07-20 product review.

Where this design conflicts with the employee-facing interaction model or execution order in:

- `2026-07-19-unified-daily-work-github-progress-design.md`;
- `2026-07-19-unified-daily-work-github-progress-plan.md`;
- the current `My Work` and Update-composer UI;

this design governs the replacement employee experience and the next planning pass.

It does not weaken or replace:

- `AGENTS.md`;
- `docs/PROJECT_REFERENCE.md`;
- `docs/EVALUATION_RUBRIC.md`;
- protected privacy, authorization, history, audit, AI Router, Project-progress, or human-evaluation rules;
- the completed Phase 0 and Phase 1 foundations.

No production implementation is authorized by this document alone. A reviewed implementation plan is required first.

## 3. Problem confirmed by product review

The current employee experience exposes internal system mechanics instead of helping the employee work.

Observed problems include:

- an empty default home that provides no immediate value;
- a long Update flow with Project, Workstream, Work Item, source, clarification, review, evidence, save, and confirmation steps;
- disabled or incomplete sources presented as primary choices;
- internal identifiers, email addresses, document versions, contract fields, and protected lifecycle steps shown in ordinary employee flows;
- AI framed as a form-completion mechanism instead of a contextual work assistant;
- operational Project governance mixed with daily employee work;
- oversized components and screens with excessive cognitive load;
- insufficient value from connected sources unless the employee manually repeats information.

The problem is structural, not cosmetic.

## 4. Product principles

1. **Value before input.** The home page is useful even when the employee types nothing.
2. **One daily surface.** Tasks, reviews, meetings, connected-source changes, and manual capture meet in one workspace.
3. **AI works in the background.** It understands, links, summarizes, and drafts before asking questions.
4. **Ask only when necessary.** Clarification is conditional and one question at a time.
5. **Human responsibility remains explicit.** AI may draft a Task but never creates or assigns an official Task automatically.
6. **Projects remain the work anchor.** An official Task requires a Project; Workstream remains optional.
7. **Connected activity is context, not performance.** Email, meetings, Tasks, commits, updates, and evidence volume never become employee performance.
8. **Private by default.** Personal connected-source summaries remain visible only to the employee until the employee confirms a shared Project object.
9. **Simple experience, bounded internals.** The UI is simple while Tasks, context composition, connectors, AI, and Projects retain clear boundaries.
10. **Original implementation.** Open-source products remain interaction references only; no foreign application code, data model, authentication, assets, or branding is copied.

## 5. Navigation model

The employee navigation is:

1. **Today**
2. **Tasks**
3. **Projects**
4. **Review**
5. **Evaluations**, visible only when a periodic evaluation action is available

The primary employee journey does not expose:

- Progress Contract editing;
- AI proposal lifecycle fields;
- database identifiers;
- internal source versions;
- audit implementation details;
- provider or route configuration.

Protected Project-owner and administrator actions live in a separate authorized Project setup area.

## 6. Today: the smart daily home

### 6.1 Page order

The default home contains:

1. a short daily brief;
2. Needs Your Review;
3. Today;
4. a compact Project Pulse;
5. one universal capture control.

Secondary groups such as this week, waiting, blocked, and recently completed remain collapsed until useful.

### 6.2 Daily brief

The brief explains:

- the number of Tasks due or overdue;
- upcoming work-calendar meetings;
- connected-source changes that matter;
- items awaiting employee review;
- confirmed blockers or missing decisions;
- relevant Project progress changes.

It does not report activity counts as productivity or performance.

### 6.3 Needs Your Review

Examples include:

- an AI-drafted Task from an email;
- an ambiguous meeting-to-Project link;
- an email linked automatically with an option to correct it;
- a GitHub suggestion awaiting contribution confirmation;
- a manual Update draft missing one important fact;
- a source conflict that prevents a Project progress change.

Every card shows:

- what happened;
- the proposed Project;
- the source;
- why the item is shown;
- the action required;
- how to correct or dismiss it.

### 6.4 Universal capture

The employee can enter:

- a Task;
- an Update;
- text;
- voice;
- a file;
- an image or screenshot;
- code;
- CLI output;
- a URL;
- a Gmail message;
- a Calendar event;
- a GitHub snapshot.

The employee is not asked to select a technical content type first. The assistant determines the likely intent, preserves the raw input, and returns a useful draft.

## 7. Task workspace

### 7.1 Task lifecycle

Quick capture may create a private Inbox item without a Project.

An Inbox item is not:

- an official work Task;
- visible to a manager;
- part of Project history;
- an evaluation fact;
- an input to Project progress.

Before becoming an official Task, it must be linked to a Project.

An official Task contains:

- title;
- required Project;
- optional Workstream;
- status;
- one responsible assignee;
- optional collaborators;
- due date;
- priority;
- description;
- optional checklist;
- connected-source references;
- append-only activity history.

### 7.2 Supported views

The first release supports:

- Inbox;
- My Tasks;
- Team Tasks within authorized scope;
- overdue;
- completed;
- List;
- Board;
- Calendar.

All views use the same Task identity, query, filters, and permissions.

Timeline or Gantt is deferred until a proven scheduling need exists.

### 7.3 Task detail

Task details open in a side panel on desktop and a full-height sheet on mobile.

The panel includes:

- core Task fields;
- Project and Workstream;
- description and checklist;
- linked Gmail summaries;
- linked Calendar events;
- linked GitHub events;
- files and confirmed Evidence;
- source-labelled activity.

Opening Task detail must not remove the employee from the current list or board context.

### 7.4 Task drafts from connected sources

AI may prepare a Task draft with:

- title;
- proposed Project and optional Workstream;
- proposed assignee;
- proposed due date;
- description;
- source reference;
- explanation of why the Task was proposed.

The employee must create, edit, or reject the draft.

AI never:

- creates an official Task automatically;
- assigns responsibility automatically;
- treats ignoring a Task draft as negative behavior;
- converts Task volume into performance.

Authorized managers may create and assign Tasks directly within their Project scope. Their assignment is a human action and is audited.

## 8. Google Workspace integration

### 8.1 Connection

The employee may connect the company Google Workspace account after explicit consent.

The connection supports:

- Gmail;
- the employee work calendar;
- approved shared or team calendars.

The employee can exclude:

- Gmail labels;
- individual threads;
- calendars;
- event categories supported by the integration policy.

Personal accounts are out of scope.

Organization approval, Google OAuth configuration, and allowed scopes are external deployment gates.

### 8.2 Gmail presentation

The employee may see:

- subject;
- sender and participants;
- received time;
- short AI summary;
- decisions or deadlines found;
- proposed Project link;
- proposed Task or Update;
- a link back to the original Gmail thread.

The original message remains authoritative in Google.

The application stores only the minimum approved derived representation:

- Google source identifier;
- source URL when available;
- timestamps;
- participants required for matching;
- summary;
- Project-link state;
- model and rule trace;
- employee corrections.

Raw message content is processed only through the approved server-side integration and AI Router path. It is not exposed to the client as hidden bulk data and is not logged.

### 8.3 Calendar presentation

The employee may see:

- meeting title;
- start and end time;
- organizer and relevant participants;
- approved meeting description summary;
- proposed Project link;
- related Tasks or follow-ups;
- link to the original Calendar event.

The system does not infer attendance quality, productivity, or performance from meetings.

### 8.4 Privacy boundary

Connected Gmail and Calendar summaries are private to the employee by default.

Managers and other contributors cannot access them merely because the assistant linked them to a Project.

Content becomes shared Project information only when the employee explicitly confirms one of:

- an official Task;
- a Project Update;
- confirmed Evidence;
- a shared decision or meeting record.

The resulting shared object contains the employee-approved claim and source reference, not an unrestricted copy of the private mailbox or calendar content.

## 9. Work Context 360

### 9.1 Context sources

The assistant may use only authorized sources:

- active Project and Workstream data;
- approved Project document versions;
- Task history;
- confirmed Updates and Evidence;
- employee-connected Gmail and Calendar data;
- bound GitHub repositories and verified events;
- employee-provided manual sources.

### 9.2 Project document as semantic anchor

The approved Project document provides:

- Project purpose;
- expected outcomes;
- milestones and deliverables;
- approved terminology;
- stakeholders;
- operational KPIs;
- acceptance conditions;
- required evidence.

AI uses this context to understand relevance. It does not change the approved document or activate a Progress Contract.

### 9.3 Link policy

A source is linked automatically only when one of these policies is satisfied:

1. **Deterministic match:** a configured repository binding, Project alias, Project identifier, explicit Project link, or previously confirmed source rule identifies one Project.
2. **High-confidence semantic match:** at least two independent Project anchors agree, no competing Project has comparable anchors, and the output provides source-backed reasons.

Examples of independent anchors include:

- exact Project name plus known Project participant;
- a prior employee-confirmed email thread plus a matching Project deadline;
- a Calendar event linked to an official Task plus a matching stakeholder;
- an approved repository reference plus a matching deliverable.

A model-provided numeric confidence score alone cannot authorize automatic linking.

When the policy is not satisfied:

- the item appears in Needs Your Review;
- the employee selects a Project, leaves it unlinked, or dismisses it;
- no official Task, Update, Evidence, or progress change occurs.

### 9.4 Correction

Every automatic link is:

- visible;
- source-explained;
- reversible;
- audited;
- excluded from immutable Project facts until a protected confirmation requires them.

Employee corrections improve future organization- and Project-scoped mapping rules. They do not rewrite the original source or historical confirmed objects.

## 10. GitHub, Updates, Evidence, and progress

### 10.1 GitHub

GitHub remains an automatic source for:

- verified Project activity;
- deterministic Progress Contract conditions;
- suggested contribution Evidence.

Verified deterministic Project delivery may update operational Project progress under an active approved rule.

Personal contribution Evidence still requires employee confirmation.

### 10.2 Manual Updates

Manual Updates cover work GitHub cannot know, including:

- customer decisions;
- requirement changes;
- design trade-offs;
- blockers;
- non-code deliverables;
- documentation and closure needs.

The assistant produces a readable draft first, asks one question at a time only when necessary, and allows employee editing before confirmation.

### 10.3 Protected separation

Task, email, meeting, GitHub, Update, and Evidence counts never calculate:

- employee performance;
- productivity;
- ranking;
- readiness percentage;
- Project progress.

Operational Project progress changes only through:

- a deterministic rule in an active human-approved Progress Contract; or
- an authorized human confirmation allowed by that Contract.

Project progress is not employee performance.

## 11. Architecture

### 11.1 Preserved foundations

Keep:

- identity and authentication;
- authorization;
- audit;
- the primary database;
- Projects, Workstreams, documents, criteria, responsibility windows, and history;
- AI Router;
- applicable Work Item, Update, Evidence, and Project-progress domain foundations.

Existing domain behavior is reused only after its public contract is checked against this design.

### 11.2 Replaced employee experience

Replace:

- the current `My Work` UI;
- the current long Update composer;
- employee-facing Progress Contract review;
- screens that expose internal identifiers or lifecycle mechanics;
- oversized employee components that combine orchestration, state, forms, and presentation.

### 11.3 Bounded components

Use the modular monolith and one primary store.

The design has five bounded parts:

1. **Task domain:** official Task rules and persistence.
2. **Connected Work Context:** Google Workspace and GitHub source references, sync, consent, exclusions, and link state.
3. **Context Intelligence:** structured summaries, matching, draft generation, and correction processing through AI Router.
4. **Daily Composition:** authorized read composition for Today, Review, Task detail, and Project Pulse. It owns no domain tables.
5. **Employee Experience:** Today, Tasks, Projects, Review, and periodic Evaluation entry points.

Connectors implement a shared source contract but retain connector-specific permissions, cursors, reconciliation, and failure handling.

Do not add:

- a microservice;
- a generic activity platform;
- a second Task store;
- a second authentication system;
- direct provider SDK calls from feature code;
- a package for every screen;
- a general customizable-object framework.

## 12. Failure and recovery

### 12.1 AI failure

If AI is unavailable:

- Tasks, Projects, connected-source browsing, and manual linking remain usable;
- raw user input is preserved;
- no Task draft or auto-link is committed partially;
- the UI offers retry or manual completion.

### 12.2 Connector failure

If Gmail, Calendar, or GitHub sync fails:

- show the last successful sync time;
- label cached data as not current;
- preserve existing official Tasks and confirmed Project objects;
- provide reconnect or retry without duplicate ingestion.

### 12.3 Authentication interruption

Draft Tasks and Updates survive reauthentication.

After successful login, the employee returns to the same draft and source context.

### 12.4 Incorrect link

Correction:

- removes or replaces the derived link;
- reverses unconfirmed downstream suggestions;
- never mutates the original external source;
- never silently rewrites an already confirmed immutable Project event.

### 12.5 Disconnect and retention

Disconnect immediately stops new sync and revokes local use of the connection.

Derived content becomes inaccessible pending deletion under the approved organization retention policy.

Implementation cannot ship the production connector until the organization approves:

- retention duration;
- deletion procedure;
- legal or audit exceptions;
- administrator and employee visibility of deletion state.

Protected audit rows may retain identifiers and action metadata but not disconnected private content unless the approved policy explicitly requires it.

## 13. Security and privacy

- Request the minimum Google and GitHub permissions.
- Enforce authorization on every server action.
- Encrypt provider tokens and sensitive derived content.
- Never log tokens, raw email bodies, private event details, uploaded content, or model credentials.
- Treat email, calendar, documents, code, comments, and attachments as untrusted AI input.
- Separate system instructions from source content and validate every persisted AI output.
- Persist source references, prompt/schema versions, route trace, matching reasons, and confirmation state.
- Require an audit reason for sensitive administrative access.
- Do not expose employee private connected-source summaries to managers.
- Do not train an external model on organization content unless an independently approved provider contract and route permit it.

## 14. Localization, accessibility, and responsive behavior

- Maintain English and Arabic localization foundations.
- Render Arabic in RTL and English in LTR.
- Render mixed code, URLs, repository names, email subjects, and technical terms correctly.
- Use semantic headings, lists, dialogs, and status messages.
- Provide visible focus and full keyboard operation.
- Preserve draft and focus context after dialogs and side panels close.
- Use a side panel on desktop and bottom/full-height sheet on mobile.
- Respect reduced motion.
- Use compact rows and action cards rather than oversized metric cards.
- Do not hardcode employee-facing strings in feature code.

Arabic employee release remains subject to the existing approved-content and semantic-review gate.

## 15. Implementation slices

The implementation plan must decompose this design into these visible slices.

This specification is the shared product and architecture boundary, not one monolithic coding task. Planning must create a small master execution map and one bounded implementation plan per slice. A later slice cannot begin until the previous slice has a runnable acceptance result and its required Product Owner gate is complete.

### Slice 1 — Daily home and Task foundation

Deliver:

- new Today shell;
- Inbox capture;
- official Task creation with required Project;
- My Tasks and Team Tasks;
- List, Board, and Calendar;
- Task side panel and mobile sheet;
- realistic local demo data.

### Slice 2 — Google Workspace connection and manual linking

Deliver:

- employee consent;
- allowed-scope display;
- exclusion controls;
- Gmail and Calendar source browsing;
- manual Project linking;
- disconnect behavior;
- privacy and authorization tests.

This slice stops at the external Google Workspace OAuth/admin gate when real credentials are required.

### Slice 3 — Context Intelligence

Deliver:

- Project-document context reader;
- structured Gmail and Calendar summaries;
- deterministic and high-confidence link policy;
- Needs Your Review;
- correction lifecycle;
- Task drafts requiring employee confirmation;
- AI evaluation fixtures and prompt-injection tests.

### Slice 4 — GitHub, Updates, and Evidence

Deliver:

- governed GitHub binding and reconciliation;
- automatic Project events;
- contract-aware deterministic progress;
- suggested contribution Evidence;
- universal manual and voice Update journey;
- confirmed result cards and source-labelled Timeline.

### Slice 5 — Project owner setup and operational progress

Deliver:

- simple owner-only Project source and Progress Contract setup;
- AI draft hidden from ordinary employee navigation;
- protected human review and activation;
- compact employee Project Pulse;
- operational queues for managers.

### Slice 6 — Evaluation preparation

Begin only after the daily workspace is accepted in real use.

Deliver:

- neutral Evaluation Fact View preparation;
- source-supported facts separated from employee interpretation;
- no rating recommendations;
- no employee ranking or productivity score.

The complete employee and manager evaluation workflow remains a later approved phase.

## 16. Acceptance targets

Using realistic synthetic and local connected-source fixtures:

- an employee understands the day within 10 seconds;
- an employee captures or approves a Task within 20 seconds;
- an employee corrects a Project link within 10 seconds;
- an employee submits a manual Update within 60 seconds;
- the primary daily flow exposes no internal identifiers or Progress Contract mechanics;
- a disconnected or failed AI provider does not block Task work;
- an ambiguous source never creates an official Task automatically;
- a private email or Calendar summary is not visible to a manager;
- connected-source volume never appears as employee performance;
- Project progress changes only from an approved measurable rule or authorized confirmation.

## 17. Verification

Each slice requires:

- focused domain unit tests;
- repository and sync integration tests where persistence changes;
- positive and negative authorization tests;
- privacy tests for connected-source summaries;
- idempotent sync and reconciliation tests;
- AI schema and evaluation tests for clear, ambiguous, conflicting, multilingual, and malicious inputs;
- desktop and mobile browser journeys;
- Arabic/English and RTL/LTR checks;
- keyboard and visible-focus checks;
- a runnable local demo with realistic data;
- screenshots;
- one Product Owner acceptance gate.

Run the full repository suite only at shared-foundation changes, major integration checkpoints, and before the phase Pull Request is made merge-ready.

## 18. Product-owner gates

Stop for:

- Google Workspace organization approval, OAuth client, or administrator consent;
- an unapproved retention/deletion policy;
- activation of a Progress Contract;
- a protected privacy or evaluation-rule decision;
- an unresolved P0/P1 privacy, security, integrity, or functional defect;
- final acceptance before Phase 2 merge or Evaluation work.

Routine UI and implementation decisions within this approved design do not require repeated approval.

## 19. Open-source reference policy

Continue the approved interaction-pattern-only decision:

- Super Productivity informs the personal daily-home hierarchy;
- Plane informs Project-scoped Tasks and side-panel behavior;
- Twenty informs activity and attachment composition;
- Vikunja informs view switching and RTL behavior.

Do not copy their source, translations, branding, screenshots, assets, schemas, backends, authentication, or sync systems.

## 20. Final product boundary

The Daily Workspace helps the employee see and organize work across 360 degrees.

It does not:

- watch the employee for productivity scoring;
- evaluate the employee continuously;
- infer performance from communication or activity volume;
- recommend ratings;
- rank employees;
- replace the manager's periodic human judgment.

Daily work produces source-supported context. Periodic evaluation is a separate human process.
