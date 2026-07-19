# Phase 2 Feature Map

**Status:** Product-owner approved production feature map
**Design:** `docs/superpowers/specs/2026-07-19-unified-daily-work-github-progress-design.md`
**Implementation plan:** `docs/superpowers/plans/2026-07-19-unified-daily-work-github-progress-plan.md`
**Execution status:** Slice 1, corrected Slice 2, and the Slice 2.5 Codex dogfood proposal checkpoint are complete through the protected human-activation gate

## Purpose

This map connects the approved Product Reset, the Phase 0/1 foundation, the original T030–T044 requirements, and the seven production vertical slices. It prevents the superseded task order or prototype implementation from becoming a second source of truth.

## Foundation reuse

| Capability                             | Existing owner                               | Phase 2 decision                                    |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Identity, sessions, deactivation       | Phase 0 auth/API                             | Reuse unchanged                                     |
| Server authorization                   | `packages/permissions` and API policy guards | Reuse and extend with resource-specific decisions   |
| Audit                                  | `packages/audit`                             | Reuse append-only writer                            |
| Durable work                           | existing worker/queue                        | Reuse; no second queue                              |
| AI providers                           | `packages/ai-routing`                        | Reuse exclusively                                   |
| Projects, Workstreams, responsibility  | `packages/projects`                          | Reuse; add focused Progress Contract capability     |
| Documents and readiness                | `packages/documents`                         | Reuse public interfaces                             |
| Dynamic criteria                       | `packages/criteria`                          | Reuse active-at-time public interface               |
| Work Items                             | Missing                                      | Add `packages/work-items`                           |
| Updates and evidence                   | Missing                                      | Add `packages/updates-evidence`                     |
| My Work/dashboard/timeline composition | Missing                                      | Add read-only application composition in `apps/api` |
| Production daily-work UI               | Missing                                      | Add original React/Next.js screens in `apps/web`    |

## Approved feature-to-slice mapping

| Feature                               | Authoritative input                   | Owning module                    | Slice | Protected boundary                                      |
| ------------------------------------- | ------------------------------------- | -------------------------------- | ----: | ------------------------------------------------------- |
| My Work default home                  | Authorized Work Items and actions     | Work Items + API composition     |     1 | Counts are operational only                             |
| Required Project, optional Workstream | Project/Workstream scope              | Work Items                       |     1 | Same-Project validation                                 |
| Work Item history                     | Accepted commands                     | Work Items                       |     1 | Append-only                                             |
| Project/Workstream Progress Contract  | Active document version               | Projects                         |     1 | Human approval; prospective versions                    |
| Official progress snapshot            | Contract rule plus confirmed sources  | Projects                         |   1–3 | Never task/count/GitHub volume                          |
| Portfolio and Project dashboard       | Authorized read composition           | API/Web                          |     1 | Project progress is not employee performance            |
| Interactive text update               | Employee source plus active context   | Updates & Evidence               |     2 | AI Router; employee correction and confirmation         |
| Dynamic multi-turn clarification      | Missing required fields               | Updates & Evidence               |     2 | One visible question at a time, as many as required     |
| Previous-state comparison             | Previous accepted update and contract | Updates & Evidence + composition |     2 | Source references preserved                             |
| Manual images/files/code/CLI/links    | Employee-provided source              | Updates & Evidence + Documents   |   2–4 | Untrusted input; private access                         |
| AI-drafted evidence description       | Source analysis                       | Updates & Evidence               |     2 | Employee confirmation required                          |
| Timeline                              | Accepted source events                | API composition                  |     2 | No arbitrary mutable activity feed                      |
| GitHub Project automation             | Verified mapped GitHub source         | Projects + connector             |     3 | Deterministic approved contract rule only               |
| GitHub contribution suggestions       | GitHub source plus employee context   | Updates & Evidence connector     |     3 | Employee confirmation required                          |
| GitHub webhook/reconciliation         | Verified external events              | Worker/connector                 |     3 | Minimum permissions, idempotency                        |
| Voice update                          | Audio and transcript revisions        | Updates & Evidence connector     |     4 | Private source, dual human gates                        |
| Thursday check-in                     | Substantive update query              | Updates & Evidence               |     5 | Approved leave excluded                                 |
| Project aggregation                   | Workstream state                      | API composition                  |     5 | No duplicated details                                   |
| Monthly readiness                     | Accepted work/update/evidence state   | Documents/readiness composition  |     5 | No quota, score, rank, or individual manager percentage |
| Manager operations                    | Authorized actions and coarse health  | API/Web                          |     6 | No ranking, predicted rating, or productivity score     |
| Evaluation Fact View preparation      | Source-supported period facts         | Read composition/snapshot        |     7 | No recommended rating                                   |
| Full self/manager evaluation          | Phase 3 scope                         | Not Phase 2                      |     — | Final rating remains human                              |

