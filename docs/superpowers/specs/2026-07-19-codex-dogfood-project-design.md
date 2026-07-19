# Codex Dogfood Project — Real GitHub and Live AI Acceptance Design

**Status:** Product direction approved; written design awaiting Product Owner review
**Date:** 2026-07-19
**Project:** Evidence-supported Performance Evaluation System — Phase 2 Completion
**Employee/contributor persona:** Codex
**Human Product Owner and protected approver:** Haitham
**Repository:** `Haithamhaj/evidence-performance-evaluation-system`

## 1. Objective

Use the product to track the real completion of its own Phase 2 work. Codex acts as a real project contributor inside the local acceptance environment. The repository, Pull Request, checks, Project document, approved Progress Contract, employee Updates, and evidence form one end-to-end source trail.

The experiment must prove that the product can:

1. create a Project from an authoritative main document;
2. let live GPT-5.5 draft a measurable Project Progress Contract from that document;
3. require human review and approval before the contract becomes active;
4. connect the real GitHub repository through the governed GitHub App flow;
5. ingest verified GitHub activity without duplicate employee Updates;
6. apply only pre-approved deterministic progress rules;
7. let Codex add manual text or evidence Updates for work GitHub cannot observe;
8. compare each accepted Update with the previous accepted state;
9. show operational Project progress, documentation gaps, next actions, and an append-only Timeline until closure.

This is Project tracking, not employee performance evaluation.

## 2. Authoritative sources

The main Project document is a versioned, approved composition of:

- `docs/PROJECT_REFERENCE.md`;
- `docs/IMPLEMENTATION_PLAN.md`;
- `TASKS.md`;
- `docs/superpowers/specs/2026-07-19-unified-daily-work-github-progress-design.md`;
- `docs/superpowers/plans/2026-07-19-unified-daily-work-github-progress-plan.md`;
- the current Phase 2 Pull Request and its exact base/head commits.

The system stores an immutable source snapshot containing file paths, commit SHA, content hashes, document version, and approval lineage. Later source changes create a new document version; they do not rewrite the active contract.

Repository files, comments, code, and document content are untrusted AI input. They cannot override the trusted prompt, output schema, protected product rules, or authorization rules.

## 3. Roles and identities

- **Codex employee/contributor:** owns daily implementation Updates, reviews AI wording, confirms personal contribution evidence, and can be assigned Work Items.
- **Project Owner:** coordinates the Project and proposes source/binding changes.
- **Human Product Owner/approver:** approves the main document, Progress Contract, qualitative milestone confirmations, and final product acceptance.
- **System Administrator:** configures the GitHub App and governed AI route but cannot replace the Product Owner’s Project decisions.
- **GitHub system source actor:** records verified automated Project events; it is not a human employee and cannot receive a performance evaluation.

The local Codex user is synthetic acceptance data. It must not impersonate a real employee or alter production identity records.

## 4. Live AI contract drafting

Add one bounded AI route owned by the Projects domain:

`project.progress-contract.draft`

The route consumes:

- exact Project and approved document version identities;
- bounded main-document text and source references;
- current Project/Workstream structure;
- protected rules forbidding employee scoring and raw-activity progress;
- locale and timezone;
- any previous active contract as read-only comparison context.

The versioned output schema may contain only:

- named milestones and deliverables;
- operational KPIs;
- baseline, target, unit, and direction;
- acceptance conditions;
- required evidence;
- optional proposed weights;
- deterministic or human-confirmed rule kind;
- proposed GitHub source mappings where a deterministic rule is possible;
- ambiguities, missing information, and clarification questions;
- source references and model-route trace.

It must not contain ratings, predicted ratings, productivity scores, employee rankings, Documentation Readiness percentages, direct overall-progress percentages, or rules based on commit/PR/file/line volume.

The AI output is always a draft. Haitham reviews and may edit it before using the existing versioned `draft → pending_approval → active` Progress Contract lifecycle. No AI response can activate a contract.

## 5. Initial measurable contract shape

The live AI call determines the exact draft, but the acceptance review expects a bounded contract resembling:

- **Visible Phase 2 slices accepted:** named, pre-approved product slices only; a slice counts only after its runnable outcome and Product Owner acceptance are recorded.
- **Required quality gate satisfied:** the exact required CI checks pass for the approved merge commit; test or commit volume is irrelevant.
- **Documentation and operating evidence accepted:** the defined acceptance pack, screenshots, protected-boundary evidence, and operational notes are present and human-confirmed.
- **Phase 2 release/merge milestone:** the approved Pull Request is merged to the approved base with required checks, or the Product Owner explicitly records why the milestone remains open.

