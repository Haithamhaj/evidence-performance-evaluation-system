# Research & Experiments Engine Design

**Status:** Product Owner approved

**Date:** 2026-08-05

**Program checkpoint:** E3

## 1. Outcome

Add one bounded Research & Experiments domain to the existing modular monolith. It represents source intake and Project-relevance review, research framing, focused technical exploration, reproducible experiments, human-confirmed conclusions, decisions, and applied learning as first-class Project work.

The domain makes research visible in daily work, Project history, monthly readiness, and the future Evaluation Fact View without converting research volume, experiment count, or AI output into progress or employee performance.

This design does not build the final frontend. It adds the engine contracts and one minimal bilingual verification journey required to prove the workflow.

## 2. Approved user model

A **Research Record** answers one primary uncertainty inside a required Project. It may optionally belong to a Workstream and may optionally be linked to a Work Item. One Research Record can contain multiple Experiments because a useful investigation commonly tests several approaches or refines the method after an inconclusive result.

The employee journey is:

```text
Project question, source link, or private capture
→ frame the research question
→ review sources and alternatives
→ define one or more experiments
→ record reproducible results and limitations
→ confirm a conclusion
→ record a decision or next experiment
→ link applied learning to real Project work
→ expose confirmed facts to Timeline, readiness, and future evaluation preparation
```

The employee can begin with a small amount of text. The assistant may prepare the structure and identify what is missing, but it asks only one useful question at a time and never activates or concludes the record.

A pasted GitHub repository, paper, documentation page, PDF, or other explicit source link first becomes a private source-review draft. The system safely retrieves only the permitted material, compares it with an authorized version-pinned Project Context Snapshot, and explains relevance, possible value, mismatch, risks, and useful next actions. It may prepare Research, Experiment, or Work Item proposals, but the employee edits and confirms each shared link or official object.

## 3. Approaches considered

### 3.1 Selected: one bounded Research & Experiments domain

Create `@evaluation/research-experiments` inside the modular monolith. It owns its lifecycle, persistence, authorization-aware public readers, AI draft schemas, and append-only history. It consumes Projects, Work Items, Documents, Updates & Evidence, and AI Router only through public interfaces.

This is selected because research and experiment states have independent meaning, integrity rules, and future consumers. The boundary remains one package and one API module—not a package per screen or a generic scientific platform.

### 3.2 Rejected: extend Work Items with research fields

This is initially shorter but overloads a Task with hypotheses, baselines, measures, runs, limitations, decisions, and revision history. It would make ordinary Tasks harder to use and create conditional JSON-heavy persistence.

### 3.3 Rejected: store research as structured Updates

Updates can describe that research occurred, but they cannot safely own an evolving question, multiple experiments, reproducible methods, or human-confirmed conclusions. This would produce unqueryable text blobs and make readiness and Fact View reconstruction unreliable.

## 4. Domain ownership and boundaries

### 4.1 Research & Experiments owns

- Stable Research Record identity and scope.
- Append-only Research revisions.
- Research participants.
- Research source references and comparison notes.
- Private source-review drafts, retrieved-source provenance, and Project-relevance analyses.
- Stable Experiment identity and lifecycle.
- Append-only Experiment method revisions.
- Measure definitions, baselines, test cases, controls, and conditions.
- Immutable Experiment Runs and measured observations.
- Human-confirmed Experiment conclusions.
- Human-confirmed Research conclusions and decisions.
- Applied-learning links.
- Research/Experiment source events for Timeline composition.
- Public authorized readers for monthly readiness and Evaluation Fact View.

### 4.2 Existing domains continue to own

- **Projects:** Project/Workstream authority, membership, responsibility windows, approved Progress Contracts, and operational progress.
- **Work Items:** ordinary Task lifecycle and assignment history.
- **Documents:** safe uploaded sources, immutable document versions, and source extraction.
- **Connected Work Context:** private Gmail/Calendar items and private captured links until the employee confirms a shared Project object.
- **Updates & Evidence:** Update confirmation, Evidence revisions/verification/attribution/confirmation, and the shared Activity Timeline composition.
- **Criteria:** dynamic criteria versions.
- **AI Router:** every provider call, route resolution, output validation, and model trace.
- **Evaluation Preparation:** neutral cross-domain Fact View composition.

