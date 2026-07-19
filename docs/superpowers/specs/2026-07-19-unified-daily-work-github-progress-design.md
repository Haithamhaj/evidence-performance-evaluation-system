# Unified Daily Work and Contract-Aware GitHub Progress

**Status:** Product-owner approved written specification
**Approved in conversation:** 2026-07-19
**Scope:** Correct the Phase 2 daily-work journey, GitHub automation, operational Project progress, evidence preparation, and their boundary from periodic employee evaluation
**Does not authorize:** Production implementation, rubric changes, rating automation, employee ranking, or a complete Phase 3 evaluation workflow

## 1. Authority and supersession

This specification is a bounded authoritative amendment to:

- `docs/superpowers/specs/2026-07-18-phase-2-daily-work-progress-design.md`;
- `docs/product/PHASE_2_FEATURE_MAP.md`;
- the Slice 2–4 execution sequence in `docs/superpowers/plans/2026-07-18-phase-2-daily-work-progress-plan.md`.

It supersedes only statements that:

1. make a Work Item mandatory for every Update;
2. present daily updating primarily as an AI question-and-answer form;
3. treat every GitHub event as employee-confirmed suggested evidence before it can affect operational Project progress;
4. hide text, voice, file, image, code, CLI, GitHub snapshot, and connected-GitHub entry paths behind separate user journeys;
5. fail to distinguish automated Project progress sources from employee contribution evidence.

All protected evaluation, privacy, history, AI Router, authorization, audit, localization, and no-ranking rules remain in force.

This amendment does not turn raw GitHub activity into a progress formula. A verified GitHub event may serve as the source that proves an already-approved contract condition; the contract rule, not the activity volume, determines the resulting operational progress. GitHub remains suggested evidence when the system proposes that the same event support an employee contribution record.

## 2. Correct product model

The product has three separate layers.

### 2.1 Continuous daily work and operational progress

This layer contains:

- Projects and Workstreams;
- Work Items;
- text and voice Updates;
- files, images, screenshots, code, CLI output, links, and GitHub sources;
- milestones, deliverables, acceptance conditions, and operational KPIs;
- the versioned and human-approved Project/Workstream Progress Contract;
- append-only Project progress snapshots and activity.

Its percentages are operational Project or Workstream progress. They are not employee ratings, employee performance scores, predicted ratings, readiness percentages, or productivity scores.

### 2.2 Evaluation Fact View preparation

For an evaluation period, the system composes an authorized source-supported view of:

- Projects and Workstreams within the employee's actual responsibility windows;
- accepted results and deliverables;
- confirmed evidence and its verification state;
- contribution context and unresolved attribution;
- operational KPI and milestone history;
- unclear, missing, or conflicting information;
- the employee's interpretation, kept separate from source-supported facts.

This view helps the employee and manager prepare. It contains no calculated, suggested, predicted, or recommended employee rating.

### 2.3 Periodic human evaluation

Evaluation runs in a configured cycle, normally quarterly or semiannually.

- The employee completes a self-assessment.
- The manager completes an independent assessment.
- Both use the same approved four sections, criteria, anchors, and `1–5` scale.
- The two assessments are compared only after the defined submission gates.
- Material differences support a discussion between manager and employee.
- The manager may retain, raise, or lower the final rating within the approved rubric scale regardless of Project progress percentages.
- The manager's final rating is a human decision with recorded rationale and audit history.
- AI may organize facts or help draft rationale only after a human selects a rating. AI never selects, predicts, or recommends a rating.

The product owner confirmed that the earlier reference to a zero rating was illustrative only. The approved rating scale remains `1–5`.

## 3. Daily Work as the employee home

`My Work / عملي` is the employee's default daily operating home, not an evaluation screen.

It shows:

1. Needs My Action.
2. Today.
3. Overdue.
4. Collapsed secondary groups.
5. Recent Project, Workstream, Update, evidence, and connected-source activity.

