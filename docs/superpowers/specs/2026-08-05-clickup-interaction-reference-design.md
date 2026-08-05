# ClickUp Interaction Reference Design

**Status:** Product Owner approved on 2026-08-05

**Decision:** Interaction reference only

**Engine impact:** None before the E7 frontend handoff

**Code, assets, branding, schemas, and integrations reused:** None

## 1. Outcome

Use ClickUp 4.0 as the primary interaction reference for the future intelligent daily-work frontend,
while preserving this product's independent engine, protected rules, data model, identity, and visual
identity.

This decision does not authorize a ClickUp API integration, data import, runtime dependency, source-code
reuse, asset reuse, or a ClickUp-shaped engine. The existing E3–E7 specifications and dependency order
remain the only authority for completing the engine.

## 2. Facts observed

The official ClickUp product and help material demonstrates:

- a personalized `My Tasks` home for assigned, today, overdue, priority, reminder, and calendar work;
- multiple List, Board, Calendar, Gantt, Timeline, and related views over shared Task identities;
- a focused Task experience with collapsible detail and a right sidebar for activity, comments, links,
  relationships, email, and integrations;
- a Planner that composes Tasks and external calendar events and presents human-confirmed AI time-block
  recommendations;
- embedded AI for search, summaries, stand-ups, draft creation, task assistance, voice transcription,
  and connected-app context;
- personal Gmail and Google Calendar connections and Workspace-scoped GitHub integration;
- global search/command access, keyboard shortcuts, mobile navigation, notifications, dashboards, Docs,
  and connected knowledge.

ClickUp Brain can translate content into Arabic, but the documented product-interface localization set
does not include Arabic. ClickUp therefore is not an Arabic/RTL implementation source.

## 3. Approved reference patterns

The future frontend may study and reinterpret these patterns as original product behavior:

1. **Daily starting point:** one calm employee home that prioritizes what needs attention now.
2. **One Work Item identity:** List, Board, Calendar, and Timeline are projections of the same work, not
   separate stores or duplicate objects.
3. **Context-preserving detail:** open focused Task/Research/Project detail in a drawer, sheet, or panel
   without losing the surrounding list or daily context.
4. **Progressive disclosure:** show the next useful action first and reveal advanced fields only when
   needed.
5. **Work-adjacent context:** keep comments, sources, files, evidence, connected events, decisions, and
   activity close to the object they support.
6. **Embedded assistance:** make AI available inside Tasks, Projects, Research, Today, and connected
   context instead of requiring a separate generic chat journey.
7. **Fast navigation:** use one search/command surface, consistent shortcuts, clear badges, and compact
   action queues.
8. **Planner composition:** combine scheduled work and meetings while keeping every AI suggestion
   editable and human-confirmed.
9. **Responsive continuity:** preserve the same core journey on desktop and mobile rather than exposing
   an unrelated reduced product.

## 4. Product-specific behavior that must remain different

The future frontend must not inherit familiar project-management behavior when it conflicts with this
product's approved rules:

- Project progress comes only from a versioned, human-approved Progress Contract—not completed Task
  count, time logged, update frequency, commits, files, lines changed, or general activity.
- Project progress is operational Project state and never employee performance.
- Gmail, Calendar, GitHub, uploads, links, code, and voice are sources. They do not become personal
  contribution Evidence until the defined employee confirmation gate.
- AI may organize, draft, compare, summarize, explain, and ask questions. It does not assign work,
  activate contracts, confirm Evidence, decide conclusions, recommend ratings, or make final judgments.
- Research and Experiments retain explicit questions, hypotheses, baselines, methods, runs, outcomes,
  limitations, conclusions, decisions, and applied learning; they are not flattened into generic Tasks
  or comments.
- Documentation Readiness remains non-scoring and manager-safe.
- Evaluation Fact View separates source-supported facts from employee interpretation.
- Employee and manager assessments follow the approved independent human workflow, and the manager
  retains the final human rating decision.
- Responsibility, criteria, evidence, evaluation, leave, delegation, and audit history remain versioned
  or append-only as approved.
- Arabic/English, RTL/LTR, mixed-direction technical content, keyboard access, visible focus, and reduced
  motion are first-class requirements implemented independently.

## 5. Explicit exclusions

Do not:

- copy ClickUp source code, screenshots, copy, icons, branding, templates, animations, translations, or
  visual assets;
