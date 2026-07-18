# Open-Source Reuse Assessment

**Status:** Research only — no production code copied or changed
**Assessment date:** 2026-07-18
**Research owner:** Codex primary agent (single owner; no subagent review loop)
**Reference workspace:** `/Users/haitham/development/evaluation-system-reference-lab`
**Decision companion:** [`OPEN_SOURCE_REUSE_DECISION.md`](./OPEN_SOURCE_REUSE_DECISION.md)

## 1. Executive finding

None of the six applications is a safe or economical base for the approved Product Direction Reset.

- Plane is the strongest product reference for project-scoped work items, intake, multiple views, side peek, activity, attachments, and GitHub integration, but its source is AGPL-3.0.
- Super Productivity is the only broadly permissive source reviewed (MIT). It is the strongest reference for a personal “My Work” home, planning, schedule, responsive behavior, and reduced-motion touch interactions. Its Angular/local-first architecture and personal task model are not compatible enough with the current React/Next.js product and Phase 1 backend to justify adopting the application or copying its UI components.
- Twenty is a useful secondary reference for a record side panel, activity timeline, tasks, attachments, and Arabic localization, but its codebase combines AGPL and restricted enterprise source.
- Vikunja is a useful secondary reference for task details, List/Board/Table/Gantt switching, responsive behavior, and explicit Arabic RTL handling, but its source is AGPL-3.0-or-later.
- Huly is feature-rich but EPL-2.0, operationally heavy, and structurally much more complex than the current modular monolith.
- Focalboard is explicitly unmaintained. Its useful UI source is generally AGPL or commercial, not MIT.

The bounded recommendation is **interaction patterns only**, implemented clean-room in the existing product. Three small MIT TypeScript utilities from Super Productivity are legally eligible for adaptation, but none is needed for the first reset prototype and none should be copied without a separate, file-specific decision.

## 2. Scope, method, and evidence quality

### 2.1 What was inspected

The official repositories were shallow-cloned with blob filtering and no working-tree checkout. The assessment inspected:

- repository metadata and current release metadata through the official GitHub API;
- license files;
- package manifests and dependency files;
- deployment configuration;
- data models;
- authentication paths;
- key task, inbox, view, detail, activity, attachment, localization, and integration paths.

No dependency installation, build, migration, seed, server, or repository script was executed. No code, branding, image, logo, screenshot, or proprietary asset was copied into this repository.

### 2.2 Pinned source revisions

