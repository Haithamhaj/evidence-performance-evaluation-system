# Engine Feature Register

**Baseline:** `main` at `a631eaa81a5b462f329e5917c5be3301281f970a`
**Audit date:** 2026-08-10
**Purpose:** authoritative capability ledger for completing the engine before designing the final frontend.

## How to read this register

- A feature name, database table, or verification screen is not proof of completion.
- `COMPLETE` means the protected behavior, authorization boundary, history rule, and relevant recovery path are implemented and tested.
- `PARTIAL` means useful engine pieces exist but the approved user capability is not complete.
- `PLANNED` means the authoritative requirement exists but production capability does not.
- `EXTERNAL_GATE` means the engine is present but real use needs an external administrator, credential, consent, or infrastructure action.
- `DEFERRED_APPROVED` means the Product Owner has explicitly deferred the capability without weakening a protected rule.
- `SUPERSEDED` is reserved for rejected interaction or implementation directions retained only for history.

The temporary Next.js screens are contract-verification surfaces. They are not evidence that the final daily employee or manager experience is ready.

## Executive baseline

The engine already has a strong governed spine: identity, server-side authorization, append-only audit, AI routing, queues, Projects/Workstreams, responsibility windows, safe documents, dynamic criteria, Work Items, private connected context, Updates/Evidence, GitHub suggestion processing, progress contracts, operational readiness, manager queues, and a neutral Evaluation Fact View.

The pilot engine is now technically complete. Remaining work is deliberately outside engine
implementation: final daily-use frontend design and acceptance, production connector/provider setup,
the protected Arabic-rubric approval, and the Product Owner launch decision.

## Capability records

### CAP-001 — Sign-in and synchronized identity

**ID:** CAP-001 | **Capability:** OIDC sign-in, session callback, profile synchronization, and deactivation denial | **User roles:** all authenticated roles | **User goal:** enter the system with the company identity and retain one historical user record
**Authoritative sources:** `PROJECT_REFERENCE.md` §§8, 29; T006, T068 | **Owner module:** `@evaluation/auth`, web auth routes | **Inputs/sources:** OIDC claims and configured issuer/audience | **AI role:** none
**AI prohibitions:** credentials and tokens never enter prompts/logs | **Human gate:** identity-provider administrator config | **States/transitions:** unknown → active synchronized user → deactivated | **Public API/events:** `GET /api/v1/me`; `/api/auth/login|callback|logout`
**Authorization/privacy:** server validates signature, expiry, issuer, audience, and active state | **Audit/history:** OIDC identity and user history retained | **Failure/recovery:** invalid/stale sessions fail closed and restart login | **Tests:** `packages/auth/src/*.test.ts`, `tests/integration/auth.integration.test.ts`
**Status:** COMPLETE | **External gate:** production OIDC client/realm configuration | **Frontend implications:** one calm sign-in/recovery path; never expose callback JSON or tokens

### CAP-002 — Server authorization and protected audit

**ID:** CAP-002 | **Capability:** scoped policy decisions plus append-only, same-transaction audit for protected actions | **User roles:** all roles; administrator for audit queries | **User goal:** see and change only authorized resources with accountable history
**Authoritative sources:** `PROJECT_REFERENCE.md` §§8, 29–30; T007, T009 | **Owner module:** `@evaluation/permissions`, `@evaluation/audit` | **Inputs/sources:** roles, resource scope, responsibility windows, action, reason | **AI role:** none
**AI prohibitions:** AI never grants access | **Human gate:** sensitive future-mode access requires reason | **States/transitions:** decision allow/deny; immutable audit append | **Public API/events:** policy guards; `GET /audit`
**Authorization/privacy:** UI hiding is never authorization | **Audit/history:** database rejects audit mutation | **Failure/recovery:** protected mutation rolls back if audit append fails | **Tests:** `tests/integration/authorization.integration.test.ts`, `audit-authorization`, `protected-audit-atomicity`, `packages/audit/src/audit-service.integration.test.ts`
**Status:** COMPLETE | **External gate:** none | **Frontend implications:** explain denials in plain language and request a reason only where policy requires it

### CAP-003 — Governed AI routing

**ID:** CAP-003 | **Capability:** Project → Department → System AI route resolution with schemas, source trace, fallback, and secret isolation | **User roles:** system administrator configures; features consume | **User goal:** receive governed AI assistance without exposing keys or allowing feature modules to bypass policy
**Authoritative sources:** `PROJECT_REFERENCE.md` §29; T011–T012 | **Owner module:** `@evaluation/ai-routing` | **Inputs/sources:** approved route, model config, prompt/schema version, trusted source references | **AI role:** route and validate permitted assistance
**AI prohibitions:** no rating, prediction, rank, productivity score, or direct provider call from features | **Human gate:** route override reason and feature-specific confirmation | **States/transitions:** requested → routed → validated/fallback/failed → traced | **Public API/events:** package router/runtime contracts; AI run trace
**Authorization/privacy:** provider keys exist only at the router boundary | **Audit/history:** route/model/schema/source/usage trace retained | **Failure/recovery:** schema failure and unavailable providers fail or use approved fallback | **Tests:** `packages/ai-routing/src/*.test.ts`, `tests/integration/ai-*.integration.test.ts`, `tests/repository/ai-provider-boundaries.test.ts`
**Status:** COMPLETE | **External gate:** live provider key/model availability | **Frontend implications:** show draft/source/confidence/failure state, never provider secrets or rating-like language

### CAP-004 — Localization, RTL, and rubric locale control

**ID:** CAP-004 | **Capability:** English/Arabic routing, RTL/LTR, mixed-direction text, timezone formatting, and versioned locale content | **User roles:** all | **User goal:** use normal work surfaces in the preferred language without changing stored meaning
**Authoritative sources:** protected rule 22; `PROJECT_REFERENCE.md` §36; T015–T016 | **Owner module:** `@evaluation/localization`, web locale shell | **Inputs/sources:** stable IDs, locale catalogs, approved rubric locale | **AI role:** language-aware outputs only where evaluated
**AI prohibitions:** translation cannot silently change criterion meaning | **Human gate:** Arabic employee evaluation requires Arabic rubric approval and semantic review | **States/transitions:** locale switch; draft Arabic rubric remains inactive | **Public API/events:** locale routes and catalogs
**Authorization/privacy:** locale does not alter permissions | **Audit/history:** rubric locale versions share stable IDs | **Failure/recovery:** missing locale falls back without altering stored identity | **Tests:** localization package tests; `tests/e2e/locale-shell`, `mixed-direction`, `rtl-focus`; repository localization checks
**Status:** PARTIAL | **External gate:** T016 human language/semantic approval | **Frontend implications:** final UI must be fully bilingual; employee evaluation stays English-only until the gate closes

### CAP-005 — Durable jobs and operational receipts

**ID:** CAP-005 | **Capability:** versioned asynchronous jobs, idempotency receipts, retry state, and correlation propagation | **User roles:** system operations; indirect benefit to all | **User goal:** long-running analysis and sync recover safely without duplicate effects
**Authoritative sources:** `IMPLEMENTATION_PLAN.md` queue/reliability sections; T013 | **Owner module:** API/worker queue infrastructure, database operations | **Inputs/sources:** versioned job envelope, operation ID, correlation ID | **AI role:** executed only through governed job handlers
**AI prohibitions:** retry must not bypass validation or human gates | **Human gate:** administrative replay is authorized | **States/transitions:** queued → processing → succeeded/retry/failed | **Public API/events:** internal job contracts and worker consumers
**Authorization/privacy:** job payloads are bounded; logs omit secrets | **Audit/history:** receipts and run correlation retained | **Failure/recovery:** retry/idempotency and graceful draining | **Tests:** `tests/integration/queue-*.integration.test.ts`, `administrative-replay`, `correlation-contract`
**Status:** COMPLETE | **External gate:** production Redis/worker deployment | **Frontend implications:** async actions need pending/retry/failure states, not blocking spinners