- adopt ClickUp's hierarchy, schema, authentication, permissions, goals, automations, reporting model,
  AI-agent model, or integration model as an engine requirement;
- add ClickUp OAuth, API, webhooks, import, export, or synchronization;
- build the final frontend before the engine passes E7;
- create a second Task store, evidence lifecycle, activity platform, search index, identity system,
  queue, or configuration system;
- add a feature merely because ClickUp offers it;
- reproduce ClickUp's configuration density, nested navigation, or feature volume in the employee
  experience.

## 6. Engine boundary

This reference causes no production-code, database, API, event, AI-route, migration, connector, or
verification change in E3–E6C. Engine subsystems continue to expose stable versioned public contracts
without encoding a final screen layout.

No current TDD plan receives a ClickUp-derived implementation task. Missing engine behavior is judged
only against authoritative project requirements, protected rules, and approved engine specifications.

## 7. E7 frontend handoff

E7 records ClickUp as the primary daily-work interaction reference after the engine audit reaches
`READY_FOR_FINAL_FRONTEND_DESIGN`. The handoff must include:

- complete employee, manager, Project owner, and System Administrator journeys;
- the primary user moment and next action for every engine capability;
- one shared identity and filter model for every multi-view work object;
- loading, empty, draft, pending, stale, failed, recovery, conflict, confirmed, and historical states;
- human gates and protected visibility at the exact interaction where they apply;
- mobile, keyboard, focus, reduced-motion, Arabic/English, RTL/LTR, and mixed-content needs;
- the approved ClickUp patterns from section 3 and the explicit exclusions from sections 4–5;
- a simplification audit proving that backend packages and technical identifiers do not become the
  navigation model.

The final frontend then receives a separate brainstorming, visual-design, specification, and execution
cycle. It is implemented as original clean-room React/Next.js work over the completed engine.

## 8. Future frontend acceptance principles

The later interface succeeds when:

- the employee can understand today's work and next actions without learning the engine structure;
- AI reduces capture, linking, search, preparation, and follow-up effort without bypassing a human gate;
- advanced capabilities remain available without dominating the default daily journey;
- every source and suggestion explains where it came from and what confirmation is required;
- Task, Project, Research, Evidence, progress, readiness, and evaluation remain conceptually distinct;
- the same work can be reviewed across useful views without duplication or contradictory state;
- the product is usable at 390 px and with keyboard-only navigation in approved Arabic and English
  scopes;
- no activity-volume, ranking, predicted-rating, or AI-rating behavior appears.

## 9. Reference sources

Reviewed on 2026-08-05:

- [ClickUp product features](https://clickup.com/features)
- [ClickUp 4.0](https://help.clickup.com/hc/en-us/articles/31142608907543-Intro-to-ClickUp-4-0)
- [My Tasks](https://help.clickup.com/hc/en-us/articles/31007956275863-My-Tasks)
- [Task views](https://help.clickup.com/hc/en-us/articles/6310172583831-Use-Task-views)
- [Task right sidebar](https://help.clickup.com/hc/en-us/articles/35041742373015-Tasks-right-sidebar)
- [ClickUp Brain](https://help.clickup.com/hc/en-us/articles/12578085238039-What-is-ClickUp-Brain-AI)
- [Planner and AI time-blocking](https://help.clickup.com/hc/en-us/articles/35975611704087-Schedule-tasks-from-your-Planner)
- [Gmail integration](https://help.clickup.com/hc/en-us/articles/33714695276951-Gmail-integration)
- [Google Calendar integration](https://help.clickup.com/hc/en-us/articles/6336507264663-Google-Calendar-integration)
- [GitHub integration](https://help.clickup.com/hc/en-us/articles/6305771568791-GitHub-integration)
- [Keyboard shortcuts](https://help.clickup.com/hc/en-us/articles/6309030550167-Use-keyboard-shortcuts)
- [Brain translation and localization](https://help.clickup.com/hc/en-us/articles/15430667811863-Translate-and-localize-with-Brain-AI)

## 10. Confidence

- **High:** documented capability inventory, interaction structure, integration categories, AI entry
  points, and the approved no-integration/no-copy decision.
- **Medium:** comparative usability judgments, because this review used ClickUp's public product and help
  surfaces rather than a fully configured long-running company Workspace.