| Repository | Inspected revision | Latest inspected release | Maintenance signal |
|---|---|---:|---|
| [makeplane/plane](https://github.com/makeplane/plane) | `7cef741c29cf61d3bca18dc892e6af11a1e7becc` (2026-07-17) | `v1.3.1` (2026-05-14) | Active; commit one day before assessment |
| [twentyhq/twenty](https://github.com/twentyhq/twenty) | `dcd6683cac80aa3d0c9ec199372cacc8020b5e64` (2026-07-17) | `twenty/v2.22.0` (2026-07-17) | Active; same-day release |
| [super-productivity/super-productivity](https://github.com/super-productivity/super-productivity) | `014b789c22c9bf75fd7202845639569b61e7cd8e` (2026-07-17) | `v18.15.1` (2026-07-17) | Active; same-day release |
| [hcengineering/platform](https://github.com/hcengineering/platform) | `4c5d2d578e3aceb380db511e4b73848af4f14937` (2026-07-17) | `v0.7.426` (2026-07-05) | Active source; hosted Huly shutdown announced for 2026-07-20, self-host unaffected |
| [mattermost-community/focalboard](https://github.com/mattermost-community/focalboard) | `a84bbb65e32edf972856b329417096ac413518e9` (2025-06-11) | `v8.0.0` (2024-06-13) | README explicitly says “currently not maintained” |
| [go-vikunja/vikunja](https://github.com/go-vikunja/vikunja) | `5a4dae6df25391bb0fb3805f094cf057267b5045` (2026-07-18) | `v2.3.0` (2026-04-09) | Active; commit on assessment date |

No seventh candidate was added because none found during the focused review had a material advantage over Plane for interaction design or Super Productivity for permissive source.

### 2.3 Confidence and limitations

- **High confidence:** licenses, source paths, current manifests, repository activity, core frameworks, storage/queue choices, and explicit localization files.
- **Medium confidence:** complete UX coverage, responsive quality, and accessibility. The applications were inspected statically, not built or operated.
- **Low-to-medium confidence:** absence of a feature when no direct path or official statement was found. “Not found” means not evidenced in the inspected revision, not a proof that no edition or plugin provides it.
- Cost estimates are directional, assume one experienced engineer, and have approximately ±35% uncertainty. They exclude legal procurement, enterprise subscriptions, and product-owner validation time.

## 3. License compatibility is a blocking screen

This is an engineering compatibility assessment, not legal advice.

| Repository | License finding | Commercial/private-product compatibility | Reuse decision |
|---|---|---|---|
| Plane | AGPL-3.0 in `LICENSE.txt` | Commercial use is possible under AGPL obligations, but importing covered source into a closed/private network product is incompatible with the approved constraint | Do not copy source; patterns only |
| Twenty | Most source AGPL-3.0; files marked `/* @license Enterprise */` use restrictive commercial terms. The enterprise terms prohibit copying, merging, publishing, distributing, sublicensing, or selling except as expressly allowed | Not compatible for source import without a separately negotiated commercial arrangement and file-by-file review | Do not copy source; patterns only |
| Super Productivity | MIT; copyright and license notice must accompany copies or substantial portions | Compatible with commercial and private products when notice obligations are preserved | Small, file-specific adaptation is legally eligible |
| Huly Platform | EPL-2.0 | Commercial use can be possible under EPL terms, but the approved constraint explicitly forbids importing EPL code without approval | Do not copy source; patterns only |
| Focalboard | Source is generally AGPL-3.0 or commercial. Only enumerated admin/config paths such as `webapp/i18n/`, `server/model/`, and `plugin/` are Apache-2.0. Compiled Mattermost builds being MIT does not relicense the source UI | Useful UI paths remain blocked; the Apache paths are not a useful React UI base | Do not copy UI source; patterns only |
| Vikunja | Most repository source AGPL-3.0-or-later; `desktop/` GPL-3.0-or-later; some background assets have Unsplash obligations | Not compatible for source import under the approved constraint | Do not copy source or assets; patterns only |

**Blocking rule:** no AGPL, EPL, enterprise, fair-code, or source-available code may be imported into this repository without explicit approval. Reimplementing an observed interaction with original code and no copied expressive assets is permitted as a clean-room design reference.

## 4. Comparative architecture and product capabilities

### 4.1 Technical architecture

| Candidate | Frontend | Backend | Database, queue, and files | Authentication |
|---|---|---|---|---|
| Plane | React, React Router framework, Vite, MobX, TanStack Table | Python, Django 4.2, Django REST Framework | PostgreSQL; Redis cache; Celery with RabbitMQ/AMQP; S3/MinIO attachments | Django sessions; email/password and magic code; Google, GitHub, GitLab, and Gitea OAuth paths |
| Twenty | React 19, Jotai, Linaria, Lingui | NestJS 11, GraphQL, TypeORM | PostgreSQL; Redis; BullMQ; S3-compatible object storage | JWT/Passport; Google and Microsoft; OIDC and SAML code paths, with some capabilities edition-gated |
| Super Productivity | Angular 21, NgRx, Angular Material; Electron, Capacitor, PWA | Local-first client; optional Fastify SuperSync service | Browser/local app storage; optional PostgreSQL through Prisma; no core queue | No login for local use; optional SuperSync email/password, JWT, and passkeys |
| Huly Platform | Svelte 4 and a large internal UI/plugin platform | Multi-service TypeScript/Node transaction, account, workspace, collaboration, search, and supporting services | Current self-host stack: CockroachDB, Redpanda, Elasticsearch, MinIO; optional Redis/HulyPulse modes | Dedicated account service with JWT and workspace membership |
| Focalboard | React 17, Redux Toolkit, FullCalendar, react-beautiful-dnd | Go standalone server | SQLite by default; PostgreSQL/MySQL supported; WebSocket; no dedicated queue | Native standalone authentication; Mattermost authentication belongs to a separate plugin context |
| Vikunja | Vue 3, Pinia, Vite, vue-i18n, Tiptap | Go, Echo | SQLite/MySQL/PostgreSQL; Redis; Watermill event layer; S3-compatible files | Local JWT, OIDC/OAuth, LDAP, TOTP, API tokens, and link shares |

### 4.2 Work management and user experience

Legend: **Strong** = directly useful reference; **Partial** = related but materially different; **Absent** = not evidenced; **Risk** = behavior conflicts with the target.

| Candidate | Task / Work Item model | My Work | Inbox | Views | Side panel / detail | Project / Workstream equivalent | Activity, attachments, evidence |
|---|---|---|---|---|---|---|---|
| Plane | Strong project-scoped work item with states, labels, assignees, cycles, modules, relations | Strong assigned-work and profile patterns, but not necessarily our exact employee default | Strong project intake/inbox | List, Kanban, Calendar, Gantt/timeline-style layout | Strong side peek and full detail | Project is strong; Module is only a loose workstream analogy | Strong activity, comments, attachments; not our confirmed-evidence model |
| Twenty | Generic CRM object records plus activities and tasks | Partial task/activity home, CRM-centered | Strong email inbox, not work-item intake | Table, Kanban, Calendar; no confirmed work-item Gantt | Strong record side panel | Custom objects can model structures, but no native required Project + optional Workstream rule | Excellent record timeline, tasks, notes, emails, calendar events, and files; attribution semantics differ |
| Super Productivity | Personal task with subtasks, projects, tags, issue-provider links, time estimates | Strongest personal “today/planner” reference | Partial quick capture/backlog, not governed triage | Task list, board, planner/schedule; no true work-item timeline | Strong detail panel, but deeply coupled to Angular/NgRx | Project/tag model; tasks can exist without a project, conflicting with required Project | Files, notes, bookmarks, work logs; personal rather than organizational evidence confirmation |
| Huly Platform | Rich tracker issue model with projects, milestones, components, relations | Strong `MyIssues` reference | Strong cross-module inbox/notifications | List and Kanban; separate calendar; no inspected tracker Gantt | Rich edit/detail surfaces | Project and component/milestone analogies, not exact workstreams | Strong activity, collaboration, comments, and attachment plugins |
| Focalboard | Generic blocks, boards, cards, properties | Partial personal/team board home | Absent | Board, table, calendar, gallery; no timeline | Card detail modal/page | Board and card hierarchy only | Comments and attachments; no governed contribution/evidence layer |
| Vikunja | Rich task in a project with subtasks, relations, assignees, comments, attachments | Partial home/upcoming/favorites | Partial quick-add and notifications, not governed intake | List, Kanban, Table, Gantt; calendar feeds/global calendar rather than project view | Rich full task-detail route, not a React side panel | Hierarchical projects help navigation, but no target workstream semantics | Strong comments, attachments, history, reactions, and webhooks; not confirmed evidence |

### 4.3 Integrations, localization, mobile, accessibility, and AI

| Candidate | GitHub | Arabic / localization / RTL | Mobile and responsive quality | Accessibility evidence | AI-related capabilities |
|---|---|---|---|---|---|
| Plane | Native GitHub integration and issue sync; useful pattern but can become authoritative sync rather than “suggested evidence only” | Broad i18n package, but no Arabic locale in the inspected locale set and no RTL evidence | Responsive web with mobile-specific headers; no inspected native app | Accessibility namespace and accessible component dependencies; no runtime WCAG audit | AI capabilities in Pages and an OpenAI dependency; no evidence of our AI Router/no-rating governance |
| Twenty | No first-class GitHub suggested-evidence flow found | Arabic `ar-SA` application catalog and Lingui; full RTL behavior was not proven statically | Responsive web, primarily desktop CRM density | Design system and component tests; no runtime WCAG audit | First-class AI agents/chats and workflows; governance does not implement our protected AI boundary |
| Super Productivity | Direct issue-provider import/sync for GitHub and others; conflicts with “suggested evidence only” unless redesigned | Arabic app catalog exists; complete RTL layout behavior was not proven | Strongest cross-platform candidate: web/PWA, Electron desktop, Android/iOS through Capacitor | Angular Material plus explicit reduced-motion handling in the calendar gesture code; no complete audit | No target AI Router; personal automation/integrations rather than protected evaluation AI |
| Huly Platform | Native GitHub plugin/integration | Many locales, but no Arabic locale found in inspected language sets; no RTL evidence | Desktop-oriented collaborative web; mobile quality not verified | Large custom Svelte UI; no runtime audit, higher custom-control risk | AI assistant/bot modules; no evidence of target route hierarchy or no-rating schema |
| Focalboard | No native GitHub evidence flow | Arabic translation file exists, but `supportedLanguages` omits Arabic and no RTL switch was found | Desktop/web focused; maintenance status makes further improvement unlikely | Some semantic/component work, but old stack and no audit | No meaningful first-party AI capability |
| Vikunja | No native GitHub suggested-evidence integration found | Strongest verified RTL foundation: `ar-SA` catalog, explicit RTL language list, and `document.documentElement.dir` switching | Strong responsive web/PWA behavior; desktop packaging and a broader mobile ecosystem | No runtime audit; conventional Vue controls and keyboard/helper code provide partial evidence | No first-party evaluation AI or AI Router |

## 5. Protected product comparison

This matrix compares behavior, not visual similarity.

| Protected requirement | Plane | Twenty | Super Productivity | Huly | Focalboard | Vikunja |
|---|---|---|---|---|---|---|
| My Work is employee default home | Partial/strong reference | Partial | Strong reference | Strong reference | Partial | Partial |
| Work Item requires Project; Workstream optional | Project fit; Module only analogy | Requires custom modeling | **Conflicts:** project may be absent | Requires custom mapping | Absent | Project fit; no workstream semantics |
| Text and voice updates | Text only found | Text/activity; voice not target flow | Text; no governed voice update | Text/collab; voice not target flow | Text only | Text only |
| Evidence and contribution attribution | Partial; attachments/activity | Partial; record actor/timeline | Partial; personal attachments/work logs | Partial/strong activity | Partial | Partial |
| GitHub is suggested evidence only | **Risk:** sync/import semantics | Absent | **Risk:** direct issue import/sync | **Risk:** integration sync semantics | Absent | Absent |
| Dynamic Project/Workstream criteria | Absent | Custom object could imitate, not version rules | Absent | Absent | Absent | Absent |
| Operational KPIs without employee scoring | Analytics need strict reinterpretation | Reporting needs strict reinterpretation | Personal metrics conflict if exposed organizationally | Analytics need strict reinterpretation | Limited | Time/task metrics need strict reinterpretation |
| Quarterly self and manager assessment | Absent | Absent | Absent | Absent | Absent | Absent |
| Manager final human judgment | Absent | Absent | Absent | Absent | Absent | Absent |
| Immutable history and responsibility windows | Partial activity only | Partial record history only | **Conflicts:** mutable personal task model | Partial transaction/activity history | Partial card history | Partial history only |
| AI Router and no AI-generated ratings | Absent; existing AI path differs | Absent; agents differ | Absent | Absent; assistant differs | No AI, but no router | No AI, but no router |
| Manager Documentation Readiness privacy restriction | Absent | Absent | Absent | Absent | Absent | Absent |
| Arabic/English and RTL | **Gap:** no Arabic inspected | Arabic exists; RTL unproven | Arabic exists; RTL unproven | **Gap:** no Arabic inspected | **Gap:** file exists but not enabled | Strong verified foundation |

### Protected comparison conclusion

No candidate implements the evaluation, privacy, immutable-history, responsibility-window, criteria-versioning, or human-rating rules that distinguish this product. Replacing the existing Phase 1 backend with any candidate would discard already implemented domain controls and create a large revalidation burden. The backend must remain authoritative.

## 6. Per-repository assessment

### 6.1 Plane — primary interaction reference

**Maintenance:** Active. The inspected default development branch had a commit on 2026-07-17 and the latest release was `v1.3.1`.

**Why it is useful:** It most closely matches the desired operational shell: project-scoped work items, intake, assigned work, List/Board/Calendar/Gantt views, a side peek, activity, comments, attachments, and GitHub integration.

**Why it is not a base:** AGPL is blocking. Its domain treats work tracking as the product, while our system must preserve evaluation criteria versions, evidence confirmation, responsibility periods, privacy boundaries, and manager human judgment. Its Django service and Celery/RabbitMQ infrastructure would duplicate rather than simplify the current backend.

**Whole-repository adaptation cost:** 10–16 engineer-months plus license resolution and protected-rule reimplementation.
**Selective clean-room pattern cost:** 2–4 engineer-weeks for a bounded My Work + multi-view + peek interaction cluster.
**Complexity risk:** High for selective structural borrowing; very high for adopting the repository.

### 6.2 Twenty — record-detail and activity reference

**Maintenance:** Active, with a release on 2026-07-17.

**Why it is useful:** Its strongest transferable ideas are the record side panel, compact task rows, activity timeline, files, email/calendar context, and Arabic message catalog.

**Why it is not a base:** It is a CRM/meta-object platform, not a project performance-evidence system. The dynamic object engine, GraphQL metadata system, workflow engine, email sync, and agents would add large unrelated layers. Its mixed AGPL/enterprise license is blocking.

**Whole-repository adaptation cost:** 12–20 engineer-months plus license/commercial negotiation.
**Selective clean-room pattern cost:** 2–4 engineer-weeks for a side-panel/activity/files cluster.
**Complexity risk:** Very high as a base; medium if used only as a visual interaction reference.

### 6.3 Super Productivity — permissive My Work and mobile reference

**Maintenance:** Active, with release `v18.15.1` on 2026-07-17.

**Why it is useful:** It provides the best personal planning experience among the candidates, with a focused task list, today/planner flow, schedule, quick capture, detail panel, cross-platform delivery, and careful touch/reduced-motion behavior.

**Why it is not a base:** It is local-first and personal. Its Angular/NgRx UI, mutable task model, optional projects, direct issue imports, time tracking, and personal metrics do not match the target React/Next.js application or protected organizational rules. Copying a large Angular component would require a rewrite rather than reuse.

**Whole-repository adaptation cost:** 8–14 engineer-months despite the permissive license.
**Selective code adaptation cost:** 2–4 engineer-days for the three eligible utilities below, or 1–3 engineer-weeks for a broader planner interaction implemented in original React.
**Complexity risk:** Medium-high as a base; low for pattern-only use; low-to-medium for the isolated utilities.

### 6.4 Huly Platform — complexity warning and secondary pattern source

**Maintenance:** Source is active, but the repository announces shutdown of hosted Huly on 2026-07-20 because hosting is no longer funded; self-hosted deployments are stated to be unaffected.

**Why it is useful:** `MyIssues`, inbox, tracker, activity, attachments, collaboration, and issue editing are useful product references.

**Why it is not a base:** EPL import is explicitly prohibited without approval. The current self-host stack includes CockroachDB, Redpanda, Elasticsearch, MinIO, and many services. The source README reports more than 35 GB for a clean local Docker deployment. This would violate the modular-monolith direction and introduce far more operational surface than the current system.

**Whole-repository adaptation cost:** 18–30 engineer-months and a major architecture replacement.
**Selective clean-room pattern cost:** 3–6 engineer-weeks due to highly coupled plugin/platform concepts.
**Complexity risk:** Extreme.

### 6.5 Focalboard — do not adopt

**Maintenance:** The README explicitly states the repository is currently not maintained. The latest stable release is from 2024 and the inspected main commit is from 2025.

**Why it is useful:** Board/card detail and a simple calendar are understandable interaction references.

**Why it is not a base:** The useful UI source remains AGPL/commercial, the React 17 stack is old, the repository is unmaintained, and it lacks My Work, intake, GitHub evidence, evaluation rules, and verified Arabic enablement.

**Whole-repository adaptation cost:** 6–10 engineer-months followed by ownership of an abandoned fork.
**Selective clean-room pattern cost:** 1–2 engineer-weeks.
**Complexity risk:** High because apparent initial simplicity becomes permanent fork maintenance.

### 6.6 Vikunja — RTL and view-switching reference

**Maintenance:** Active, with a commit on the assessment date and release `v2.3.0` in April 2026.

**Why it is useful:** It has clear task details, List/Kanban/Table/Gantt project views, attachments, comments, history, responsive behavior, and the strongest verified Arabic RTL switch among the candidates.

**Why it is not a base:** AGPL is blocking. The Vue/Go stack is a replatform, and its general task/project model lacks target workstreams, evidence confirmation, evaluation cycles, privacy boundaries, and responsibility windows.

**Whole-repository adaptation cost:** 8–14 engineer-months plus protected-domain reconstruction.
**Selective clean-room pattern cost:** 2–4 engineer-weeks for view switching, task detail, and RTL interaction patterns.
**Complexity risk:** High as a base; low-to-medium as a pattern source.

## 7. Code-level reuse inventory

### 7.1 Directly reusable

**None.**

No inspected item is simultaneously:

1. permissively licensed;
2. sufficiently isolated;
3. natively compatible with React/Next.js;
4. aligned with the protected domain; and
5. valuable enough to copy without creating disproportionate maintenance.

### 7.2 Legally eligible, reusable with adaptation

These are the only code items that pass the license screen. They are optional and are **not recommended for the first reset prototype** unless its calendar behavior is explicitly in scope.

| Repository and exact path | License | Dependencies | Effort | React/Next.js use | New code potentially avoided | Maintenance risk |
|---|---|---|---:|---|---:|---|
| Super Productivity — `src/app/features/planner/planner-calendar-nav/planner-calendar-gesture-handler.ts` (291 lines) | MIT; preserve copyright and license notice | Browser `TouchEvent`, `HTMLElement`, inline styles, callbacks; assumes a five-week calendar DOM shape | 1–2 days to wrap as a React hook and replace style assumptions | Yes, after adaptation; not usable as a React component directly | 180–250 lines | Medium: touch thresholds, DOM lifecycle, and CSS contract must remain synchronized |
| Super Productivity — `src/app/features/schedule/map-schedule-data/get-tasks-within-and-beyond-budget.ts` (37 lines) | MIT; preserve notice | Internal task type and `getTimeLeftForTask` helper | <1 day to map target types and rename away from productivity semantics | Yes, pure TypeScript after a small adapter | 20–30 lines | Low technically; product risk if “budget” is misunderstood as a performance quota |
| Super Productivity — `src/app/features/schedule/map-schedule-data/map-schedule-days-to-schedule-events.ts` (132 lines) | MIT; preserve notice | Internal schedule models, date conversion, remaining-time helper, CSS grid constants | 2–3 days to replace models and verify timezone/RTL overlap behavior | Yes, as framework-neutral mapping logic after adaptation | 80–110 lines | Medium: timezone, overlap lanes, RTL grid placement, and protected no-quota language require new tests |

If any item is later adapted, the implementation must:

- add an attribution record and retain the MIT notice;
- pin the source revision;
- rewrite target types and domain language;
- add unit tests for Arabic/RTL, `Asia/Riyadh`, reduced motion where relevant, and no-readiness-quota semantics;
- undergo a new file-specific license and security check.

### 7.3 Interaction patterns only

The following paths are valuable to observe but must be reimplemented with original code.

| Repository | Exact path(s) | Useful pattern | Why code must not be reused |
|---|---|---|---|
| Plane | `apps/web/core/components/inbox/root.tsx`; `apps/web/core/components/inbox/content/issue-root.tsx` | Intake triage and focused work-item review | AGPL |
| Plane | `apps/web/core/components/issues/issue-layouts/kanban/base-kanban-root.tsx`; `.../calendar/base-calendar-root.tsx`; `.../gantt/base-gantt-root.tsx` | Shared view controls and consistent work-item rendering | AGPL and deep Plane store/type coupling |
| Plane | `apps/space/components/issues/peek-overview/side-peek-view.tsx`; `apps/web/core/components/issues/issue-detail/issue-activity/root.tsx`; `apps/web/core/components/issues/attachment/root.tsx` | Side peek with activity and attachments | AGPL |
| Twenty | `packages/twenty-front/src/modules/activities/tasks/components/TaskList.tsx`; `TaskRow.tsx` | Compact activity/task list | AGPL |
| Twenty | `packages/twenty-front/src/modules/activities/timeline-activities/components/TimelineCard.tsx`; `.../utils/groupEventsByMonth.ts` | Month-grouped record activity | AGPL |
| Twenty | `packages/twenty-front/src/modules/activities/files/components/AttachmentList.tsx`; `AttachmentRow.tsx` | File rows with record context | AGPL |
| Twenty | `packages/twenty-front/src/modules/command-menu-item/components/RecordShowSidePanelOpenRecordButton.tsx`; `RecordPageSidePanelCommandMenu.tsx` | Record side-panel opening and actions | AGPL/enterprise boundary requires file-by-file caution; do not copy |
| Super Productivity | `src/app/features/tasks/task-detail-panel/task-detail-panel.component.ts`; `src/app/features/tasks/task-list/task-list.component.ts` | Dense task editing without leaving My Work | MIT, but 800-line Angular/NgRx components would be a rewrite and import hidden coupling |
| Super Productivity | `src/app/features/planner/planner.component.ts`; `src/app/features/planner/planner-day/planner-day.component.ts`; `src/app/features/schedule/schedule/schedule.component.ts` | Today/planner/schedule hierarchy | MIT, but Angular-specific and target domain differs |
| Super Productivity | `src/app/features/boards/board/board.component.ts`; `src/app/features/boards/boards.util.ts` | Personal board composition and filtering | MIT, but NgRx/internal models make selective reuse more expensive than original React |
| Huly | `plugins/tracker-resources/src/components/myissues/MyIssues.svelte`; `.../issues/IssuesView.svelte`; `.../issues/KanbanView.svelte` | My Issues and view composition | EPL-2.0 and deep platform coupling |
| Huly | `plugins/tracker-resources/src/components/issues/edit/EditIssue.svelte`; `plugins/activity-resources/src/components/Activity.svelte`; `plugins/attachment-resources/src/components/Attachments.svelte` | Rich detail/activity/attachments composition | EPL-2.0 |
| Focalboard | `webapp/src/components/cardDetail/cardDetail.tsx`; `commentsList.tsx`; `attachment.tsx`; `calendar/fullCalendar.tsx` | Simple card detail and calendar interaction | UI source is AGPL/commercial and repository is unmaintained |
| Vikunja | `frontend/src/views/tasks/TaskDetailView.vue`; `frontend/src/components/tasks/partials/Attachments.vue`; `Comments.vue`; `KanbanCard.vue` | Full task details and supporting evidence context | AGPL and Vue coupling |
| Vikunja | `frontend/src/components/project/views/ProjectList.vue`; `ProjectKanban.vue`; `ProjectTable.vue`; `ProjectGantt.vue` | Consistent List/Board/Table/Gantt switching | AGPL |
| Vikunja | `frontend/src/i18n/index.ts` | Explicit `ar-SA`/`fa-IR`/`he-IL` RTL switch at the document root | AGPL; reproduce the behavior independently, not the code |

### 7.4 Do not reuse

| Repository and path | Reason |
|---|---|
| Plane — `apps/api/plane/db/models/issue.py` and `apps/api/plane/db/models/integration/github.py` | AGPL; replacing current domain/backend rules; GitHub sync is not the protected suggested-evidence flow |
| Twenty — any file marked `/* @license Enterprise */` | Restricted commercial terms; explicit no-copy constraint |
| Twenty — metadata object engine and workflow/agent packages | AGPL/enterprise risk and large unrelated abstraction surface |
| Super Productivity — `packages/plugin-dev/github-issue-provider/src/plugin.ts` | MIT but uses direct issue-provider/import semantics rather than the required GitHub App + suggested evidence + employee confirmation model |
| Super Productivity — `src/app/features/tasks/task.model.ts` and sync operation model | Mutable personal model; no required project, responsibility windows, immutable evaluation history, or access-control boundary |
| Huly — all source code | EPL import explicitly prohibited; microservice/platform coupling |
| Focalboard — `server/model/board.go`, `server/model/card.go` | Apache-2.0 paths are legally less restrictive, but the generic block model would replace stronger current domain semantics and add no meaningful advantage |
| Vikunja — `pkg/models/tasks.go`, `pkg/models/project.go` and frontend helpers | AGPL and incompatible domain model |
| All candidates — logos, names, screenshots, marketing images, icons with unclear provenance, and bundled background assets | Branding/trademark/proprietary-asset constraint |
| All candidate translation catalogs | Product meaning, terminology, and protected Arabic rubric content must be authored and approved for this system; translations are not interchangeable |

## 8. Estimated reuse economics

| Candidate | Cost to adapt whole repository | Cost for bounded selective work | Likely time saved versus original target implementation | Maintenance impact |
|---|---:|---:|---:|---|
| Plane | 10–16 engineer-months; blocked by license | 2–4 weeks clean-room pattern implementation | 1–2 weeks of UX discovery | Low if patterns only; extreme if forked |
| Twenty | 12–20 engineer-months; blocked by mixed license | 2–4 weeks clean-room side-panel/activity implementation | ~1 week of UX discovery | Low if patterns only; extreme if platform adopted |
| Super Productivity | 8–14 engineer-months | 2–4 days for eligible utilities; 1–3 weeks for original React planner patterns | 3–7 days of implementation plus ~1 week of UX discovery | Low for patterns; low-to-medium for three pinned utilities; high for Angular port |
| Huly | 18–30 engineer-months; blocked by license and architecture | 3–6 weeks clean-room | ~1 week of interaction discovery | Extreme if any platform architecture is copied |
| Focalboard | 6–10 engineer-months; blocked/unmaintained | 1–2 weeks clean-room | 2–4 days | High fork ownership; low pattern-only value |
| Vikunja | 8–14 engineer-months; blocked by license | 2–4 weeks clean-room | 1–2 weeks, especially RTL/view behavior | Low if patterns only; high if forked |

**Net estimate:** using Plane, Super Productivity, Twenty, and Vikunja as bounded interaction references can save approximately **2–4 engineer-weeks** of discovery, interaction design, and prototype iteration. Actual MIT code adaptation would save at most **2–4 engineer-days and roughly 280–390 new lines**, and only if calendar scheduling is approved for the reset scope.

## 9. Implications for the current system

### 9.1 Phase 1 backend

No Phase 1 backend replacement or modification is justified.

The existing backend remains the source of truth for:

- required Project and optional Workstream linkage;
- responsibility periods and historical attribution;
- versioned criteria;
- evidence suggestion and employee confirmation;
- evaluation and readiness privacy boundaries;
- immutable active templates and closed evaluations;
- audit requirements;
- manager final human judgment;
- AI Router enforcement and prohibition of AI-generated ratings.

The Product Reset should be a new user-experience shell over existing public module interfaces, with only separately approved API additions when a real UI need is demonstrated.

### 9.2 Complexity guardrails

Do not import:

- a generic object/meta-model engine;
- a second task database or sync layer;
- CRDT collaboration infrastructure;
- a new queue or search cluster;
- provider-specific GitHub issue sync;
- personal productivity scoring/time metrics;
- a second authentication system;
- a candidate’s activity model as the historical source of truth.

## 10. Sources

Primary source links are pinned where practical:

- Plane: [repository](https://github.com/makeplane/plane), [license](https://github.com/makeplane/plane/blob/7cef741c29cf61d3bca18dc892e6af11a1e7becc/LICENSE.txt), [web manifest](https://github.com/makeplane/plane/blob/7cef741c29cf61d3bca18dc892e6af11a1e7becc/apps/web/package.json), [API requirements](https://github.com/makeplane/plane/blob/7cef741c29cf61d3bca18dc892e6af11a1e7becc/apps/api/requirements/base.txt).
- Twenty: [repository](https://github.com/twentyhq/twenty), [mixed license](https://github.com/twentyhq/twenty/blob/dcd6683cac80aa3d0c9ec199372cacc8020b5e64/LICENSE), [frontend manifest](https://github.com/twentyhq/twenty/blob/dcd6683cac80aa3d0c9ec199372cacc8020b5e64/packages/twenty-front/package.json), [server manifest](https://github.com/twentyhq/twenty/blob/dcd6683cac80aa3d0c9ec199372cacc8020b5e64/packages/twenty-server/package.json).
- Super Productivity: [repository](https://github.com/super-productivity/super-productivity), [MIT license](https://github.com/super-productivity/super-productivity/blob/014b789c22c9bf75fd7202845639569b61e7cd8e/LICENSE), [manifest](https://github.com/super-productivity/super-productivity/blob/014b789c22c9bf75fd7202845639569b61e7cd8e/package.json), [SuperSync manifest](https://github.com/super-productivity/super-productivity/blob/014b789c22c9bf75fd7202845639569b61e7cd8e/packages/super-sync-server/package.json).
- Huly: [repository and hosted-service notice](https://github.com/hcengineering/platform/blob/4c5d2d578e3aceb380db511e4b73848af4f14937/README.md), [EPL-2.0 license](https://github.com/hcengineering/platform/blob/4c5d2d578e3aceb380db511e4b73848af4f14937/LICENSE), [self-host architecture](https://github.com/hcengineering/huly-selfhost/blob/main/ARCHITECTURE_OVERVIEW.md).
- Focalboard: [repository and maintenance notice](https://github.com/mattermost-community/focalboard/blob/a84bbb65e32edf972856b329417096ac413518e9/README.md), [mixed license](https://github.com/mattermost-community/focalboard/blob/a84bbb65e32edf972856b329417096ac413518e9/LICENSE.txt), [web manifest](https://github.com/mattermost-community/focalboard/blob/a84bbb65e32edf972856b329417096ac413518e9/webapp/package.json).
- Vikunja: [repository](https://github.com/go-vikunja/vikunja), [license](https://github.com/go-vikunja/vikunja/blob/5a4dae6df25391bb0fb3805f094cf057267b5045/LICENSE), [frontend manifest](https://github.com/go-vikunja/vikunja/blob/5a4dae6df25391bb0fb3805f094cf057267b5045/frontend/package.json), [explicit RTL configuration](https://github.com/go-vikunja/vikunja/blob/5a4dae6df25391bb0fb3805f094cf057267b5045/frontend/src/i18n/index.ts).