## Original T030–T044 mapping

The original task IDs remain traceability references. Their former execution order is superseded.

| Original task                     | New slice | Disposition                                                                  |
| --------------------------------- | --------: | ---------------------------------------------------------------------------- |
| T030 Activity Timeline            |         2 | Read projection over accepted events; no generic activity platform           |
| T031 Text Update Composer         |         2 | Expanded to multi-turn AI, comparison, manual evidence, and progress request |
| T032 Voice Update                 |         4 | Connector to the same update lifecycle                                       |
| T033 Evidence Records             |         2 | Combined bounded Updates & Evidence ownership                                |
| T034 Multimodal Analysis          |         2 | Claim support only; never automatic proof                                    |
| T035 Contribution Attribution     |         2 | Included in confirmed evidence lifecycle                                     |
| T036 Workstream Check-in          |         5 | Preserved with substantive-update and leave rules                            |
| T037 Project Check-in Aggregation |         5 | Read composition; no duplicate detail                                        |
| T038 GitHub App                   |         3 | Preserved with minimum permissions                                           |
| T039 GitHub Webhooks              |         3 | Preserved with idempotency and reconciliation                                |
| T040 GitHub Document Sync         |         3 | Limited to approved document bindings and versions                           |
| T041 Suggested Evidence Inbox     |         3 | GitHub suggestions require employee confirmation                             |
| T042 Update/Timeline/Evidence UI  |       1–4 | Delivered incrementally with each visible slice                              |
| T043 Monthly Readiness            |         5 | Preserved as non-scoring aid                                                 |
| T044 Arabic/Dialect Fixtures      |       2–5 | Expanded only with the prompt/schema or voice behavior that requires them    |

## Slice 1 — My Work + Work Items + Progress Contract foundation

### Visible outcome

An authenticated employee opens Arabic My Work, sees Needs My Action, Today, and Overdue first, creates and transitions an authorized Work Item, opens its URL-addressable drawer, and reviews a Project dashboard backed by an approved versioned Progress Contract.

### Backend delta

- Add Work Items persistence, lifecycle, assignment, dependencies, and history.
- Add Progress Contract and append-only official progress snapshots inside Projects.
- Add My Work and Project dashboard composition queries.
- Do not show an official percentage until an active contract has sufficient confirmed source coverage.

### Acceptance

- Project required; optional Workstream belongs to the Project.
- Exact seven statuses.
- Optimistic concurrency and append-only status/assignment history.
- Contract derives from an exact document version and requires authorized approval.
- No direct percentage override.
- Work Item completion/count does not calculate progress.
- Arabic/English, RTL/LTR, keyboard, visible focus, and 390px layouts.

### Demo and screenshots

- Create and transition a Work Item.
- Review My Work grouping.
- Approve a synthetic contract through the real protected path.
- Show progress unavailable/awaiting information, then show one source-backed official snapshot.
- Capture Arabic/English desktop and mobile My Work, Work Item drawer, and Project dashboard.

### Stop gate

Product owner reviews the Work Item lifecycle, contract wording, progress explanation, migration, authorization, concurrency, and history before Slice 2.

## Slice 2 correction — Draft-first unified daily Update

### Visible outcome

An employee chooses a required Project and optional Workstream/Work Item, supplies text or a manual source, sees a useful draft first, answers only necessary questions one at a time, edits and confirms the Update, and sees a compact result card and Timeline event.

### Backend delta