### CAP-006 — Projects, Workstreams, membership, and ownership

**ID:** CAP-006 | **Capability:** create/read/transition Projects and Workstreams with contributor membership and one primary owner | **User roles:** manager, Project owner, Workstream owner, contributors | **User goal:** organize real work under a required Project and optional Workstream
**Authoritative sources:** `PROJECT_REFERENCE.md` §§9–10; T018–T019 | **Owner module:** `@evaluation/projects` | **Inputs/sources:** Project/Workstream metadata and memberships | **AI role:** none for authority; semantic context may read approved documents
**AI prohibitions:** AI cannot appoint owners or infer performance | **Human gate:** manager-governed creation/assignment | **States/transitions:** planned/active/paused/completed/archived with invariant checks | **Public API/events:** `apps/api/src/projects/projects.controller.ts`, `workstreams.controller.ts`
**Authorization/privacy:** scoped reads/actions enforced server-side | **Audit/history:** membership periods and status changes retained | **Failure/recovery:** stale/invalid transitions reject without partial mutation | **Tests:** project/workstream integration tests; `tests/e2e/project-workspace.spec.ts`; migrations `0009`
**Status:** COMPLETE | **External gate:** none | **Frontend implications:** Project is mandatory context; hide internal UUIDs and keep ownership distinct from management

### CAP-007 — Responsibility windows and owner transfer

**ID:** CAP-007 | **Capability:** atomic Project/Workstream owner transfer with time-bounded responsibility history | **User roles:** manager; owners and employees as readers | **User goal:** attribute facts to the person responsible during the actual period
**Authoritative sources:** protected rule 15; `PROJECT_REFERENCE.md` §§10, 27; T020 | **Owner module:** `@evaluation/projects` | **Inputs/sources:** transfer effective time, old/new owner, scope | **AI role:** may read windows; cannot decide ownership
**AI prohibitions:** no retroactive reassignment of facts | **Human gate:** authorized manager transfer | **States/transitions:** current window closes; new half-open UTC window begins atomically | **Public API/events:** `apps/api/src/projects/responsibilities.controller.ts`
**Authorization/privacy:** history is scope-filtered | **Audit/history:** immutable responsibility windows and transfer audit | **Failure/recovery:** transaction rollback preserves exactly one active owner | **Tests:** `responsibility-service.integration.test.ts`, `tests/integration/protected-audit-atomicity.integration.test.ts`
**Status:** COMPLETE | **External gate:** none | **Frontend implications:** show effective dates and current owner without editable historical rows

### CAP-008 — Safe documents, templates, versions, and private files

**ID:** CAP-008 | **Capability:** scoped templates, one resource document, append-only versions, safe upload, private storage, and authorized read | **User roles:** authorized Project/Workstream participants and managers | **User goal:** maintain the authoritative Project document and supporting files safely
**Authoritative sources:** `PROJECT_REFERENCE.md` §11; T021–T023 | **Owner module:** `@evaluation/documents` | **Inputs/sources:** text, PDF/DOCX/image/file, active template version | **AI role:** safe extraction and later analysis of untrusted content
**AI prohibitions:** uploaded instructions are untrusted; no direct authority | **Human gate:** protected template activation and document correction | **States/transitions:** template draft/active/retired; document version append | **Public API/events:** document/template/upload controllers
**Authorization/privacy:** type/size/archive/malware validation; private signed reads reauthorize | **Audit/history:** source/template/version lineage immutable | **Failure/recovery:** fail closed before storage; optimistic concurrency on version append | **Tests:** documents package integration/unit tests, object-storage integration, migration `0010`
**Status:** COMPLETE | **External gate:** production object store and ClamAV | **Frontend implications:** upload progress, scan failure, version history, and source identity need simple visible states

### CAP-009 — Document readiness and material-change analysis

**ID:** CAP-009 | **Capability:** source-bound readiness, correction guidance, adjacent-version comparison, and human review | **User roles:** employee/owner; manager receives safe operational projection | **User goal:** know what the Project document lacks and what materially changed
**Authoritative sources:** protected rules 2–3; `PROJECT_REFERENCE.md` §§11–12; T024–T025 | **Owner module:** `@evaluation/documents` plus analysis worker | **Inputs/sources:** immutable document/template versions | **AI role:** structured readiness and comparison drafts with source references
**AI prohibitions:** readiness is not a rating/performance score; managers do not see individual percentages | **Human gate:** employee correction/review | **States/transitions:** requested → analyzed → reviewed; results append | **Public API/events:** `document-analysis.controller.ts`; analysis jobs
**Authorization/privacy:** manager-safe projection removes protected values | **Audit/history:** every run pins source and route trace | **Failure/recovery:** failed jobs retry without overwriting previous results | **Tests:** readiness/comparison tests, AI eval `analysis-criteria.test.ts`, Phase 1 acceptance
**Status:** COMPLETE | **External gate:** live model route availability | **Frontend implications:** display missing sections/actions, not a score gauge

### CAP-010 — Dynamic Project and Workstream criteria

**ID:** CAP-010 | **Capability:** AI-proposed, source-bound, human-reviewed, versioned criteria with prospective activation | **User roles:** employee, Project/Workstream owner, contributors, manager resolver | **User goal:** agree measurable Project-context criteria without changing history
**Authoritative sources:** protected rules 7–8; `PROJECT_REFERENCE.md` §12; T026–T028 | **Owner module:** `@evaluation/criteria` | **Inputs/sources:** approved Project/Workstream document version | **AI role:** propose 1–3 Project or 2–3 Workstream criteria
**AI prohibitions:** cannot activate, apply retroactively, or generate a performance rating | **Human gate:** correction/rejection, owner approval, contributor acknowledgement/objection, bounded manager resolution | **States/transitions:** proposal → review → frozen responses → active prospective set → later revision | **Public API/events:** `criteria.controller.ts`; public criteria readers
**Authorization/privacy:** participants see only scoped review | **Audit/history:** source versions, objections, responses, and prior sets retained | **Failure/recovery:** atomic activation and optimistic checks | **Tests:** criteria integration tests; AI analysis eval; workstream criteria E2E; migrations `0011`
**Status:** COMPLETE | **External gate:** none beyond model availability | **Frontend implications:** separate AI draft from human approval and show effective version/date

### CAP-011 — Project/Workstream Progress Contract

**ID:** CAP-011 | **Capability:** versioned, human-approved milestones/deliverables/KPIs/evidence/rules with source-explained human confirmation | **User roles:** Project/Workstream owner, approver; contributors as readers | **User goal:** define how operational progress is measured from the main Project document
**Authoritative sources:** approved Progress Contract amendment; `PROJECT_REFERENCE.md` §§11–12; P2R-S5 | **Owner module:** `@evaluation/projects` | **Inputs/sources:** approved document, baseline/target/unit/direction, acceptance conditions, weights, effective date | **AI role:** draft from document through AI Router
**AI prohibitions:** cannot approve or invent undisclosed rules; no employee evaluation | **Human gate:** owner edit and approver confirmation | **States/transitions:** draft → revised → approved version → superseded; authorized confirmations append their source and outcome | **Public API/events:** `progress-contract-drafts.controller.ts`; progress services
**Authorization/privacy:** owner/manage scopes enforced | **Audit/history:** versions, lineage, confirmations, and transitions retained; direct percentage override is prohibited | **Failure/recovery:** stale draft/approval rejects; prior active contract remains | **Tests:** progress-contract package tests, AI draft eval, Slice 5 acceptance; migrations `0012–0013`, `0016`
**Status:** COMPLETE | **External gate:** none | **Frontend implications:** guided setup from the document; avoid technical rule editors unless expanded deliberately

### CAP-012 — Operational Project progress and snapshots