Weights are optional and require human approval. The resulting percentage is calculated from satisfied contract components; nobody enters an overall percentage directly.

## 6. GitHub binding

The GitHub App binds:

- repository: `Haithamhaj/evidence-performance-evaluation-system`;
- Project: the Codex dogfood Project;
- active contract version;
- approved base and Phase 2 branches;
- Pull Request #5 and later approved successors;
- allowlisted checks, workflows, releases, and deployments;
- effective period and reconciliation policy.

Minimum permissions are used. Installation tokens, webhook secrets, provider keys, and raw private payloads are never stored in browser state, logs, screenshots, or committed files.

Verified webhook events are immutable and idempotent. Reconciliation recovers missed events.

## 7. Progress and evidence behavior

An automated GitHub event may update operational Project progress only when it proves a deterministic condition already mapped in the active contract. For example:

> Pull Request #5 is merged into the approved base and every named required check passes.

The system then records the source event, matched rule, calculation inputs, and a new append-only progress snapshot.

Commit count, PR count, changed files, lines changed, PR size, update frequency, and activity volume never affect progress or employee performance.

Ambiguous events create a reviewable Project suggestion. Personal contribution evidence remains suggested until Codex confirms the supported claim and contribution context.

## 8. Real employee Update journey

Codex opens My Work and selects the dogfood Project. Workstream and Work Item remain optional.

Example real Update:

> تم إنهاء Bundle 2 Task 5 وربط قواعد GitHub بالعقد النشط. نجحت اختبارات الربط والصلاحيات، لكن تثبيت GitHub App ما زال يحتاج موافقة المالك.

The live `update.structure` GPT-5.5 route:

1. preserves the raw Update;
2. immediately returns the best current structured draft;
3. maps possible contract components as suggestions;
4. compares with the previous accepted Update;
5. asks one dynamic question at a time only for material gaps;
6. identifies evidence and documentation still needed;
7. returns editable wording.

Codex edits and confirms the Update. Evidence confirmation remains separate and mandatory. The accepted Update and evidence append to the Timeline.

## 9. End-to-end acceptance journey

1. Create the Codex employee and dogfood Project.
2. Snapshot and approve the main Project document.
3. Run a real GPT-5.5 contract-draft call through the AI Router.
4. Review the AI draft, record corrections, and activate it through human approval.
5. Create and approve the GitHub repository binding.
6. Install/connect the GitHub App at the mandatory external human gate.
7. Ingest and reconcile real repository events.
8. Confirm one deterministic event updates Project progress.
9. Confirm one ambiguous event creates review rather than progress.
10. Submit a real Codex Update through live GPT-5.5.
11. Attach and confirm one real evidence item.
12. Show the Project result, comparison, Timeline, KPI state, and remaining documentation.
13. Continue using the Project for later bundles until the approved completion milestone is satisfied.

## 10. Failure and recovery

- Missing or invalid OpenAI output preserves the raw Update/contract draft and changes no official state.
- Missing GitHub credentials stops at the installation gate; the product does not simulate a successful connection.
- Invalid webhook signatures, oversized payloads, replays, and unbound repositories cannot reach progress evaluation.
- Missing or conflicting contract mappings produce `review_required`.
- Revoked access ends the binding prospectively while preserving history.
- A failed reconciliation retries idempotently and never duplicates progress.
- Any AI or GitHub boundary violation blocks the affected bundle as P0/P1.

## 11. Verification and evidence

Each bundle uses focused unit and integration tests. Critical AI, authorization, webhook, audit, migration, and immutability work receives:

- one specification-compliance review;
- one security/code-quality review;
- one bounded remediation cycle for confirmed P0/P1 findings;
- re-review of corrected findings only.

The runnable acceptance pack includes:

- the exact document version and hashes;
- the human-approved contract and component rules;
- redacted AI route/model/prompt/schema trace;
- GitHub binding and event-disposition evidence without secrets;
- before/after Project progress snapshots;
- Codex’s raw and structured Update;
- confirmed evidence and contribution context;
- Arabic/English desktop and mobile screenshots;
- explicit missing or partial behavior.

## 12. Stop gates

Execution stops only for:

- Product Owner approval of the written implementation plan;
- GitHub App creation/installation or credentials requiring direct human action;
- human activation of the AI-drafted Progress Contract;
- unresolved protected-rule or authoritative-source contradiction;
- genuine P0/P1 security, privacy, audit, integrity, or functional failure;
- final Product Owner acceptance before merge.

No Phase 2 merge occurs as part of this experiment without explicit approval.