The primary daily action is `Add update / إضافة تحديث`. It opens one unified composer rather than separate technical workflows.

The interface must use real Project, Workstream, and Work Item names. It must not show synthetic technical identifiers or generic labels such as “linked to a Workstream” when the authorized name is available.

## 4. Update scope

Every Update has:

- a required Project;
- an optional Workstream belonging to that Project;
- an optional Work Item belonging to that Project and, when present, the selected Workstream.

An employee can start an Update:

- from My Work, then select the Project and optional scope;
- from a Project, with the Project preselected;
- from a Workstream, with Project and Workstream preselected;
- from a Work Item, with all available scope preselected;
- from a connected GitHub event, with the mapped Project scope preselected.

The backend already permits a nullable Work Item on an Update. The corrected UI must no longer force every Update through a Work Item.

## 5. Unified update input

The first composer screen exposes all supported input paths in one place:

1. Write text.
2. Record or upload voice.
3. Upload an image or screenshot.
4. Upload a document or other approved file.
5. Paste code.
6. Paste CLI output.
7. Add a URL.
8. Add a manual GitHub snapshot.
9. Use connected GitHub activity.

An employee may combine sources in one Update. For example, a connected PR can be supplemented with a customer-discussion note, voice explanation, or acceptance screenshot.

The source controls are visible from the beginning. Implementation sequencing may activate connectors incrementally, but the production journey must not present text, voice, evidence, and GitHub as unrelated products.

## 6. Draft-first AI assistance

The daily experience is not framed as “answer the system.”

The lifecycle is:

> select scope and sources → preserve raw input → extract an initial Update draft → map possible contract components → compare with previous accepted state → show the draft → ask only necessary clarifications → employee edit → employee confirmation → append-only Timeline event → governed progress evaluation.

The first useful AI output is a readable draft containing:

- what changed;
- the verifiable result;
- the source or evidence;
- the likely milestone, deliverable, KPI, or acceptance-condition relationship;
- comparison with the previous accepted state;
- blocker, next action, and closure/documentation needs.

Clarification is conditional. When required:

- ask one precise question at a time;
- explain why the information is needed;
- use conversational wording such as “Complete this Update” rather than “Your answer”;
- ask no question whose answer is already available from an authorized source;
- return to the evolving draft after every answer;
- preserve the employee's original input and every revision.

The employee can edit all generated wording before confirmation.

All production AI calls continue through the existing AI Router. Uploaded documents, code, comments, and GitHub content remain untrusted AI input.

## 7. Project Progress Contract

Official Project and Workstream progress derives only from a versioned, human-approved Progress Contract containing:

- milestones and deliverables;
- operational KPIs;
- baseline, target, unit, and direction;
- acceptance conditions;
- required evidence;
- optional approved weights;
- owner and approver;
- effective date and version;
- calculation rules;
- source bindings;
- authorized confirmation of qualitative contract conditions, with reason and audit.

The authoritative Project document and approved document versions are the source for drafting the contract. AI may propose contract content, but authorized humans approve it before activation.

Progress is never calculated from:

- number of completed Work Items;
- task volume;
- update frequency;
- number of commits or PRs;
- files or lines changed;
- evidence volume;
- employee activity volume.

The overall progress percentage cannot be entered or overridden directly. Any human confirmation is limited to a qualitative condition already defined by the active contract; the approved calculation rule then derives the resulting progress.

## 8. Contract-aware GitHub automation

### 8.1 Repository binding

An authorized Project owner or administrator binds one or more repositories to a Project, with minimum GitHub App permissions.

Each active binding identifies:

- Project and optional Workstream;
- repository;
- approved branches, environments, workflows, releases, or paths where required;
- the Progress Contract version;
- mapped milestones, deliverables, KPIs, or acceptance conditions;
- effective period;
- verification and reconciliation policy.

### 8.2 Automatic ingestion

Verified, idempotent webhooks and reconciliation ingest relevant:

- commits;
- pull requests and merge state;
- required checks;
- releases and deployment states;
- approved document or artifact references.

Connected activity appears automatically in the Project activity view. The employee does not write a duplicate manual Update for activity already available from GitHub.

### 8.3 Automatic operational progress

GitHub may trigger automatic operational Project-progress recalculation only when an active Progress Contract contains a deterministic, pre-approved measurable rule.

Valid example:

> The PR mapped to Milestone A is merged into the approved branch and every required check passes; therefore the milestone's contract condition is satisfied.

Invalid examples:

- ten commits equal ten percent progress;
- a large PR equals more progress;
- more files or lines changed imply more progress;
- frequent GitHub activity implies employee performance.

If a verified GitHub event satisfies a deterministic contract rule, the system:

1. records the immutable source event;
2. records the matched contract rule and source binding;
3. recalculates operational progress;
4. appends a source-explained Project progress snapshot;
5. shows the change in Project and Workstream views.

No employee confirmation is required merely to avoid duplicating an objective Project delivery event.

If the event is ambiguous, lacks a binding, conflicts with another source, or requires qualitative judgment, it creates a reviewable Project Update suggestion and does not change official progress until the contract's authorized human confirmation occurs.

### 8.4 Employee contribution evidence

Automatic Project progress and employee contribution attribution are separate.

- A verified GitHub event may update operational Project state under an approved rule.
- The same event may be suggested as evidence of an employee's contribution.
- It becomes a personal contribution record only after the employee reviews the supported claim and contribution context and confirms it.
- Repository identity or commit authorship alone does not prove full, individual, or sole contribution.
- A manager sees source-supported facts and confirmation state, not a productivity score.

This preserves automated Project tracking without turning GitHub activity into automatic employee evaluation.

## 9. Manual fallback and supplemental Updates

When GitHub is not connected, the employee supplies progress sources manually through the unified composer.

Manual sources can include:

- screenshots;
- code or CLI output;
- files or documents;
- URLs;
- a GitHub PR, commit, or checks snapshot;
- text or voice descriptions.

Manual Updates also cover information that GitHub cannot know, including:

- customer discussions;
- requirement changes;
- decisions and trade-offs;
- blockers and dependencies;
- non-code deliverables;
- documentation and closure preparation.

Manual evidence follows the same private upload, safety validation, employee editing, confirmation, and append-only history rules.

## 10. Confirmed Update presentation

After confirmation, the product shows a compact Update card rather than only a success message.

The card contains:

- Project, optional Workstream, and optional Work Item;
- input mode and source;
- what changed;
- verifiable result;
- linked evidence and verification state;
- matched contract component, if any;
- operational progress impact: applied automatically, awaiting confirmation, no measurable impact, or insufficient information;
- comparison with the previous accepted state;
- blocker and next action;
- required documentation or missing information;
- timestamp and contributor context.

The card and its source-labelled events appear in the append-only Timeline.

## 11. Session continuity and error recovery

Daily updating must tolerate realistic work duration.

- Autosave raw input and confirmed local draft revisions.
- Refresh or renew an eligible session before a protected mutation when supported.
- If reauthentication is required, preserve the Update draft, return the user to the same step, and explain what happened.
- Never collapse authentication, authorization, optimistic-concurrency, AI, upload, or validation failures into one generic message.
- Show a specific recovery action.
- Do not submit the same answer or source twice after retry.

The failure observed during product-owner review left the raw Update source and clarification session intact but persisted no answer or structured draft. The corrected journey must resume safely from that state.

## 12. Primary user journeys

### 12.1 Connected GitHub

1. Project owner connects and maps a repository to the active Progress Contract.
2. GitHub sends a verified event.
3. The event appears automatically in Project activity.
4. A deterministic contract rule may update operational progress automatically.
5. Ambiguous events wait for Project review without changing progress.
6. Personal contribution evidence is suggested to the employee for review.
7. The employee adds only missing non-GitHub context when useful.