**ID:** CAP-012 | **Capability:** calculate and confirm Project/Workstream progress only from approved measurable rules and governed source facts | **User roles:** employee/contributor, owner/approver, manager operational reader | **User goal:** see honest progress, evidence, gaps, and the next close-out action
**Authoritative sources:** approved Progress Contract correction; P2R-S4–S5 | **Owner module:** `@evaluation/projects`; governed readers from Updates/Evidence and GitHub | **Inputs/sources:** contract components, verified source events, authorized human confirmation | **AI role:** explain progress/gaps and draft proposed changes
**AI prohibitions:** no task-volume, update-frequency, commit/file/line count, or employee rating | **Human gate:** measurable rule match or authorized qualitative-condition confirmation; direct percentage override is prohibited | **States/transitions:** proposed change → confirmed/rejected → append-only snapshot | **Public API/events:** daily-work Project/readiness endpoints; progress query/calculation services
**Authorization/privacy:** scoped by Project and role | **Audit/history:** source references and official snapshots append | **Failure/recovery:** ambiguous source stays suggestion; no silent progress mutation | **Tests:** progress calculation/query tests, GitHub condition matcher, Slice 5 E2E/acceptance
**Status:** COMPLETE | **External gate:** live sources may be gated | **Frontend implications:** progress is Project status, never employee score; show calculation basis and confirmation

### CAP-013 — Work Items and normal task lifecycle

**ID:** CAP-013 | **Capability:** required-Project Tasks with optional Workstream, assignee, due date, checklist, status, and immutable assignment history | **User roles:** employees, owners, authorized managers | **User goal:** plan and complete ordinary work like a modern task tool
**Authoritative sources:** AI-first Daily Workspace design; P2R-S1; T030–T042 trace | **Owner module:** `@evaluation/work-items` | **Inputs/sources:** human-created or confirmed AI-drafted task | **AI role:** may prepare a draft; never silently assign or create confirmed work
**AI prohibitions:** task count/completion cannot score progress or performance | **Human gate:** user confirms AI draft and protected assignment | **States/transitions:** open/in-progress/blocked/done/cancelled plus history | **Public API/events:** `work-items.controller.ts`
**Authorization/privacy:** assignee/contributor/manager scopes | **Audit/history:** task status and assignment history retained | **Failure/recovery:** invalid transitions and stale actions reject | **Tests:** work-items package tests; Slice 1 E2E/acceptance; migrations `0012`, `0017`
**Status:** COMPLETE | **External gate:** none | **Frontend implications:** familiar compact Task interaction; AI appears as optional help, not extra workflow

### CAP-014 — Today, Needs My Action, and private Inbox

**ID:** CAP-014 | **Capability:** employee daily composition ordered Needs My Action → Today → Overdue plus a private capture inbox | **User roles:** employee/contributor | **User goal:** start the day with the smallest useful action list and capture unclassified work privately
**Authoritative sources:** approved My Work correction; P2R-S1 | **Owner module:** `@evaluation/work-items` plus daily composition API | **Inputs/sources:** Tasks, private inbox, review queues, check-in obligations | **AI role:** may suggest classification/task drafts after confirmation
**AI prohibitions:** private inbox is not visible to managers and does not become performance evidence | **Human gate:** promote/dismiss and Project linking | **States/transitions:** captured → promoted/dismissed; action groups recompute | **Public API/events:** private inbox controller; `GET /api/v1/daily-work/my-work`
**Authorization/privacy:** inbox owner-only | **Audit/history:** promoted work retains origin where defined | **Failure/recovery:** empty and stale queues remain usable | **Tests:** inbox/query tests; Slice 1 E2E/acceptance
**Status:** COMPLETE | **External gate:** none | **Frontend implications:** default employee home; progressive disclosure after the first three groups

### CAP-015 — Fast text/code/file update lifecycle

**ID:** CAP-015 | **Capability:** universal capture, dynamic one-question-at-a-time clarification, structured editable draft, explicit confirmation, and append-only event | **User roles:** employee/contributor | **User goal:** record meaningful work quickly using text, code, links, screenshots, or files
**Authoritative sources:** `PROJECT_REFERENCE.md` §14; approved update lifecycle; P2R-S4 | **Owner module:** `@evaluation/updates-evidence` | **Inputs/sources:** raw content, Project/Workstream/Task context, prior relevant state, attachments | **AI role:** detect gaps, ask sequential questions, structure claim/result/decision/next step, suggest links
**AI prohibitions:** AI draft is not confirmed fact, progress, evidence, or performance | **Human gate:** employee edit and confirmation | **States/transitions:** raw → clarify → draft → edited → confirmed/failed; timeline append | **Public API/events:** `updates.controller.ts`; update services
**Authorization/privacy:** contributor scope and safe attachment path | **Audit/history:** raw source, prompts/schema/route trace, draft revisions, confirmation retained | **Failure/recovery:** failed AI keeps raw draft and supports retry/manual completion | **Tests:** update service/structurer/source tests; update AI evals; Slice 4 E2E/acceptance; migrations `0014–0015`, `0024`
**Status:** COMPLETE | **External gate:** live AI route for production structuring | **Frontend implications:** one lightweight composer; evidence entry stays in the same sheet, not a separate form maze

### CAP-016 — Voice update

**ID:** CAP-016 | **Capability:** attach audio, transcribe through governed routing, edit transcript, and continue through the same Update lifecycle | **User roles:** employee/contributor | **User goal:** speak a quick update in Fusha, Gulf, Levantine, or mixed technical language
**Authoritative sources:** T032, T044; P2R-S4 | **Owner module:** `@evaluation/updates-evidence` | **Inputs/sources:** private audio and update context | **AI role:** transcription and permitted structuring through AI Router
**AI prohibitions:** transcript is not automatically accepted evidence/fact | **Human gate:** transcript edit and update confirmation | **States/transitions:** uploaded → leased/transcribing → transcribed/failed → edited → confirmed | **Public API/events:** `voice.controller.ts`; voice services
**Authorization/privacy:** private media resolver, bounded lease, no audio in logs | **Audit/history:** attempt/source/transcript lineage retained | **Failure/recovery:** expired lease/retry without duplicate confirmation | **Tests:** voice service/transcriber tests, speech and transcription evals, Slice 4 E2E; migrations `0025–0026`
**Status:** COMPLETE | **External gate:** live speech-capable model | **Frontend implications:** record/review/edit in one bottom sheet with visible retry

### CAP-017 — Evidence, contribution attribution, and Activity Timeline

**ID:** CAP-017 | **Capability:** employee-confirmed evidence linked to claim/Task/Project/Workstream/KPI/criterion/contribution plus source-labelled append-only Timeline | **User roles:** employee/contributor; authorized owners/managers as readers | **User goal:** show what supports the work and who contributed without turning activity into a score
**Authoritative sources:** `PROJECT_REFERENCE.md` §§13, 15; T030, T033–T035; P2R-S4 | **Owner module:** `@evaluation/updates-evidence` | **Inputs/sources:** manual files/links/code/screenshots and governed connector suggestions | **AI role:** draft description and relationships
**AI prohibitions:** cannot verify itself, resolve attribution as fact, or create performance metrics | **Human gate:** employee confirmation; disputes/verification remain explicit | **States/transitions:** draft/suggested → confirmed/rejected; verification state and revisions append | **Public API/events:** evidence controller, timeline controller, public activity/evaluation readers
**Authorization/privacy:** private sources remain scoped; managers see only authorized facts | **Audit/history:** evidence revisions, source IDs, attribution and confirmed events retained | **Failure/recovery:** unsupported/ambiguous evidence remains unconfirmed | **Tests:** evidence/activity/evaluation readers; Slice 4 E2E/acceptance; migrations `0014`, `0023–0024`
**Status:** COMPLETE | **External gate:** connector-specific source gates | **Frontend implications:** mobile evidence opens a visible review sheet; every item labels source and verification

### CAP-018 — Thursday check-ins and monthly documentation readiness

