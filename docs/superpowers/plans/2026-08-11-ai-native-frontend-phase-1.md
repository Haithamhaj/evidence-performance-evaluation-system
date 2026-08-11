# AI-Native Frontend Phase 1 — Executable Vertical-Slice Plan

> Execute only after Gate G0 is explicitly approved. Use Fast Controlled Execution in the order
> below. Each slice must remain independently reversible and must consume public engine readers and
> protected commands rather than recreating business truth in the browser.

## Global boundaries

- AI prepares, connects, explains, and drafts; it never assigns or recommends a rating, employee
  rank, productivity score, or manager judgment.
- Product telemetry cannot become a Work Signal, project progress input, evidence fact, evaluation
  input, or authority.
- Project progress remains governed only by the approved Progress Contract.
- Google/GitHub/manual sources remain private or suggested until the required user confirmation.
- The browser owns presentation, URL state, local drafts, drawers, and focus return—not domain truth.
- Existing routes remain until the route-retirement ledger records parity, rollback, and approval.
- Arabic/RTL foundations remain active; Arabic employee evaluation stays blocked by T016.

## T087 — Universal Capture with manual recovery

**Visible user outcome:** From any employee screen, Capture opens one compact flow for text, link, or file; a manual private-Inbox fallback remains available when assistance is unavailable.
**Dependencies:** T086
**Handoff IDs:** P1-UNIVERSAL-CAPTURE, P1-TASK-CREATE
**Capability IDs:** CAP-013, CAP-014, CAP-015, CAP-016, CAP-020
**Reader:** `PrivateInboxQueryService.list` through `GET /api/v1/private-inbox`; task context uses `WorkItemQueryService.getAuthorizedWorkItem`.
**Command:** `PrivateInboxService.capture`, `PrivateInboxService.promote`, and `WorkItemService.create` through their existing protected APIs.
**Permission:** Existing `WorkItemsPolicyGuard`; server authorization remains authoritative and Capture visibility never grants command access.
**Assistance mode:** `manual_only` first; optional `on_demand_ai_assistance` only through the existing AI Router and with explicit user confirmation.
**States:** ready, draft, attaching, pending, confirmed, stale, error, manual-recovery.
**Files/modules:** `apps/web/src/product-ui/capture/**`, `apps/web/src/features/capture/**`, `apps/web/src/server/capture/**`, existing workspace proxy allowlist, localization catalogs.
**Focused tests:** capture model/unit tests; authorized and denied private-Inbox proxy tests; keyboard/focus-return story; one English and one Arabic/RTL browser journey.
**Runnable local demo:** Employee opens `/{locale}/my-work`, captures a realistic link/text item, reviews the draft, confirms it, then repeats with assistance disabled and saves manually.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/t087-capture-en-desktop.png`, `t087-capture-ar-mobile.png`, and `t087-capture-recovery.png`.
**Rollback:** Disable the shell Capture entry and retain the existing private Inbox and task routes without deleting captured records.
**Product Owner stop gate:** Review the real capture-to-confirmation journey; stop only for a confirmed P0/P1 journey defect or protected-boundary conflict.

Implementation notes:

1. Start with the manual path and honest recovery.
2. Keep AI-generated structure editable and unpersisted until employee confirmation.
3. Never infer project progress or employee performance from capture volume.

## T088 — Work Signals and Experience Workflow Events runtime

**Visible user outcome:** Confirmed work changes can refresh relevant screens without turning clicks or telemetry into business facts.
**Dependencies:** T087
**Handoff IDs:** P1-TODAY-READ, P1-WHAT-CHANGED
**Capability IDs:** CAP-005, CAP-013, CAP-014, CAP-018, CAP-020
**Reader:** Existing public domain readers remain unchanged; add only the bounded experience-event projection required by `P1-WHAT-CHANGED`.
**Command:** NONE — this slice transports already-authorized domain receipts and does not introduce a browser business command.
**Permission:** Existing target authorizer and owning domain policies determine recipients; telemetry imports are prohibited by the frontend boundary validator.
**Assistance mode:** `deterministic_assistance` and `contextual_status_recovery`; no Agent decision is introduced.
**States:** queued, delivered, acknowledged, replayed, stale, unauthorized, error.
**Files/modules:** `packages/contracts/src/work-signals/**`, `packages/contracts/src/experience-events/**`, `apps/api/src/operations/**`, `apps/worker/src/**`, boundary fixtures and event taxonomy docs.
**Focused tests:** schema/version tests; idempotent receipt tests; wrong-user and telemetry-import rejection tests; replay/reconnect unit tests.
**Runnable local demo:** Confirm one manual capture and show one authorized deterministic refresh receipt while an unrelated user receives nothing.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/t088-authorized-refresh.png` and `t088-recovery-state.png`.
**Rollback:** Disable experience-event publication and return to explicit page refresh; authoritative domain rows and receipts remain intact.
**Product Owner stop gate:** Review the visible refresh/recovery wording and verify that it presents operational change, not performance scoring or hidden automation.

Implementation notes:

1. Keep Work Signals, Experience Events, and Product Telemetry as three schemas and import zones.
2. Persist idempotency and delivery state without creating a second domain store.

## T089 — Minimal Experience Orchestrator above the AI Router

**Visible user outcome:** The assistant prepares at most one source-backed next action or question, explains why it appeared, and waits for the user.
**Dependencies:** T088
**Handoff IDs:** P1-PREPARED-DECISION, P1-TODAY-READ
**Capability IDs:** CAP-013, CAP-014, CAP-018, CAP-019, CAP-020
**Reader:** `ContextIntelligenceWorkflow.reviewQueue` and `DailyWorkQueryService.dailyWorkspace` through their approved public readers.
**Command:** NONE — the orchestrator prepares a proposal; confirmation still calls the owning protected command in T090.
**Permission:** Existing Context Intelligence and Daily Work policies filter inputs before orchestration; the orchestrator cannot broaden access.
**Assistance mode:** `proactive_agent_assistance` with deterministic fallback and existing AI Router route traces.
**States:** idle, preparing, prepared, needs-clarification, unavailable, stale, rejected, error.
**Files/modules:** `apps/api/src/experience-orchestration/**`, `packages/contracts/src/experience-orchestration/**`, existing `packages/ai-routing` public interface, worker job registration.
**Focused tests:** one-proposal limit; source/why/freshness/consequence contract; no-rating/no-readiness tests; wrong-user source isolation; AI Router fallback.
**Runnable local demo:** A confirmed Project context produces one editable prepared action; disabling the model shows the same task safely without a fake Agent result.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/t089-prepared-action.png` and `t089-deterministic-fallback.png`.
**Rollback:** Disable orchestrator scheduling and keep manual Capture, Today reads, and owning review queues available.
**Product Owner stop gate:** Review whether the single question/action is understandable, useful, and non-intrusive before Today composition consumes it.

Implementation notes:

1. The orchestrator sits above, and never replaces, the existing AI Router or domain commands.
2. Persist only versioned structured output with source references and safe recovery.

## T090 — Intelligent Today and one confirmed decision path

**Visible user outcome:** Today opens with Needs Your Action, Today, Overdue, one prepared item, and one confirm/correct/dismiss decision path backed by real sources.
**Dependencies:** T089
**Handoff IDs:** P1-TODAY-READ, P1-PREPARED-DECISION
**Capability IDs:** CAP-013, CAP-014, CAP-018, CAP-019, CAP-020
**Reader:** `DailyWorkQueryService.dailyWorkspace` and `ContextIntelligenceWorkflow.reviewQueue` through the existing authenticated server readers.
**Command:** `ContextIntelligenceWorkflow.confirmProjectSuggestion` and `correctProjectSuggestion`; dismissal preserves the candidate without creating evidence or progress.
**Permission:** Existing `ContextIntelligencePolicyGuard`; negative authorization tests remain server-side and UI hiding is not authorization.
**Assistance mode:** `deterministic_assistance` for grouping plus `proactive_agent_assistance` for one prepared item.
**States:** loading, ready, empty, pending-decision, confirming, confirmed, corrected, dismissed, stale, error.
**Files/modules:** `apps/web/src/product-ui/today/**`, `apps/web/src/features/today/**`, `apps/web/src/features/prepared-decision/**`, `apps/web/src/server/today/**`, localization catalogs.
**Focused tests:** Today composition model; confirm/correct/dismiss protected proxy tests; stale recovery; Storybook axe/focus; employee desktop and 390px RTL journeys.
**Runnable local demo:** Employee reviews source/why/freshness/consequence, confirms a Project link, sees a durable receipt, and retries one injected stale response.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/t090-today-en-desktop.png`, `t090-today-ar-mobile.png`, and `t090-stale-recovery.png`.
**Rollback:** Feature-flag Intelligent Today off and render the existing My Work snapshot and owning context-review route.
**Product Owner stop gate:** Review the complete daily employee journey; do not continue if the assistant increases work, obscures source truth, or violates a protected rule.

## T091 — What Changed and durable SSE recovery

**Visible user outcome:** The employee sees concise, authorized change receipts and reconnects without duplicate actions or lost context.
**Dependencies:** T090
**Handoff IDs:** P1-WHAT-CHANGED, P1-SESSION-RECOVERY
**Capability IDs:** CAP-001, CAP-002, CAP-005, CAP-014
**Reader:** Add the bounded public operation-receipt composition reader required by `P1-WHAT-CHANGED`; retain `MeController.me` for session recovery.
**Command:** NONE — What Changed is a read-only projection; retry and reconnect only resume delivery.
**Permission:** Recipient filtering uses the existing target authorizer; `/api/v1/me` and protected source readers remain authoritative.
**Assistance mode:** `deterministic_assistance` and `contextual_status_recovery` only.
**States:** connecting, ready, empty, reconnecting, replaying, stale, unauthorized, error.
**Files/modules:** `apps/api/src/experience-stream/**`, `apps/web/src/server/experience-stream/**`, `apps/web/src/product-ui/what-changed/**`, event cursor contracts and proxy allowlist.
**Focused tests:** ordered replay, idempotent cursor, wrong-user exclusion, reconnect, expired session, reduced-motion disclosure, browser offline/online recovery.
**Runnable local demo:** Confirm the T090 decision, disconnect the stream, reconnect, and show one receipt exactly once with a safe link to its owning source.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/t091-what-changed.png` and `t091-reconnecting.png`.
**Rollback:** Disable SSE and keep explicit refresh plus owning-route receipts; never delete delivery history.
**Product Owner stop gate:** Review receipt clarity and recovery; stop for duplicate actions, source leakage, or an unrecoverable session.

## T092 — Work List and Task Detail parity migration

**Visible user outcome:** Employees manage normal tasks through a compact Work list and focused detail drawer without losing existing create/transition behavior.
**Dependencies:** T091
**Handoff IDs:** P1-TASK-CREATE, P1-TASK-TRANSITION
**Capability IDs:** CAP-013, CAP-014, CAP-020
**Reader:** `WorkItemQueryService.getAuthorizedWorkItem` plus the existing authorized task workspace list reader.
**Command:** `WorkItemService.create` and `WorkItemService.transition`; assignment/update remain on their existing protected APIs and are not widened.
**Permission:** Existing `WorkItemsPolicyGuard`; Project/Workstream ownership and manager role do not imply unauthorized task mutation.
**Assistance mode:** `manual_only`, with optional `on_demand_ai_assistance` limited to editable task drafting.
**States:** loading, list-ready, detail-open, draft, saving, transitioning, stale, forbidden, error.
**Files/modules:** `apps/web/src/product-ui/work/**`, `apps/web/src/features/work-list/**`, `apps/web/src/features/task-detail/**`, existing `/[locale]/tasks` and `/my-work` parity adapters.
**Focused tests:** list/detail model; create/transition allow-and-deny tests; URL-owned selection; drawer focus return; board/calendar links remain available; RTL/mobile browser journey.
**Runnable local demo:** Create one Project-linked task, open it in the detail drawer, transition it, refresh, and verify the authoritative state and history.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/t092-work-list.png`, `t092-task-detail.png`, and `t092-ar-mobile.png`.
**Rollback:** Restore links to the retained Tasks/My Work routes; keep all Work Item records and append-only history.
**Product Owner stop gate:** Compare new and retained routes for behavior parity before any retirement disposition changes.

## T093 — Real GitHub, Google, and manual source-to-command journey

**Visible user outcome:** The employee reviews suggested Gmail/Calendar/GitHub context beside manual evidence, confirms or corrects the Project link, and explicitly confirms evidence before contribution use.
**Dependencies:** T092
**Handoff IDs:** P1-CONNECTED-CONTEXT, P1-GITHUB-EVIDENCE, P1-UNIVERSAL-CAPTURE
**Capability IDs:** CAP-014, CAP-015, CAP-016, CAP-019, CAP-020, CAP-021, CAP-022
**Reader:** `ConnectedWorkContextQueryService.review`, `ActivityReader.evidenceReview`, and `PrivateInboxQueryService.list` through owner-scoped readers.
**Command:** `ConnectedWorkConnectionService.linkProject`/`unlinkProject`, `EvidenceService.createFromGitHubSuggestion`/`confirm`/`reject`, and `PrivateInboxService.capture`.
**Permission:** Existing owner-only connected-context, Work Items, and Evidence policy guards; managers cannot browse private Gmail/Calendar context.
**Assistance mode:** `proactive_agent_assistance` for suggestions, `on_demand_ai_assistance` for editable descriptions, and `manual_only` fallback.
**States:** disconnected, syncing, suggested, uncertain, reviewing, corrected, confirmed, rejected, stale, error.
**Files/modules:** `apps/web/src/features/source-review/**`, `apps/web/src/server/connected-sources/**`, Today/Project source panels, existing Google/GitHub adapters and protected proxies.
**Focused tests:** owner-only source visibility; high/uncertain confidence review; evidence confirmation; no automatic contribution; connector unavailable/manual fallback; E2E with deterministic source fixtures.
**Runnable local demo:** Review one Gmail/Calendar suggestion, one GitHub PR suggestion, and one manual snapshot; correct one Project, reject one source, confirm one evidence item, and show the receipt.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/t093-source-review.png`, `t093-evidence-confirmation.png`, and `t093-private-context-denied.png`.
**Rollback:** Disable connector suggestions independently, retain manual Capture and existing source review routes, and preserve confirmed evidence/history.
**Product Owner stop gate:** Review the 360-degree source journey and privacy language; stop for automatic evidence/contribution, manager leakage, or unclear confirmation ownership.

## T094 — Phase 1 acceptance, rollback, and route-retirement decision

**Visible user outcome:** Product Owner can run the complete employee daily journey and manager-safe shell, inspect evidence, and decide whether Phase 1 routes are ready for controlled replacement.
**Dependencies:** T087, T088, T089, T090, T091, T092, T093
**Handoff IDs:** P1-SESSION-RECOVERY, P1-TODAY-READ, P1-PREPARED-DECISION, P1-WHAT-CHANGED, P1-UNIVERSAL-CAPTURE, P1-TASK-CREATE, P1-TASK-TRANSITION, P1-CONNECTED-CONTEXT, P1-GITHUB-EVIDENCE
**Capability IDs:** CAP-001, CAP-002, CAP-005, CAP-013, CAP-014, CAP-015, CAP-016, CAP-018, CAP-019, CAP-020, CAP-021, CAP-022
**Reader:** All approved Phase 1 readers above; the acceptance report records exact versions and source receipts.
**Command:** Only the owning protected commands exercised in T087, T090, T092, and T093; no acceptance-only bypass command.
**Permission:** Full positive/negative authorization matrix for employee, manager, administrator, Project owner, and unrelated user.
**Assistance mode:** All approved Phase 1 assistance modes, each labeled truthfully with deterministic/manual fallback.
**States:** complete journey plus loading, empty, stale, offline, provider-unavailable, forbidden, expired-session, and rollback.
**Files/modules:** `tests/e2e/ai-native-phase-1/**`, route retirement ledger/evidence, acceptance docs, screenshots, `TASKS.md`, and `project-state`.
**Focused tests:** related unit/integration/browser suites per slice, one affected full web suite, boundary/telemetry validators, route ledger, task graph, secrets, lint, typecheck, build.
**Runnable local demo:** Capture → prepared decision → Today → What Changed → task detail → Google/GitHub/manual source review → evidence confirmation → manager-safe shell → rollback.
**Screenshots:** `docs/product/screenshots/ai-native-phase-1/` desktop/mobile English/Arabic evidence set plus before/after route-parity captures.
**Rollback:** Disable Phase 1 entries and streaming, restore retained routes, and preserve every authoritative record, receipt, cursor, confirmation, and history row.
**Product Owner stop gate:** Stop for explicit Product Owner acceptance of the running journey, route-retirement dispositions, and next-phase scope; do not merge or retire routes before that decision.