### 12.2 Manual Project Update

1. Employee chooses a Project.
2. Employee optionally chooses Workstream and Work Item.
3. Employee supplies one or more text, voice, file, image, code, CLI, URL, or snapshot sources.
4. AI shows a draft first and asks only necessary questions.
5. Employee edits and confirms.
6. The system appends the Update and evaluates any approved contract rule.

### 12.3 Periodic evaluation

This is the approved end-to-end target journey. It documents the boundary that the daily-work data must support; it does not authorize implementation of the complete evaluation workflow in Phase 2.

1. The cycle freezes the relevant rubric and visibility configuration.
2. Evaluation Fact View composes authorized facts for the employee's responsibility periods.
3. Employee submits a self-assessment on the approved four sections and `1–5` anchors.
4. Manager submits an independent assessment using the same criteria.
5. The system shows differences for discussion without recommending a rating.
6. The manager records the final human rating and rationale.
7. Finalization creates an immutable snapshot.

## 13. Architecture boundaries

The modular monolith remains unchanged.

- `projects` owns Progress Contracts, source bindings, calculation rules, and official progress snapshots.
- `updates-evidence` owns Update sources, clarifications, evidence, GitHub source ingestion/disposition, contribution context, and accepted events.
- `work-items` owns Work Items and their history.
- application read/composition services produce My Work, Project activity, Timeline, and future Fact View reads.
- GitHub and voice remain connectors to the same Updates & Evidence lifecycle.
- AI calls remain inside the AI Router boundary.

Do not introduce:

- a generic activity platform;
- a second Project-progress store;
- a second authentication system;
- raw GitHub-volume scoring;
- package-per-input-mode architecture;
- direct feature-module provider calls.

## 14. Acceptance criteria

The corrected design is acceptable only when:

1. a Project Update can exist without a Work Item;
2. Project, Workstream, and Work Item names are visible and understandable;
3. all manual and connected-source modes are discoverable from one composer;
4. connected GitHub activity appears without duplicate employee entry;
5. deterministic approved contract rules can update operational progress automatically;
6. raw commit, PR, file, line, task, or update counts cannot update progress;
7. ambiguous GitHub events cannot update official progress;
8. employee contribution evidence still requires employee review and confirmation;
9. AI shows a draft before using clarification as the dominant interaction;
10. clarification is limited to missing information and resumes safely;
11. confirmed Updates show their result, source, progress impact, next action, and documentation gaps;
12. operational progress is never displayed or stored as employee performance;
13. self-assessment and manager assessment use the same approved `1–5` rubric;
14. the manager remains the final human rating decision-maker;
15. AI produces no rating, prediction, ranking, or productivity score;
16. Arabic/English, RTL/LTR, keyboard focus, mobile sheets, and reduced motion remain verified.

## 15. Required planning correction

After written-spec approval, the implementation plan must be rewritten around coherent user-visible bundles rather than isolated input technologies:

1. **Daily Update Journey Correction**
   - Project-required and Work Item-optional scope.
   - Draft-first AI interaction.
   - result card, autosave, session continuity, and precise errors.
2. **Contract-Aware GitHub Automation**
   - Project/repository bindings.
   - webhook/reconciliation ingestion.
   - deterministic contract-rule evaluation.
   - automatic operational progress snapshots.
   - separate contribution-evidence review.
3. **Unified Manual and Voice Sources**
   - text, voice, image, file, code, CLI, URL, and manual GitHub snapshot in the same lifecycle.
4. **Periodic Fact View and Human Evaluation Preparation**
   - preserve the existing Phase 2 boundary: Fact View preparation first; complete evaluation workflow remains Phase 3 unless separately approved.

Each bundle requires a runnable Arabic-first demo, realistic data, desktop/mobile screenshots, focused tests, protected-boundary checks, and a product-owner stop gate.