**ID:** CAP-018 | **Capability:** require a Workstream check-in only when no substantive weekly update exists; aggregate Project state; show monthly thin-record gaps without scoring | **User roles:** Workstream owner, Project owner, employee, manager-safe team reader | **User goal:** close silent work and documentation gaps with minimal manual effort
**Authoritative sources:** protected rules 14, 23; `PROJECT_REFERENCE.md` §14; T036–T037, T043; P2R-S5 | **Owner module:** `@evaluation/updates-evidence` plus daily-work composition | **Inputs/sources:** confirmed events, responsibilities, approved leave input, evidence/criteria gaps | **AI role:** summarize operational gaps only
**AI prohibitions:** no quotas, readiness score, penalty, ranking, or predicted rating | **Human gate:** owner confirmation | **States/transitions:** not-due/satisfied/required/submitted/missing/exempt | **Public API/events:** daily-work check-in/readiness endpoints; check-in service
**Authorization/privacy:** manager projection omits employee readiness values | **Audit/history:** check-ins and no-change confirmations append | **Failure/recovery:** missing source creates action, not automatic judgment | **Tests:** check-in integration; Slice 5 E2E/acceptance; Fact View neutrality tests
**Status:** COMPLETE | **External gate:** none; CAP-037 provides the completed continuity and approved-leave dependency | **Frontend implications:** surface only actionable gaps and explain why a check-in is required

### CAP-019 — Google Workspace connection and private context

**ID:** CAP-019 | **Capability:** connect Gmail/Calendar read scopes, sync compact private metadata, exclude items, and link/unlink a Project | **User roles:** employee only | **User goal:** see work context privately and connect relevant mail/events to Projects
**Authoritative sources:** AI-first Daily Workspace reset; P2R-S2 | **Owner module:** `@evaluation/connected-work-context` | **Inputs/sources:** Gmail/Calendar title, compact summary, source link, sync time; not bodies/attachments | **AI role:** later linking suggestions only
**AI prohibitions:** no manager access, no destructive Gmail/Calendar action, no email sending/deletion | **Human gate:** OAuth consent, exclusions, manual link | **States/transitions:** disconnected → authorizing → connected/stale/disconnected; item linked/unlinked/excluded | **Public API/events:** connected-work controllers
**Authorization/privacy:** owner-only encrypted context; minimum read scopes | **Audit/history:** connection/sync/link/exclusion state retained without raw mailbox | **Failure/recovery:** callback/state failure returns to reconnect; dedupe preserves items | **Tests:** connected-work integration/unit and Google adapter tests; Slice 2 E2E/acceptance; migration `0018`
**Status:** EXTERNAL_GATE | **External gate:** production Google OAuth approval, administrator consent, redirect config, and credential vault/key provider | **Frontend implications:** clear privacy promise, connection health, reconnect, and manual Project linking

### CAP-020 — Context Intelligence and confirmed Task drafts

**ID:** CAP-020 | **Capability:** explainable Project suggestions from trusted anchors, correction learning, and human-confirmed Task drafts | **User roles:** employee | **User goal:** let the assistant connect work context and prepare useful Tasks without acting silently
**Authoritative sources:** P2R-S3 | **Owner module:** `@evaluation/context-intelligence` | **Inputs/sources:** private connected item, approved Project documents/anchors, correction history | **AI role:** analyze, suggest Project with reasons/confidence, prepare Task draft
**AI prohibitions:** untrusted email text cannot become a confirmed sender-domain anchor; no silent Project link/task creation | **Human gate:** confirm/correct suggestion and confirm Task | **States/transitions:** unanalyzed → suggested/review-required → confirmed/corrected/rejected; draft → confirmed | **Public API/events:** context analysis/task draft controllers
**Authorization/privacy:** employee-only source context; Project readers provide bounded semantic context | **Audit/history:** route trace, source references, corrections, revision origin retained | **Failure/recovery:** low confidence stays review-required; deterministic fallback is explainable | **Tests:** context-intelligence package tests, AI eval, Slice 3 E2E/acceptance; migrations `0019–0021`
**Status:** COMPLETE | **External gate:** real source data depends on CAP-019 | **Frontend implications:** assistant inbox shows reason/confidence and one confirm/correct action

### CAP-021 — GitHub App ingestion and reconciliation

**ID:** CAP-021 | **Capability:** minimum-permission GitHub App binding, signed idempotent webhook ingestion, missed-event reconciliation, and governed source IDs/URLs | **User roles:** administrator/Project owner for setup; employees as source beneficiaries | **User goal:** receive trustworthy Project activity automatically without manual snapshots
**Authoritative sources:** `PROJECT_REFERENCE.md` §16; T038–T040; P2R-S4 | **Owner module:** `@evaluation/github-integration` | **Inputs/sources:** installation, binding/rules, PR/commit/check events | **AI role:** none required for source integrity
**AI prohibitions:** GitHub volume never becomes progress or performance | **Human gate:** installation/binding/rules; document binding approval | **States/transitions:** installed/bound/active/stale/uninstalled; receipt verified/rejected/reconciled | **Public API/events:** GitHub webhook controller and reconciliation services
**Authorization/privacy:** signature and minimum permissions; secrets isolated | **Audit/history:** delivery receipts, original IDs/URLs, cursors and versions retained | **Failure/recovery:** duplicates are idempotent; reconciliation repairs missed events | **Tests:** github integration/schema tests and Slice 4 E2E/acceptance; migration `0022`
**Status:** EXTERNAL_GATE | **External gate:** create/install GitHub App, webhook secret, organization approval, live installation token | **Frontend implications:** setup/health belongs in Connections; employee view should not expose webhook mechanics

### CAP-022 — GitHub suggested evidence and governed progress proposal

**ID:** CAP-022 | **Capability:** convert verified GitHub facts into evidence suggestions and contract-rule progress proposals, never automatic contribution/performance | **User roles:** employee confirms evidence; owner reviews ambiguous progress | **User goal:** benefit from automatic source facts with minimal manual work
**Authoritative sources:** GitHub protected rules; P2R-S4–S5 | **Owner module:** `@evaluation/github-integration` with Updates/Evidence and Projects public interfaces | **Inputs/sources:** verified GitHub event and approved binding/rule | **AI role:** optional description/link assistance
**AI prohibitions:** commit/PR/check counts are not metrics; no automatic contribution confirmation | **Human gate:** employee evidence confirmation; measurable rule or owner confirmation for progress | **States/transitions:** source event → suggestion/proposal → confirmed/rejected/reassigned | **Public API/events:** evidence suggestion service; governed source reader; progress condition matcher
**Authorization/privacy:** Project and contributor scope | **Audit/history:** source event, rule version, employee decision and snapshot references retained | **Failure/recovery:** ambiguous/unmapped activity stays in review; duplicate sources dedupe | **Tests:** evidence suggestion/reconciliation/progress matcher tests; Slice 4/5 E2E
**Status:** COMPLETE | **External gate:** live inputs depend on CAP-021 | **Frontend implications:** show as suggested evidence, not “AI verified performance”

### CAP-023 — Manager operational queues

**ID:** CAP-023 | **Capability:** actionable manager queues for blocked work, check-ins, Project gaps, and owner confirmations without employee scoring | **User roles:** manager; contributor actions only when separately authorized | **User goal:** intervene on operational work instead of reading oversized metric cards
**Authoritative sources:** approved Manager view correction; P2R-S5 | **Owner module:** daily-work composition over public domain readers | **Inputs/sources:** Projects, progress, check-ins, readiness-safe states, responsibility | **AI role:** may summarize queue reason, never judge employee
**AI prohibitions:** no readiness percentage, rank, productivity/completion leaderboard, or predicted rating | **Human gate:** manager action/owner confirmation | **States/transitions:** open action → resolved/deferred | **Public API/events:** `GET /api/v1/daily-work/manager/operations`
**Authorization/privacy:** manager-safe projections; quick-add hidden unless contributor | **Audit/history:** actions resolve through owning domains | **Failure/recovery:** unavailable sources degrade to explicit gaps | **Tests:** Slice 5 E2E/acceptance and manager privacy assertions
**Status:** COMPLETE | **External gate:** none | **Frontend implications:** compact action queues; readiness and evaluation remain separate journeys

