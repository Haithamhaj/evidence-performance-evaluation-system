# Evidence Performance Evaluation System — Project Document v7

**Document status:** Approved source for Progress Contract drafting

**Effective behavior:** Prospective from human activation of the resulting Progress Contract

**Project employee used for dogfood:** Codex

## 1. Project purpose

Complete an AI-native daily work system that helps employees understand and finish their work with
less administrative effort, while preserving evidence history and the manager's final human judgment
in performance evaluation.

The product must connect Projects, Work Items, Updates, Evidence, GitHub and Google context, Research,
Experiments, and Evaluation through simple daily journeys. AI may understand, connect, summarize,
prepare, ask focused questions, and suggest the next safe action. It never assigns or recommends an
employee rating, rank, productivity score, or official Project progress value.

## 2. Current verified baseline

The modular engine and its protected domain boundaries are complete. The Command Brief frontend now
has verified daily Home, Work, universal Capture, employee review and confirmation, source review,
Project Overview/Plan/Work/Progress/Timeline, Project Agent, Project chat, and role-aware ownership
context.

The real Codex dogfood Project has confirmed Updates and Evidence and a current Project Document, but
does not yet have an active Progress Contract. Therefore the product correctly shows no official
percentage. Project Document v6 is preserved as history but describes an older implementation stage.

## 3. Progress calculation rule

Use `stage_gate` with no component weights.

A stage is confirmed only when its approved acceptance conditions are met and an authorized human
confirms the result. A Work Item, Update, Evidence item, source event, or AI analysis may support the
review, but cannot change official progress by itself.

Project progress must never be calculated from:

- completed Work Item count or Task volume;
- Update or check-in frequency;
- GitHub activity, pull requests, commits, checks, files, or lines changed;
- Evidence quantity, document quantity, Research quantity, or Experiment quantity;
- employee activity or any performance inference.

Project progress is not employee performance.

## 4. Remaining stage gates

### Gate 1 — Phase 3 Project Workspace closure

**Outcome:** The Project experience answers purpose, current state, next stage, blocker, latest
confirmed change, employee action, ownership scope, source health, contract state, and meaningful
timeline from authorized data.

**Acceptance conditions:** Project Workspace capability matrix is closed; active-contract chart state
is visually reviewed; no raw activity feed or false progress appears; all role and ended-access cases
remain correct.

**Required evidence:** focused automated checks, runnable Product Owner journey, screenshots, and the
approved Progress Contract activation receipt.

### Gate 2 — Phase 4 Updates, Voice, Sources, and Evidence

**Outcome:** An employee can capture text, code, link, file, image, or voice; AI asks only for missing
context; the employee edits and confirms independent Update and Evidence records; manual fallback
preserves input when AI or a connector fails.

**Acceptance conditions:** voice recording/transcription/edit/retry works; source lineage, visibility,
freshness, and provider state are clear; GitHub stays suggested Evidence; private or revoked sources
fail closed; confirmed authorized facts alone reach future evaluation preparation.

**Required evidence:** protected command receipts, source references, privacy negatives, runnable
desktop/mobile journeys, and employee confirmation.

### Gate 3 — Phase 5 Research, Experiments, Decisions, and Applied Learning

**Outcome:** A research question can be traced through reviewed sources, synthesis, an optional
experiment, results, a decision, and an applied next action linked to real Project work.

**Acceptance conditions:** limitations and licensing are visible; failed or contradictory experiments
are retained; the assistant does not invent claims or conclusions; unlinked research is explicit.

**Required evidence:** cited source review, versioned experiment setup and results, decision record,
applied-learning link, and runnable journey.

### Gate 4 — Phase 6 Evaluation

**Outcome:** Employees complete quarterly or configured self-assessment and managers complete an
independent assessment using the same approved rubric and an authorized Fact View. The manager makes
the final human rating decision.

**Acceptance conditions:** Facts are separated from employee interpretation; AI wording help starts
only after a human rating choice; no AI rating recommendation exists; manager drafts stay independent;
finalization creates immutable history; protected Documentation Readiness values do not leak.

**Required evidence:** employee and manager journeys, positive and negative authorization tests,
neutral Fact View proof, immutable snapshot receipt, and Product Owner acceptance.

### Gate 5 — Phase 7 Manager Operations and Continuity

**Outcome:** Managers act on approvals, blockers, ownership gaps, handovers, leave, and scoped acting
authority without surveillance or employee scoring.

**Acceptance conditions:** private employee context stays private; Manager and Administrator authority
remain separate; leave exclusions are fair; acting permission expires correctly; no ranking,
readiness percentage, productivity prediction, or predicted rating is shown.

**Required evidence:** role matrix, time-window tests, authorized operational queues, negative privacy
journeys, and manager acceptance.

### Gate 6 — Phase 8 Operational surfaces and release-quality experience

**Outcome:** Personal and Project insights, notifications, Google/GitHub connections, reports,
administration, localization foundations, accessible charts, and safe recovery are usable without
turning analytics into employee monitoring.

**Acceptance conditions:** every chart has text/table equivalence; telemetry is isolated from Project
progress and Evaluation; external setup is clearly identified; English pilot journeys are complete;
Arabic/RTL foundations remain correct and Arabic Evaluation stays behind its semantic approval gate.

**Required evidence:** connection health and recovery, report authorization, accessibility review,
English desktop/mobile journeys, RTL layout checks, and operator runbooks.

### Gate 7 — Phase 9 Internal Beta readiness and launch decision

**Outcome:** All selected capabilities have a complete manual journey, appropriate assistance,
authorization coverage, recovery, ownership, documentation, and independent feature rollback.

**Acceptance conditions:** capability parity is complete; temporary verification routes retire only
after parity; provider outages preserve manual work; performance and accessibility budgets pass;
role/locale/device matrices pass; the Product Owner makes the internal launch decision.

**Required evidence:** final capability audit, critical end-to-end journeys, security/privacy matrix,
provider recovery proof, internal guides, rollback evidence, and direct Product Owner acceptance.

## 5. Operational KPI

### Confirmed protected-boundary violations

- **Baseline:** `0`
- **Target:** `0`
- **Unit:** confirmed protected-boundary violations
- **Direction:** maintain
- **Measurement:** deterministic boundary checks plus authorized human review of confirmed incidents
- **Interpretation:** a governance condition for the Project, never an employee score or rating

## 6. Ownership, approval, and evidence rules

- Primary Project Owner coordinates the contract and is not automatically a people manager.
- Each gate identifies an authorized human approver according to existing domain policy.
- AI may prepare components and clarifications but cannot save a human revision, submit, approve,
  activate, override, or silently alter the contract.
- Evidence must identify its supported claim, related Project/Work Item or Workstream, source,
  contribution context, verification state, and relevant gate/KPI.
- GitHub remains suggested Evidence until employee confirmation.
- Manual override requires an authorized reason and audit.

## 7. Versioning and historical treatment

This document creates a new append-only source version. It does not edit or delete v1–v6. Any
Progress Contract produced from it receives its own version, effective date, owner/approver, and
human approval history.

The contract applies prospectively. Previously verified work may be reviewed as source material for
an authorized initial stage baseline after activation, but no new criterion is applied retroactively
and no historical Project, Evidence, or Evaluation record is reclassified.

## 8. Authoritative references

- `AGENTS.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/EVALUATION_RUBRIC.md`
- `docs/superpowers/plans/2026-08-11-ai-native-frontend-master-plan.md`
- `project-state/PROJECT_STATE.md`
- `docs/product/ENGINE_FEATURE_REGISTER.md`
- `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md`