- Reuse the completed update/evidence foundation while making Work Item optional in the UI and keeping Project required.
- Persist and show an evolving draft before clarification becomes the dominant interaction.
- Add session draft continuity, precise recovery, real context names, and a readable confirmed result card.
- Compose previous accepted state and active Progress Contract.
- Use the live AI Router for production and deterministic adapters for tests/demo.
- Request progress recalculation only after employee confirmation.

### Acceptance

- Original text, questions, answers, drafts, employee edits, and source references preserved.
- Project is required; Workstream and Work Item are optional and scope-validated.
- The first useful AI response is a readable draft.
- AI asks as many questions as required while displaying one at a time.
- Evidence is available in the same flow.
- Employee confirmation is mandatory.
- Insufficient source coverage preserves the previous official percentage.
- Uploaded content is private, validated, scanned, and treated as untrusted AI input.
- No rating, rank, productivity, readiness score, or direct provider call.

### Demo and screenshots

- Submit incomplete Arabic text.
- Answer multiple clarification turns.
- Attach and confirm a screenshot/CLI source.
- Review before/after state and official progress explanation.
- Capture the composer, clarification, evidence review sheet, confirmation, and Timeline on desktop/mobile.

### Stop gate

Product owner reviews AI behavior, evidence language, progress explanation, privacy, upload safety, AI route trace, append-only revisions, and prompt/schema evaluations.

## Slice 2.5 — Real Codex Project and live contract proposal

### Visible outcome

The real local `Evidence Performance System — Phase 2` Project uses an immutable approved snapshot of the exact repository commit. Live GPT-5.5 drafts a source-cited Progress Contract proposal, and an authenticated Product Owner can review it in English or Arabic/RTL without the proposal becoming active.

### Acceptance checkpoint

- The local-only seed is safely rerunnable and preserves approved history.
- The approved source records exact paths, commit, Pull Request reference, and content hashes.
- The AI Router uses prompt `project-progress-contract-draft.v2` and output schema `project-progress-contract-draft.v1`.
- The persisted proposal remains `ready` with human approval `pending`.
- No employee score, rating, rank, productivity value, raw-activity rule, or direct overall-progress override is created.
- The authenticated desktop and 390px review UI preserves the separate protected activation boundary.

### Evidence and stop gate

The redacted run record is `docs/acceptance/CODEX_DOGFOOD_ACCEPTANCE.md`; screenshots are under `docs/product/screenshots/phase-2-production/codex-dogfood-contract/`.

Execution is stopped at `human_activation_required`. GitHub automation cannot use the proposal until the Product Owner reviews and activates a contract through the protected lifecycle.

## Slice 3 — Contract-aware GitHub automation and contribution suggestions

### Visible outcome

A verified mapped GitHub PR/check/release/deployment appears automatically in Project activity and may prove a deterministic Progress Contract condition. A separate employee suggestion requires review and confirmation before it becomes personal contribution evidence.

### Backend delta

- Add GitHub App installation, repository grants, versioned Project/Workstream bindings, and deterministic contract mappings.
- Add verified idempotent webhook receipt, reconciliation, suggestion identity, and disposition history to the Updates & Evidence connector.
- Preserve original source IDs and URLs.

### Acceptance

- Minimum permissions and secret isolation.
- Signature validation, replay safety, reconciliation, uninstall handling.
- A deterministic mapped event may update operational Project progress without duplicate employee entry.
- Ambiguous, unbound, conflicting, or qualitative events cannot update official progress automatically.
- Suggestions never become personal contribution evidence before employee confirmation.
- Commit, PR, file, line, and activity volume excluded from calculations.
- Mobile selection opens the review sheet immediately.

### Demo and screenshots

- Ingest one deterministic mapped event and one ambiguous event.
- Verify the mapped event changes Project progress and the ambiguous event does not.
- Confirm and dismiss separate contribution suggestions.
- Capture Inbox and review drawer in Arabic/English desktop/mobile.

### Stop gate

Product owner reviews permission scope, suggestion language, attribution, idempotency, audit, and mobile review behavior.

## Slice 4 — Voice update

### Visible outcome