### CAP-024 — Neutral Evaluation Fact View

**ID:** CAP-024 | **Capability:** compose source-supported Project contribution facts, criteria versions, responsibility windows, check-ins, evidence, source coverage, and separately labelled employee interpretation | **User roles:** employee self-assessment reader; authorized manager evaluation reader | **User goal:** review trustworthy facts before writing a human assessment
**Authoritative sources:** protected Fact View rules; T047, T054; P2R-S6 | **Owner module:** `@evaluation/evaluation-preparation` with public readers | **Inputs/sources:** Projects, criteria, Updates/Evidence, documents, responsibility, cycle/employee scope | **AI role:** normalization/summarization only under neutral schema
**AI prohibitions:** no rating/recommendation/rank/productivity/readiness value or automatic Project average | **Human gate:** employee interpretation stays editable and separate; assessment comes later | **States/transitions:** read-only composition at request time | **Public API/events:** `GET /api/v1/evaluation-cycles/:cycleId/employees/:employeeId/facts`
**Authorization/privacy:** self or authorized manager; manager never receives protected readiness values | **Audit/history:** facts retain source IDs, timestamps, criterion/responsibility versions | **Failure/recovery:** missing sources become coverage notes, not invented facts | **Tests:** evaluation-preparation unit/integration, neutrality AI eval, Slice 6 E2E/acceptance
**Status:** COMPLETE | **External gate:** immutable cycle snapshot resolver is part of CAP-028 | **Frontend implications:** source facts visually precede and differ from interpretation; no score-like visualization

### CAP-025 — Research question and technical exploration workspace

**ID:** CAP-025 | **Capability:** versioned research questions, assumptions, constraints, sources, synthesis, collaborators, and decision relevance | **User roles:** employee/research contributor; authorized owner/manager reader | **User goal:** turn ambiguous work into a traceable research problem and durable learning
**Authoritative sources:** `PROJECT_REFERENCE.md` §§13, 15, 25, 35; rubric ARL-01/02; approved engine-first decision | **Owner module:** bounded `@evaluation/research-experiments`; existing Projects, Work Items, Documents, Connected Work Context, Updates & Evidence, and AI Router remain source owners | **Inputs/sources:** version-pinned authorized Project context, documents, Tasks, explicit links, papers/repos/notes/evidence | **AI role:** citation-bound source relevance review, draft framing, source synthesis, and explicit uncertainty only through AI Router
**AI prohibitions:** source volume is not quality or performance; no rating | **Human gate:** employee confirms source disposition, framing, synthesis, and decision | **States/transitions:** draft → active → concluded/cancelled/superseded with append-only revisions and optimistic version checks | **Public API/events:** protected `/api/v1/research`, `/api/v1/research/source-reviews`, revision/source/participant/transition/frame/synthesis/conclusion routes; source-labelled Timeline reader | **Authorization/privacy:** Project scope; owner-only private drafts/source reviews; unrelated employee, manager, and System Administrator denied | **Audit/history:** transactional audit plus append-only participant, transition, source, revision, and conclusion history | **Failure/recovery:** stale-version conflict, AI-unavailable manual path, blocked/partial/stale retrieval, idempotent command replay | **Tests:** contract/unit, real-DB integration, source-security, AI eval, API authorization, Timeline/readiness/Fact View, real production API+PostgreSQL lifecycle, and deterministic fixture-backed Playwright UI acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** live private/licensed source access still requires an approved connector and credentials | **Frontend implications:** current compact bilingual route proves link review and proposal confirmation only; complete lifecycle UI remains part of the later frontend program

### CAP-026 — Experiment and evaluation lifecycle

**ID:** CAP-026 | **Capability:** hypothesis, baseline, measures, test cases, controls, conditions, models/versions, results, limitations, reproducibility, and conclusion | **User roles:** employee/experiment contributors; authorized readers | **User goal:** run a fair reproducible experiment that supports a decision, including a useful failed result
**Authoritative sources:** rubric ARL-03; `PROJECT_REFERENCE.md` §§13, 15, 25; approved engine-first decision | **Owner module:** `@evaluation/research-experiments`; Documents and Updates & Evidence remain artifact/evidence owners | **Inputs/sources:** Research question, pinned baseline, measures, cases, controls, environments, models, code, benchmarks, runs, observations, and artifacts | **AI role:** owner-only method review and run interpretation drafts through versioned AI Router contracts
**AI prohibitions:** experiment count is not score; AI cannot confirm conclusion as fact | **Human gate:** employee confirms method, run record, conclusion, and decision | **States/transitions:** draft → ready → running → result recorded → concluded/abandoned/superseded; failed/invalid/stopped runs remain visible | **Public API/events:** protected `/api/v1/research/:id/experiments` and `/api/v1/experiments/:id` method-review/revision/transition/run/interpretation/conclusion routes | **Authorization/privacy:** Project and optional Workstream/Work Item scope; owner-only AI drafts; upload/model/data policies stay in source owners | **Audit/history:** immutable method revisions, runs, observations, conclusions, and append-only audit-backed transition history | **Failure/recovery:** stale versions fail without overwriting history; incomplete or failed runs remain queryable | **Tests:** domain invariants, real-DB service/query tests, API authorization, AI eval, real production API+PostgreSQL failed-and-supported Experiment journey, and fixture-backed browser UI
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** dataset/model access may be experiment-specific | **Frontend implications:** current technical surface progressively discloses experiment records; the final frontend must add the dedicated everyday lifecycle interaction

### CAP-027 — Applied learning and research-to-decision trace

**ID:** CAP-027 | **Capability:** connect research/experiment conclusion to decision, next experiment, implementation change, knowledge transfer, and evidence | **User roles:** employee/contributor; owner/manager readers | **User goal:** show how learning changed real work rather than logging reading volume
**Authoritative sources:** rubric ARL-04; `PROJECT_REFERENCE.md` §§25, 35 | **Owner module:** `@evaluation/research-experiments` using public Evidence, Work Item, Document, Timeline, readiness, and Evaluation Fact View interfaces | **Inputs/sources:** human Research/Experiment conclusion, confirmed Evidence revision, and a real target Task/Document Version/Research/Experiment | **AI role:** may draft traceable proposals; cannot declare application
**AI prohibitions:** unapplied learning cannot be inferred as applied; no performance judgment | **Human gate:** employee confirms Research decision, Evidence link, Applied Learning target, and official Task creation | **States/transitions:** private proposal draft → confirmed/rejected; confirmed links are append-only | **Public API/events:** protected Research conclusion, evidence-link, applied-learning, and proposal-confirmation routes; Timeline/readiness/Fact View projections | **Authorization/privacy:** same-Project target and exact owner-domain authorization required, including owner-only DRAFT and narrower Workstream/Work Item scope; private proposal contents stay owner-only | **Audit/history:** transactionally linked human confirmation, source IDs, versions, target identity, and audit event | **Failure/recovery:** unresolved links remain neutral readiness gaps; replay is idempotent and stale/cross-Project writes fail closed | **Tests:** real-DB decision/evidence/learning/proposal tests, real production API+PostgreSQL lifecycle, API and negative-role tests, Timeline/readiness/Fact View composition, and deterministic fixture UI acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** none | **Frontend implications:** Fact View currently proves the neutral output; the final frontend still needs the lightweight “what changed because of this?” action

### CAP-028 — Evaluation templates, eligibility, and immutable cycle snapshot