### 4.3 Boundary rules

- The Research domain may retain foreign-key identity references but does not query another domain's tables to decide authorization or business state.
- Project scope and current membership come from a Projects public reader.
- Optional Work Item association is validated through a Work Items public reader.
- Uploaded-source availability and safety come from a Documents public reader.
- Confirmed Evidence association is validated through an Updates & Evidence public reader.
- Authorized Project Context Snapshots are composed from versioned public readers; Research stores cited source/version identities, not copied foreign-domain rows.
- A proposed Work Item remains a Research-owned suggestion until the employee confirms it; creation then uses the Work Items public command and its authorization rules.
- Timeline and Evaluation Fact View consume Research public readers; the Research domain does not write surrogate Update or Evidence rows.
- No second database, event store, authentication system, or generic activity platform is introduced.

## 5. Core records

### 5.1 Research Record

A stable root contains:

- ID.
- Required Project ID.
- Optional Workstream ID from the same Project.
- Optional related Work Item ID from the same Project.
- Owner employee ID.
- Current lifecycle state.
- Current revision number.
- Optimistic version.
- Created and last-transition timestamps.

Lifecycle states:

- `DRAFT`: only the owner can edit/review the unconfirmed structure.
- `ACTIVE`: confirmed Project research visible to authorized Project participants.
- `CONCLUDED`: a human-confirmed conclusion and decision/next step exist.
- `CANCELLED`: stopped with a human reason; retained as history.
- `SUPERSEDED`: replaced by a named successor Research Record; retained as history.

The owner cannot change Project scope after `ACTIVE`. A scope correction creates a successor record or an authorized prospective transition; it never rewrites prior source events.

### 5.2 Research Revision

Every revision is immutable and includes:

- Revision number and origin: employee or AI draft.
- Problem statement and business/user context.
- Primary research question.
- Objective.
- Testable hypothesis when applicable; exploratory research may explicitly record `NO_HYPOTHESIS` with reason.
- Assumptions.
- Constraints.
- Known uncertainty.
- Alternatives under consideration.
- Success/decision question.
- Source references used by the revision.
- AI run trace when AI produced the draft.
- Creator and creation time.

Only an employee-authored or employee-confirmed revision can become the active shared revision.

### 5.3 Research participants

The record supports an owner and zero or more contributors with effective start/end timestamps. Participants do not replace Project/Workstream membership or responsibility windows. They describe collaboration on this research only.

An authorized owner transfer closes the previous Research-owner participation window and opens the successor window in the same transaction. It never rewrites earlier authorship, execution, confirmation, or responsibility attribution.

No-response is not contribution acknowledgment, and participant count is not a performance input.

### 5.4 Research source reference

A Research source reference is not automatically Evidence. It records:

- Source kind: paper, repository, documentation, dataset, benchmark, course/video, internal document, link, or other named source.
- Title and canonical URL when available.
- Optional safe Uploaded Source or immutable Document Version reference.
- Relevance note.
- Credibility/limitation note.
- Compared alternative when applicable.
- Employee who added it and time.
- Retrieval state, retrieval time, resolved canonical URL, content fingerprint, and cited section/page/file references when retrieval is permitted.
- Observed license and reuse warning when the source is software or otherwise license-bearing.
- Explicit inaccessible, blocked, stale, or partial state with a truthful reason.
- Superseded/retracted state with reason.

The system stores no copied branding, unapproved external source code, or unnecessary full copyrighted content. Uploaded files use the existing fail-closed upload path.

#### 5.4.1 Source intake and Project-relevance review

An employee may paste an explicit source link from Project, Research, or private capture. A link discovered in private Gmail/Calendar context remains private and unlinked until the employee reviews it. The shared review requires one authorized Project; optional Workstream and Work Item suggestions use the same scope validation rules as Research.

Before any model call, a bounded retrieval adapter:

- permits only supported HTTP(S), GitHub, DOI/paper, documentation, or approved file-source forms;
- blocks loopback, private-network, link-local, metadata-service, unsafe redirect, unsupported protocol, oversized response, and disallowed MIME targets;
- never submits browser cookies, Project credentials, provider keys, or unrelated user authorization to a target;
- follows robots, provider, authentication, rate, copyright, and configured retention limits;
- renders no active content, runs no repository script, and executes no downloaded code;
- records what was retrieved, from where, when, and which bounded sections were available.

The composition layer builds an authorized, version-pinned Project Context Snapshot from the Project's current approved document versions, objective and constraints, active Progress Contract, Workstreams, relevant Work Items, confirmed decisions, prior Research/Experiments, and confirmed Updates/Evidence. It excludes employee ratings, private narratives, private connected context, unrelated Projects, and fields the requesting employee cannot read.

The versioned source-review output includes:

- a source summary with exact citations;
- Project relevance and the Project facts that support it;
- possible benefit, compatible stage/deliverable/KPI, and expected learning;
- technical, operational, privacy, security, licensing, maintenance, cost, and complexity risks when applicable;
- mismatched assumptions, duplication, unavailable information, and uncertainty;
- a recommended disposition: add as Research source, open/refine Research, draft an Experiment, prepare Work Item suggestions, retain privately for later, or dismiss;
- editable Research, Experiment, and Work Item proposals, each retaining the source and rationale.

Model confidence alone never shares or auto-links the source. Deterministic existing bindings may preselect Project context, but the employee confirms the source reference and every official Research, Experiment, or Work Item creation. A Work Item proposal includes Project, optional Workstream, responsible assignee proposal, reason, acceptance conditions, and source reference; it becomes an official Task only through the existing employee-confirmed Work Items lifecycle.

For GitHub, the review is limited to permitted repository metadata and bounded files such as README, license, manifests, and selected documentation/code references. It reports license compatibility and maintenance evidence without cloning, installing, building, executing, or copying the repository. Private repositories require the existing approved GitHub authorization boundary and minimum permissions.

For a paper or technical document, the review records citation identity, method, reported result, limitations, and differences between the paper's conditions and the Project. It never treats a paper's result as a Project result; the employee must run or confirm an applicable Experiment.

A source review pins the retrieved fingerprint and Project Context Snapshot version. Later source or Project changes mark it stale and offer explicit re-analysis; they never silently rewrite the earlier review.

### 5.5 Experiment

An Experiment belongs to exactly one Research Record and inherits its Project scope. It may independently link the same optional Workstream or a more specific Work Item from that Project.

Lifecycle states:

- `DRAFT`.
- `READY` after the method completeness gate.
- `RUNNING`.
- `RESULT_RECORDED` after at least one immutable run.
- `CONCLUDED` after human confirmation.
- `ABANDONED` with a reason.
- `SUPERSEDED` by a named successor.

Starting or completing an Experiment never changes Project progress unless a separately approved Progress Contract rule consumes a confirmed, measurable source fact.

### 5.6 Experiment method revision

Each immutable revision contains:

- Question or hypothesis being tested.
- Baseline definition and baseline value/source.
- Measure definitions.
- Direction or interpretation rule for every measure.
- Test cases or sample definition.
- Controls/comparison method.
- Conditions and environment.
- Dataset/input identity and version where applicable.
- Model/provider/configuration identity and version where applicable, excluding secrets.
- Procedure and reproducibility instructions.
- Known risks and failure cases.
- Creator, origin, source references, and optional AI run trace.

The `READY` transition requires a baseline, at least one measure, test/sample definition, conditions, and reproducibility instructions. An explicitly justified qualitative experiment may use qualitative measures, but it cannot omit the interpretation rule.

### 5.7 Measures, test cases, and controls

These are normalized owned records, not an opaque method JSON blob.

A measure defines:

- Stable ID and method revision.
- Name.
- Kind: numeric, categorical, boolean, or structured qualitative.
- Unit when applicable.
- Direction: higher, lower, target range, match condition, or descriptive.
- Baseline value/reference when applicable.
- Decision threshold or interpretation rule.

A test case defines input/sample identity, expected observation when applicable, category, and inclusion reason. A control defines the comparison target and what remains constant.

### 5.8 Experiment Run and observations

Each run is immutable and pins the exact method revision. It records:

- Run ID and sequence.
- Started/completed time in UTC.
- Executor.
- Environment/input/model versions.
- Result status: completed, failed, invalid, or stopped.
- Observation rows linked to defined measures/test cases.
- Unexpected conditions and execution notes.
- Source references and safe artifact links.

A corrected result is a new run or a superseding observation with a reason; the original remains queryable.

### 5.9 Human-confirmed conclusions and decisions

An Experiment conclusion records:

- Outcome: supported, not supported, inconclusive, invalid, or abandoned.
- Summary tied to named runs/measures.
- Limitations.
- Confidence as human-described bounded language, not a performance score.
- Decision relevance.
- Recommended next experiment or stop reason.
- Employee confirmation and timestamp.

A Research conclusion records:

- Synthesis across sources and Experiments.
- Answer to the research/decision question.
- Remaining uncertainty.
- Decision: adopt, reject, defer, refine, run another experiment, or no decision.
- Decision rationale.
- Next action.
- Human confirmer and timestamp.

AI may draft either conclusion but cannot confirm it or label it source-supported without the named sources/runs.

### 5.10 Applied learning

An Applied Learning record links a confirmed Research conclusion to a real change:

- Work Item created or changed.
- confirmed Update or decision event.
- new Document Version.
- approved prospective Progress Contract/criterion proposal.
- another Research Record or Experiment.
- knowledge-transfer artifact.

It records what changed, why the conclusion caused the change, who confirmed the relationship, and when. Reading or collecting sources alone cannot create Applied Learning.

### 5.11 Evidence links

Research and Experiment records may reference confirmed Evidence through a Research-owned link validated by the Updates & Evidence public interface. The relationship identifies the supported claim, Research/Experiment scope, and optional run/conclusion.

AI may suggest the link and description. The employee must confirm Evidence through the existing Evidence lifecycle before the Research domain treats it as confirmed support.

## 6. Authorization and privacy

- `DRAFT` Research/Experiment content and AI drafts are visible only to the active owner and explicitly authorized system processing.
- `ACTIVE`, `CONCLUDED`, `CANCELLED`, and `SUPERSEDED` confirmed records are visible to authorized Project participants, Project/Workstream owners, and authorized managers according to existing scope rules.
- A manager without Project/evaluation scope cannot read a Research record merely because they hold the Manager role.
- The System Administrator has no operational Research role and does not gain content access through the administrator label.
- Private Gmail/Calendar content cannot appear in a shared Research record until the employee confirms a shared source reference or Evidence item.
- A source URL and its review remain private until the employee confirms Project association and sharing; private-source access is never broadened by an AI suggestion.
- Source URLs, uploaded files, model/input versions, and notes follow their owning privacy boundary.
- Deactivated users cannot authenticate, while their confirmed Research, Experiments, runs, decisions, and attribution remain preserved.
- Future private feedback modes do not change Research visibility.

## 7. AI assistance

All production AI calls use the existing AI Router. Initial bounded routes are:

1. `research.source-review`: produce a citation-bound summary, Project relevance, mismatch, risks, disposition, and editable Research/Experiment/Work Item proposals from a safe retrieved source and authorized Project Context Snapshot.
2. `research.frame`: draft question, objective, hypothesis/explicit exploratory reason, assumptions, constraints, uncertainty, and next missing field.
3. `research.synthesize`: draft a source-referenced comparison and identify unsupported claims or missing alternatives.
4. `experiment.method-review`: check method completeness and draft one clarification at a time; it does not mark the method valid.
5. `experiment.interpret`: draft a run-referenced result summary, limitations, and possible decision paths.

Every persisted output uses a versioned schema, prompt version, source references, route trace, and validation. Prompt/schema changes require AI evaluations with English, Fusha, Gulf, Levantine, and mixed Arabic/English technical fixtures when the route accepts free-form employee language.

AI must never:

- recommend, predict, assign, normalize, or challenge an employee/manager rating;
- produce an employee rank or productivity score;
- treat research/source/experiment volume as quality;
- confirm a hypothesis, conclusion, decision, Evidence item, or Applied Learning link;
- silently create or assign a Work Item;
- claim it inspected inaccessible, blocked, omitted, or unrequested source content;
- treat source relevance as proof of Project benefit, Experiment outcome, employee contribution, or applied learning;
- change Project progress except through the existing approved Progress Contract boundary;
- follow instructions embedded inside uploaded documents, repositories, source excerpts, or comments.