An employee records or uploads Arabic voice, corrects the transcript, answers remaining questions, attaches evidence, confirms the structured update, and sees it in Timeline.

### Backend delta

- Add private audio source, raw transcript, employee-corrected transcript, STT trace, and retention/access controls.
- Reuse the Slice 2 clarification, evidence, confirmation, and progress request lifecycle.

### Acceptance

- Audio, raw transcript, edited transcript, structured update, and route trace are distinct.
- Employee confirms transcript and final update separately.
- Fusha, Gulf, Levantine, and mixed Arabic/English fixtures.
- Safe file type/size/malware checks and private reads.
- No rating output.

### Demo and screenshots

- Run a deterministic Gulf-Arabic demo through transcript correction and final confirmation.
- Capture record/upload, transcript, questions, review, and Timeline on desktop/mobile.

### Stop gate

Product owner reviews transcript quality, correction friction, retention, privacy, route configuration, dialect fixtures, and dual human gates.

## Slice 5 — Check-ins and monthly readiness

### Visible outcome

The product requests a Thursday check-in only when no substantive update exists and shows an employee the specific thin records to improve without quotas or penalties.

### Backend delta

- Add substantive-update qualification, reminder state, leave-exemption port, Project aggregation, and monthly readiness inputs.
- Extend existing readiness through public interfaces.

### Acceptance

- No duplicate check-in after a substantive update.
- Approved leave excluded.
- Project summary avoids duplicated Workstream detail.
- Employee sees actionable gaps.
- Manager sees coarse authorized state only, with no individual percentage/value/rank.
- No quota, score, automatic penalty, or employee ranking.

### Demo and screenshots

- Show reminder generated and suppressed.
- Show approved-leave exclusion through the current adapter contract.
- Show employee detail and manager coarse projection.
- Capture Arabic/English desktop/mobile states.

### Stop gate

Product owner reviews cadence, leave behavior, false positives, non-scoring copy, and manager privacy.

## Slice 6 — Manager operational view

### Visible outcome

A manager works from compact action queues for blockers, missing operational updates, criteria objections, attribution questions, reassignment, Project health, and coarse documentation gaps.

### Backend delta

- Add authorized manager composition queries and bounded resolution commands.
- Keep readiness and future evaluation routes separate.

### Acceptance

- Server-side department/resource scope.
- No employee Quick Add/Update unless separately authorized as contributor/owner.
- No rank, productivity score, readiness percentage/value, completion/GitHub leaderboard, predicted rating, or suggested rating.
- Compact queues replace oversized metric-only cards.

### Demo and screenshots

- Resolve an operational blocker and inspect Project health.
- Verify forbidden fields are absent from the API and UI.
- Capture Arabic/English desktop/mobile manager routes.

### Stop gate

Product owner reviews action usefulness, authorization, readiness separation, forbidden-field contracts, and mobile density.

## Slice 7 — Evaluation Fact View preparation

### Visible outcome

An authorized employee or manager opens a period preparation view that separates source-supported facts, unclear parts, employee interpretation, results, evidence, responsibility, criteria, and Project progress history without a rating recommendation.

### Backend delta

- Add an immutable source-linked preparation snapshot/query.
- Reuse existing responsibility and criteria-at-time interfaces plus Phase 2 accepted sources.
- Do not add self-assessment, manager rating, finalization, or cycle closure commands.

### Acceptance

- Fact and interpretation separation in API and UI.
- Active-at-time criteria and actual responsibility period.
- Evidence and progress source traceability.
- No automatic average, predicted rating, recommended rating, or preselected rating.
- Snapshot immutability and authorization.

### Demo and screenshots

- Trace one accepted update/evidence source into the preparation view.
- Show unclear source coverage and historical progress explanation.
- Capture Arabic/English desktop/mobile views.

### Stop gate

Product owner reviews neutrality, privacy, source trace, historical accuracy, and the boundary excluding the full evaluation workflow.

## Cross-slice completion rule

Every slice ends with focused tests, related integration tests, a runnable local demo, accepted screenshots, commit, push, updated task state, and the declared product-owner stop gate. The full repository suite runs after shared-foundation changes, at major integration checkpoints, and before the Phase 2 Pull Request becomes ready.