**ID:** CAP-028 | **Capability:** versioned template/rubric, Calibration Cycle 1, eligibility snapshot, participant scope, frozen visibility mode, and immutable evaluation snapshot | **User roles:** manager/config administrator; employees as participants | **User goal:** open a fair cycle whose rules and participants cannot drift
**Authoritative sources:** protected rules 7, 10–13, 21; `PROJECT_REFERENCE.md` §§17–20; T010, T014, T045–T046 | **Owner module:** `@evaluation/employee-evaluation` with protected NestJS composition | **Inputs/sources:** approved rubric, cadence, participants, leave, visibility mode | **AI role:** none for activation/snapshot
**AI prohibitions:** cannot change templates, eligibility, or visibility | **Human gate:** authorized cycle creation/activation | **States/transitions:** template draft/active/retired; cycle open preparation → self → manager → comparison → finalization → acknowledgment → closed; snapshot immutable | **Public API/events:** protected `/api/v1/employee-evaluation/templates/*` and `/cycles/*` routes | **Authorization/privacy:** Identified pilot mode frozen per cycle; role and department scope reloaded server-side | **Audit/history:** activation, opening, eligibility, transitions, and immutable snapshot are transactional and audited | **Failure/recovery:** expected versions and idempotency make retries deterministic | **Tests:** domain, migration, API/PostgreSQL authorization, seed lifecycle, and fixture-backed browser verification
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** Arabic rubric remains T016 gate | **Frontend implications:** cycle setup is administrative; employees see cycle type and rules, not configuration internals

### CAP-029 — Employee self-assessment

**ID:** CAP-029 | **Capability:** employee selects ratings using approved anchors and writes source-supported justification after reviewing Fact View | **User roles:** employee | **User goal:** assess self on the same criteria/anchors used by the manager
**Authoritative sources:** `PROJECT_REFERENCE.md` §§18–21; T048, T052 | **Owner module:** `@evaluation/employee-evaluation` | **Inputs/sources:** immutable cycle snapshot, CAP-024 Fact View, employee interpretation | **AI role:** `evaluation.justification` wording help only after the employee selects a rating
**AI prohibitions:** no suggested/challenged/normalized rating | **Human gate:** employee rating selection and submission | **States/transitions:** not-started → versioned draft → submitted/locked | **Public API/events:** protected assignment draft, submission, and justification routes | **Authorization/privacy:** self-only write/read; manager independence preserved | **Audit/history:** revisions and submission are immutable and audited | **Failure/recovery:** expected versions, strict schemas, and idempotent submit | **Tests:** real-database assessment tests, AI eval, API denials, complete seed, and browser verification
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** Arabic rubric remains T016 gate | **Frontend implications:** facts first, then one criterion at a time; AI helps wording only after choice

### CAP-030 — Independent manager assessment

**ID:** CAP-030 | **Capability:** manager independently rates the same criteria and records human judgment before seeing employee ratings | **User roles:** manager | **User goal:** make a deliberate human evaluation using facts and direct observation
**Authoritative sources:** protected rules 1, 9; `PROJECT_REFERENCE.md` §§20–21; T049 | **Owner module:** `@evaluation/employee-evaluation` | **Inputs/sources:** cycle snapshot, manager-authorized Fact View, direct observation | **AI role:** source organization and post-rating justification drafting only
**AI prohibitions:** no rating recommendation/prediction, no readiness percentage, no automatic average | **Human gate:** assigned manager selects and submits every rating | **States/transitions:** independent versioned draft → submitted/locked → self projection permitted | **Public API/events:** protected manager draft/submission/self-projection routes | **Authorization/privacy:** assignment scope is reloaded; employee self-rating hidden until manager submission | **Audit/history:** immutable submission timestamp and independence proof | **Failure/recovery:** recover draft without revealing self-rating; stale writes fail closed | **Tests:** real-database independence tests, API denials, complete seed, and separately authenticated manager browser verification
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** Arabic rubric remains T016 gate | **Frontend implications:** neutral evidence and anchors; manager remains visibly responsible for the decision

### CAP-031 — Comparison, discussion, finalization, acknowledgment

**ID:** CAP-031 | **Capability:** compare submitted self/manager assessments, support discussion, let manager set final rating, employee acknowledge/reserve, and freeze snapshot | **User roles:** employee and manager | **User goal:** discuss material differences while preserving final human authority and history
**Authoritative sources:** protected rules 7, 9; `PROJECT_REFERENCE.md` §§21–22; T050–T051 | **Owner module:** `@evaluation/employee-evaluation` | **Inputs/sources:** submitted CAP-029/030 assessments and authorized source references | **AI role:** deterministic neutral comparison plus optional justification wording after ratings exist
**AI prohibitions:** no compromise/recommended rating; reservation never changes manager rating | **Human gate:** discussion, manager finalization, employee acknowledgment/reservation | **States/transitions:** compared → versioned discussion → finalized → acknowledged/reserved → closed | **Public API/events:** protected discussion, finalization, acknowledgment, closure, and report routes | **Authorization/privacy:** cycle participants only; assigned human manager owns finalization | **Audit/history:** append-only discussion, final snapshot, acknowledgment/reservation, and closure | **Failure/recovery:** atomic finalization, expected versions, idempotent acknowledgment/closure, immutable closed rows | **Tests:** unit/integration/API/PostgreSQL seed/browser tests including immutability triggers
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** none | **Frontend implications:** explain differences without nudging a midpoint; clear final decision ownership

### CAP-032 — Evaluation and department reports/exports

**ID:** CAP-032 | **Capability:** authorized Arabic/English employee cycle, manager upward, and department exports with immutable source snapshot | **User roles:** employee, manager, administrator according to report | **User goal:** retain and share a trustworthy review record
**Authoritative sources:** `PROJECT_REFERENCE.md` §35; T053 | **Owner module:** immutable projections in `@evaluation/employee-evaluation`; export generation/delivery in E6B | **Inputs/sources:** closed snapshots, sources, visibility mode | **AI role:** none in current projection
**AI prohibitions:** no ranking, inferred rating, readiness value, or private-mode leakage | **Human gate:** authorized request and current-access download | **States/transitions:** requested → queued → generated/failed → downloaded/expired/revoked | **Public API/events:** protected report reads and `/api/v1/operations/exports/*` request/status/download/revoke routes | **Authorization/privacy:** report-specific allowlists, fresh authorization at download, encrypted artifact storage, and Arabic evaluation export blocked until T016 | **Audit/history:** immutable source manifest plus download/revocation audit | **Failure/recovery:** reproducible retry from pinned sources; expired/revoked artifacts fail closed | **Tests:** reporting package integration, export artifact authorization, worker/API tests, and E6B acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** production object storage; Arabic evaluation export additionally requires T016 | **Frontend implications:** explicit report audience, locale, content preview, generation state, and safe download

### CAP-033 — Identified upward manager evaluation

**ID:** CAP-033 | **Capability:** eligible employees submit named ratings/comments about their manager; manager sees identity, status, content, and timestamps in the pilot | **User roles:** employees submit; manager reads; administrator governs | **User goal:** provide accountable upward feedback under the truthful Identified mode
**Authoritative sources:** protected rules 10–13; `PROJECT_REFERENCE.md` §§23–24; T055–T058 | **Owner module:** `@evaluation/manager-evaluation` with protected API composition | **Inputs/sources:** frozen cycle visibility mode and five approved manager criteria | **AI role:** optional source-linked aggregation/themes after submissions
**AI prohibitions:** cannot hide identified originals in pilot, assign manager judgment, or claim anonymity | **Human gate:** employee notice confirmation/submission; manager review | **States/transitions:** eligible/pending/submitted/approved-leave/postponed/excluded; immutable response | **Public API/events:** protected manager-evaluation configuration/cycle/submission/completion/summary routes | **Authorization/privacy:** pilot manager sees authorized individual identified originals; peers/admin/other managers are denied | **Audit/history:** response, identity, status, criteria, comments, and timestamps are retained | **Failure/recovery:** idempotent submit, accurate leave-aware completion, and fail-closed future modes | **Tests:** manager-evaluation package, API/PostgreSQL authorization, AI summary evaluations, and E5A acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** none at engine level | **Frontend implications:** prominently state “Identified”; no anonymity/confidentiality promise