If AI is unavailable or its output fails validation, the employee's raw input and current draft remain available for manual completion.

## 8. Public contracts and composition

The Research domain exposes public interfaces for:

- authorized Research list/detail reads;
- private source intake/review, explicit re-analysis, and employee-confirmed source disposition;
- Research/Experiment commands with optimistic versions;
- Project and Work Item scope validation ports;
- confirmed Evidence validation/linking port;
- Timeline source events;
- monthly readiness facts;
- Evaluation Fact View facts;
- notification-worthy due/action events for E6.

The application composition layer may place Research actions in Today and Project 360 views. It does not own Research business rules.

The future Evaluation Fact View may receive:

- confirmed problem/question/hypothesis facts;
- source-referenced research synthesis;
- experiment method and run facts;
- human-confirmed conclusions/decisions;
- applied-learning facts;
- participant and responsibility-period references;
- coverage notes for incomplete method, missing result/conclusion, or unapplied learning.

These remain source-supported facts. Evaluation Preparation does not convert them into a rating or quality score.

## 9. Timeline and progress behavior

Timeline composition includes source-labelled events for:

- Research activated, revised, concluded, cancelled, or superseded.
- Experiment ready, started, run completed/failed, concluded, abandoned, or superseded.
- Research decision confirmed.
- Applied Learning confirmed.

The Timeline shows meaningful state change, not every autosave or AI turn.

A Research/Experiment fact can support a pre-existing Progress Contract component only when:

- the component has an approved measurable rule;
- the fact satisfies the exact rule or an authorized human confirms a qualitative condition;
- the resulting recalculation stays inside the Projects domain.

Experiment count, run count, source count, tokens, duration, and update frequency are prohibited progress inputs.

## 10. Readiness behavior

Monthly readiness may create a non-scoring action when:

- an active Research Record has no confirmed question/objective;
- an Experiment marked ready/running lacks a required baseline, measure, test/sample, condition, or reproducibility instruction;
- a run exists without a recorded result interpretation;
- an Experiment has no conclusion after work stopped;
- a Research conclusion has no decision/next step;
- claimed Applied Learning has no linked confirmed change;
- Evidence/attribution remains unresolved.

There is no required number of Research Records, sources, Experiments, runs, or Evidence items. Managers see Project/Workstream operational gaps only, not employee readiness percentages or ranking.

## 11. Failure and recovery

- Stale writes return a version conflict and preserve the submitted client draft for comparison/retry.
- Cross-Project Workstream, Work Item, Evidence, source, successor, or Applied Learning links fail atomically.
- Failed AI calls retain raw employee input and permit manual continuation.
- Failed uploads use the existing fail-closed Documents recovery path.
- Blocked, private, paywalled, rate-limited, unsupported, oversized, or partially retrieved links remain truthful source drafts with manual citation/upload alternatives; the system never fabricates a review.
- A failed/invalid/inconclusive Experiment is a valid retained outcome, not an error to erase.
- Abandon/cancel/supersede transitions require a human reason.
- Duplicate command submission uses idempotency keys and returns the original result.
- A partially failed protected mutation rolls back its domain change and same-transaction audit.
- Evaluation/Timeline readers tolerate a missing optional source with an explicit coverage note; they never invent a conclusion.

## 12. Minimal verification surface

The technical browser journey uses one Project-scoped Research page and focused sheets for Research framing, Experiment method, run result, conclusion, and Evidence linking. It demonstrates contracts only.

The deterministic acceptance journey must show:

1. An employee pastes a GitHub or paper link and selects an authorized Project.
2. Safe retrieval and the version-pinned Project Context Snapshot produce a cited relevance review with benefit, mismatch, licensing/security/complexity risks, and uncertainty.
3. The employee edits and confirms one source link, rejects an unsuitable proposal, and confirms selected Research/Experiment/Work Item drafts; no official Task exists before confirmation.
4. A blocked or partially retrieved link reports the limitation and supports manual recovery without fabricated analysis.
5. The employee starts Project-linked Research from the confirmed source or a short question.
6. AI prepares a draft and asks one missing question; manual recovery works when AI fails.
7. The employee confirms the Research Record.
8. The employee creates two Experiments under the same Research Record.
9. One Experiment concludes `NOT_SUPPORTED`; the result and value are preserved.
10. The second Experiment records baseline, measures, test cases, a completed run, limitations, and a human-confirmed decision.
11. Existing Evidence is linked only after employee confirmation.
12. Applied Learning links the decision to a real Work Item or Document Version.
13. Timeline and Evaluation Fact View show source-labelled facts without ratings or volume metrics.
14. Another employee, an unrelated manager, and the System Administrator cannot access the draft, private link review, or unauthorized Project content.
15. Arabic RTL at 390 px and English LTR render mixed model names, repository paths, measures, citations, and URLs correctly.

These screens are not final UX acceptance. The final frontend program will redesign the daily and Project 360 entry points from the handoff schema.

## 13. Testing strategy

- Contract tests for every versioned schema and prohibited field.
- Domain unit tests for state transitions, method completeness, cross-scope invariants, volume-input prohibition, and failed/inconclusive outcomes.
- Source-retrieval tests for SSRF/private-network/redirect/protocol/MIME/size defenses, bounded GitHub/paper retrieval, truthful partial access, content fingerprints, staleness, and no script execution.
- Repository integration tests for append-only revisions/runs/conclusions, idempotency, optimistic concurrency, transactions, and public-reader isolation.
- Migration verification from empty database and previous `main` snapshot with rebuild/drift equivalence.
- Authorization tests for owner, contributor, Project owner, assigned manager, unrelated manager, System Administrator, inactive user, and historical deactivated-user facts.
- Audit atomicity tests for activation, conclusion, cancellation, supersession, and Applied Learning confirmation.
- AI evaluations for the five routes, citation faithfulness, Project-relevance grounding, prompt injection, unsupported conclusions, missing source references, inaccessible-content honesty, prohibited rating output, and Arabic/mixed-language fixtures.
- Evaluation Fact View neutrality tests proving identical source facts under allowed projections and absence of rating/readiness/ranking fields.
- Browser tests for the deterministic journey, recovery, mobile sheet behavior, keyboard focus, RTL/LTR, and mixed-direction technical content.
- Repository scans for AI Router boundaries, secret leakage, task/progress/activity-volume inputs, copy, localization boundaries, formatting, lint, typecheck, and task graph.

## 14. Scope exclusions

E3 does not add:

- a notebook execution environment, model-hosting platform, experiment scheduler, MLflow replacement, dataset warehouse, or generic knowledge base;
- automatic scraping or importing of copyrighted source content;
- broad crawling, autonomous source discovery across the public web, or use of ambient browser authentication to access a source;
- automatic code execution from external repositories;
- automatic Project progress outside an approved Progress Contract;
- employee performance analytics, rating recommendations, ranking, or productivity scoring;
- the complete evaluation, upward-feedback, coaching, notification, export, leave, or final frontend workflows;
- microservices, a second database, a second Evidence store, or a second authentication system.

## 15. Compatibility and migration impact

- One new package and one NestJS API module are added inside the modular monolith.
- One forward-only migration adds Research & Experiments owned tables and intentional indexes/constraints.
- Existing Work Items, Updates/Evidence, Documents, Projects, Criteria, AI Router, and authentication tables are not reclassified.
- Existing Timeline and Evaluation Fact View contracts receive additive source types/readers only.
- No historical Phase 0–2 row is rewritten or backfilled as Research/Experiment data.
- The feature register will move CAP-025–027 only after migration, domain, authorization, AI, reader, and deterministic browser verification pass.

## 16. Acceptance decision

E3 is accepted technically only when the complete deterministic research-to-decision-to-applied-learning journey passes and no protected rule or unresolved P0/P1 finding remains. Live AI quality is evaluated through the existing AI Router but is not required to prove deterministic domain integrity.

After E3, the engine proceeds to E4 Employee Evaluation. The final frontend remains deferred until E7 re-audits every capability and public journey contract.