### CAP-034 — Future blinded/anonymous manager-feedback modes

**ID:** CAP-034 | **Capability:** configurable future Manager-Blinded or Anonymous Aggregated modes frozen per cycle | **User roles:** governance administrator and eligible participants | **User goal:** support future deployments without weakening the pilot’s truthful Identified behavior
**Authoritative sources:** protected rules 13, 18; `PROJECT_REFERENCE.md` §24; T059 | **Owner module:** future manager-evaluation/privacy boundary | **Inputs/sources:** cycle visibility snapshot | **AI role:** aggregation only under mode-specific safe projection
**AI prohibitions:** cannot reveal protected identity/original content | **Human gate:** future governance approval and sensitive-access reason | **States/transitions:** configured before cycle; immutable while active | **Public API/events:** none | **Authorization/privacy:** mode-specific isolation not implemented | **Audit/history:** sensitive access audit required | **Failure/recovery:** must fail closed | **Tests:** active Identified contract only
**Status:** DEFERRED_APPROVED | **External gate:** explicit future-mode product/security approval | **Frontend implications:** do not expose mode selector in pilot

### CAP-035 — Coaching insights

**ID:** CAP-035 | **Capability:** transparent non-scoring development insights with observed pattern, sources, time range, confidence, limitations, and missing context | **User roles:** employee; manager for authorized individual/team patterns | **User goal:** improve work habits, research, documentation, and blocker resolution continuously
**Authoritative sources:** `PROJECT_REFERENCE.md` §25; T060 | **Owner module:** `@evaluation/coaching-development` using authorized public fact readers | **Inputs/sources:** confirmed facts and source-qualified longitudinal patterns | **AI role:** draft transparent coaching insights through the AI Router
**AI prohibitions:** no predicted rating, continuous performance/productivity score, rank, or leave penalty | **Human gate:** employee accepts/edits/rejects/defer insight | **States/transitions:** proposed → accepted/rejected/deferred/superseded | **Public API/events:** protected coaching insight and employee decision routes | **Authorization/privacy:** employee-private by default; manager receives only allowed shared projection | **Audit/history:** source/time/model-route trace and decisions retained | **Failure/recovery:** manual creation remains available; low-confidence insight stays explainable and dismissible | **Tests:** coaching-development package/API/AI evaluations and E5B acceptance
**Status:** COMPLETE | **External gate:** approved production AI credentials/routes | **Frontend implications:** optional assistant suggestion beside real work, never a judgment dashboard

### CAP-036 — Personal actions and formal development plans

**ID:** CAP-036 | **Capability:** employee development actions and manager-agreed formal plans linked to coaching and real work | **User roles:** employee and manager | **User goal:** turn a discussion into a manageable improvement action with follow-up
**Authoritative sources:** `PROJECT_REFERENCE.md` §§25–26; T061–T062 | **Owner module:** `@evaluation/coaching-development` | **Inputs/sources:** human discussion, accepted insight, selected objective, confirmed evidence | **AI role:** draft action wording after user intent
**AI prohibitions:** cannot impose plan, discipline, promotion, or rating | **Human gate:** employee acceptance and sharing; manager agreement where formal | **States/transitions:** draft → accepted → active → completed/changed/closed | **Public API/events:** protected personal-action, share, manager-support, and formal-plan routes | **Authorization/privacy:** private action details/rejection reasons stay employee-only; manager sees explicitly shared fields | **Audit/history:** append-only revisions, agreement, evidence, and completion retained | **Failure/recovery:** optimistic transitions, editable draft, explicit withdrawal/change | **Tests:** coaching-development real-DB/API journey and E5B acceptance
**Status:** COMPLETE | **External gate:** none at the engine level | **Frontend implications:** small actionable plan integrated into Today, not a separate bureaucracy

### CAP-037 — Leave, handover, delegation, and return

**ID:** CAP-037 | **Capability:** approved leave excludes obligations; handover, acting ownership, delegation, return handover, and reassignment use time/scope bounds | **User roles:** employee, manager, acting owner, Project/Workstream owners | **User goal:** preserve work continuity and fair responsibility during absence/change
**Authoritative sources:** protected rules 14–17; `PROJECT_REFERENCE.md` §§27–28; T064–T067, T069 | **Owner module:** `@evaluation/continuity` orchestrating public Projects/Auth/eligibility interfaces | **Inputs/sources:** leave period, affected scopes, delegate, handover items | **AI role:** may draft handover completeness only from confirmed work
**AI prohibitions:** cannot approve leave, appoint delegate, reassign Project, or infer negative performance | **Human gate:** manager approvals, employee/delegate confirmations, manager-owned permanent transfer | **States/transitions:** requested/approved/active/cancelled/returned; versioned handover; bounded delegation; reassignment required/resolved | **Public API/events:** protected leave, handover, delegation, return, deactivation, and reassignment routes | **Authorization/privacy:** acting authority is exact-scope, action, and half-open UTC time bounded | **Audit/history:** append-only decisions/transitions and responsibility attribution retained | **Failure/recovery:** gaps block activation; expiry/return ends authority; manager may extend or transfer through Projects | **Tests:** continuity package real-DB tests, API authorization, cross-domain eligibility/check-in seams, and E6A acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** none | **Frontend implications:** calendar-like absence flow plus action queue; never mix leave with performance

### CAP-038 — Deactivation, archival retention, and reassignment safety

**ID:** CAP-038 | **Capability:** block authentication after deactivation while preserving historical foreign keys and flagging active responsibilities for human reassignment | **User roles:** administrator deactivates; manager reassigns | **User goal:** offboard safely without deleting evidence or silently changing ownership
**Authoritative sources:** protected rules 17, 19; `PROJECT_REFERENCE.md` §28; T068–T070 | **Owner module:** `@evaluation/continuity`, auth, Projects, and retention policy | **Inputs/sources:** user active state, memberships, responsibility windows | **AI role:** none
**AI prohibitions:** cannot delete history or decide reassignment | **Human gate:** administrator deactivation; manager reassignment | **States/transitions:** active → deactivated; affected scope → reassignment-required → resolved; archive-only retention | **Public API/events:** protected deactivation and manager reassignment-resolution routes; authentication active-state enforcement | **Authorization/privacy:** historical reads retain original identity under policy | **Audit/history:** deactivation, cases, resolution, and protected historical rows retained | **Failure/recovery:** deactivation and case creation are atomic; login fails closed; only manager-owned Projects command resolves reassignment | **Tests:** auth/continuity/projects integration, protected API authorization, retention and E6A acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** none | **Frontend implications:** separate technical deactivation from manager-owned reassignment queue

### CAP-039 — In-app and email notifications

**ID:** CAP-039 | **Capability:** configurable notifications for check-ins, readiness, document/criteria review, evidence, attribution, evaluations, leave, handover, failures | **User roles:** all according to event | **User goal:** receive timely reminders without constant manual monitoring
**Authoritative sources:** `IMPLEMENTATION_PLAN.md` §11; T071 | **Owner module:** `@evaluation/notifications` consuming versioned source-domain events | **Inputs/sources:** due state and append-only domain events | **AI role:** none in delivery decision
**AI prohibitions:** no scoring/shaming; no sensitive data beyond channel policy | **Human gate:** user channel preference and administrator provider configuration | **States/transitions:** intended → queued → sent/failed/retried/read | **Public API/events:** protected notification list/read/preference routes and notification worker job | **Authorization/privacy:** recipient/channel/template allowlists with bounded deep links | **Audit/history:** dedupe key, attempts, provider-safe receipt, and correlation retained | **Failure/recovery:** versioned schedules, retry/dedupe, reconnect-safe replay, and in-app fallback | **Tests:** notifications package/API/worker tests and E6B acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** production email provider/domain | **Frontend implications:** unified notification center plus direct links to the smallest next action

### CAP-040 — System administration and configurable pilot

**ID:** CAP-040 | **Capability:** manage users/roles, organizations/departments, templates, localization versions, integrations, AI routes, retention, audit, and health | **User roles:** System Administrator, distinct from manager | **User goal:** operate one configurable pilot safely
**Authoritative sources:** protected rule 16; `PROJECT_REFERENCE.md` §§29, 34, 36; T008, T055, T070, T073 | **Owner module:** `@evaluation/administration` composing explicit owner-domain commands | **Inputs/sources:** approved configuration, expected versions, and reasoned overrides | **AI role:** none for authority
**AI prohibitions:** cannot grant roles, change protected policy, or reassign Projects | **Human gate:** administrator actions; Product Owner approval for protected changes | **States/transitions:** explicit capability command → validated owner mutation → receipt; configuration remains versioned where required | **Public API/events:** protected operations administration capabilities/command/health routes plus owner APIs | **Authorization/privacy:** dedicated administrator policies; no generic table editor | **Audit/history:** owner transaction retains actor/reason/version/receipt; System Administrator cannot decide reassignment | **Failure/recovery:** unsupported adapters fail closed; stale versions and owner/audit failures roll back | **Tests:** administration package, operations API composition, owner authorization, health and E6B acceptance
**Status:** COMPLETE — TECHNICAL CHECKPOINT | **External gate:** production identity/integration administrators | **Frontend implications:** separate admin console; never expose it through manager navigation

### CAP-041 — Observability and system health

**ID:** CAP-041 | **Capability:** structured redacted logs, correlation IDs, liveness/readiness checks, queue health, and actionable system status | **User roles:** system operations/administrator | **User goal:** detect and diagnose failures without reading secrets or private content
**Authoritative sources:** `IMPLEMENTATION_PLAN.md` operations sections; T005, T073 | **Owner module:** `@evaluation/observability`, health controllers | **Inputs/sources:** request/job correlation and dependency probes | **AI role:** none
**AI prohibitions:** secrets/tokens/private content never logged | **Human gate:** operational access | **States/transitions:** healthy/degraded/unready | **Public API/events:** `/health/live`, `/health/ready`; structured logs | **Authorization/privacy:** redaction and bounded health detail | **Audit/history:** operational logs, not authoritative product history | **Failure/recovery:** readiness fails closed when required dependency unavailable | **Tests:** observability tests, health readiness and correlation integration
**Status:** COMPLETE (technical engine) | **External gate:** production telemetry/alert destination | **Frontend implications:** admin-only concise status and recovery guidance; no raw logs in normal UI

### CAP-042 — Security/privacy hardening and retention controls

**ID:** CAP-042 | **Capability:** end-to-end security review, upload/prompt defenses, data retention configuration, privacy-mode enforcement, and incident controls | **User roles:** administrator/security; protects all | **User goal:** trust that sources and employee data are isolated and recoverable
**Authoritative sources:** AGENTS.md §§4–5; `PROJECT_REFERENCE.md` §§29–31; T070, T074 | **Owner module:** cross-cutting existing controls plus missing release hardening | **Inputs/sources:** auth, audit, storage, prompts, connectors, retention policy | **AI role:** only inside router with untrusted-input defenses
**AI prohibitions:** no secret/private-mode leakage | **Human gate:** sensitive access and retention policy approval | **States/transitions:** versioned retention policy remains archive-only for protected history; unapproved privacy modes remain disabled | **Public API/events:** cross-cutting | **Authorization/privacy:** protected route matrix, isolation contracts, retention holds and fail-closed future modes | **Audit/history:** protected access and mutations require audit | **Failure/recovery:** incident and revocation procedures are documented and link-verified | **Tests:** security boundary, secret scan, upload, authorization, retention, private-mode and AI-boundary tests
**Status:** COMPLETE (technical engine) | **External gate:** future privacy-mode approval and production secrets/config | **Frontend implications:** privacy explanations and permission errors must reflect actual enforcement

### CAP-043 — Backup and restore

**ID:** CAP-043 | **Capability:** verified backup/restore of database, private objects, configuration, and historical integrity | **User roles:** system operations | **User goal:** recover the pilot without losing or rewriting evidence/evaluations
**Authoritative sources:** T075; migration/retention rules | **Owner module:** bounded backup/restore scripts across PostgreSQL/object storage/config inventories | **Inputs/sources:** database and object snapshots | **AI role:** none
**AI prohibitions:** none applicable | **Human gate:** authorized destructive restore procedure | **States/transitions:** backup created/verified; local isolated restore completed/verified; promotion prohibited | **Public API/events:** none | **Authorization/privacy:** AES-256-GCM bundle, signed/hash-verified secret-free manifest, external key handle | **Audit/history:** drill evidence and recovery point retained | **Failure/recovery:** protected integrity comparison and rollback runbook | **Tests:** manifest, tamper/decryptability, production guard and isolated restore integrity
**Status:** COMPLETE (local-isolated technical drill) | **External gate:** production backup target/credentials/key custody and direct-human restore approval | **Frontend implications:** admin-only status; restore remains protected human operation

### CAP-044 — Pilot dry run and launch readiness

**ID:** CAP-044 | **Capability:** complete representative employee/manager/admin journey, production configuration, security gate, acceptance evidence, and controlled pilot launch | **User roles:** Product Owner, pilot users, operations | **User goal:** start a reliable pilot with known limits and recoverable operations
**Authoritative sources:** T076–T077; engine-first completion program | **Owner module:** program-level | **Inputs/sources:** all COMPLETE capabilities, closed P0/P1 findings, external-gate checklist | **AI role:** assist workflows only within verified rules
**AI prohibitions:** all protected rules remain release blockers | **Human gate:** Product Owner launch acceptance and unavoidable external administrators | **States/transitions:** technical-dry-run-ready → frontend-accepted → pilot-approved → launched/rolled-back | **Public API/events:** system-wide | **Authorization/privacy:** representative employee/manager/admin technical journey verified | **Audit/history:** release evidence and configuration snapshot required | **Failure/recovery:** rollback/restore/support runbooks verified | **Tests:** E6C technical dry run passed; E7 and final product acceptance remain
**Status:** PARTIAL (technical dry run complete; launch not approved) | **External gate:** Google/GitHub/identity/storage/email/backup production setup | **Frontend implications:** final frontend program and user acceptance must finish before launch

## Superseded implementation directions

The following remain historical references only and are not engine requirements:

- the rejected long-form My Work update interaction;
- the original T030–T044 linear execution order;
- a generic activity platform, second persistence store, second authentication system, microservices, or package-per-screen architecture;
- treating any temporary verification screen as the final employee experience.

## E7 conclusion

The full pilot engine is technically complete and `READY_FOR_FINAL_FRONTEND_DESIGN`. E7 reconciled
E3–E6 implementation into 39 `COMPLETE`, 2 approved `PARTIAL`, 2 `EXTERNAL_GATE`, and 1
`DEFERRED_APPROVED` records. No capability remains `PLANNED`. This state authorizes Product Owner
review of the frontend handoff; it does not claim final interface acceptance or production launch.

## E7 verification

- The E6C merged baseline and exact verification counts are recorded in
  `docs/reviews/ENGINE_FINAL_VERIFICATION.md`.
- `pnpm validate:engine-capabilities` verifies all 44 record shapes, allowed final states, and gate
  requirements.
- `pnpm validate:task-graph` still reports 77 authoritative tasks.
- The completion decision, bidirectional trace, and customer journeys are recorded in
  `docs/reviews/ENGINE_COMPLETION_AUDIT.md`, `docs/reviews/ENGINE_BIDIRECTIONAL_TRACE.md`, and
  `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md`.
