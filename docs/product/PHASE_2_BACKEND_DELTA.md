# Phase 2 Backend Delta

**Status:** Proposed production delta after product-direction approval
**Implementation status:** Not implemented
**Authority:** The existing Phase 1 modular-monolith backend remains authoritative

## Purpose

This document records only backend behavior that the Product Reset prototype proves is needed. It does not authorize migrations, APIs, queue jobs, or production Work Item code.

## Existing capabilities to preserve

The production implementation must reuse current public module boundaries for:

- identity, sessions, deactivation, and server-side permissions;
- Projects and Project membership;
- Workstreams, owners, and contributors;
- responsibility windows and historical ownership;
- documents and immutable versions;
- Documentation Readiness;
- dynamic Project and Workstream criteria;
- employee acknowledgments and objections;
- AI Router and worker;
- append-only audit history.

It must not add a second authentication system, second queue, parallel Project/Workstream store, generic object platform, or candidate-derived activity model.

## Capability-by-capability delta

| User need | Reusable Phase 1 capability | Exact missing production capability | Blocking? | Smallest safe implementation | Protected rule | Expected area | Complexity |
|---|---|---|---|---|---|---|---|
| Daily My Work | Identity, permissions, Project/Workstream scope | Work Item entity plus scoped list query and filters | Yes, Slice 1 | One bounded module and one list projection | Counts are not performance | `packages/work-items`, API controller, web gateway/UI | Medium |
| Work Item detail/lifecycle | Responsibility windows, audit | Status, assignment, participant, dependency, blocker, next-action fields and append-only history commands | Yes, Slice 1 | Exact seven-state lifecycle with optimistic concurrency | Historical responsibility preserved | `packages/work-items`, database migration, API | High |
| Inbox triage | Worker, audit, domain events | Action projection; resolve/link/convert commands with idempotency | No for Slice 1; yes for Slice 2 | Read model over approved public events | UI is not authorization | `packages/work-items`, API query service, web | Medium |
| Text update | AI Router, worker, criteria, audit | Source/revision entity, structured draft schema, confirmation command, timeline event | Yes, Slice 2 | One versioned update aggregate with employee gate | AI no rating; human confirmation | `packages/updates-evidence`, AI Router adapter use, API/worker | High |
| Voice update | Private upload, AI Router, worker | Audio source, raw/edited transcript revisions, STT trace, dual confirmation | Yes, Slice 5 | Extend update source types; reuse file controls and router | Sensitive input; no rating | `packages/updates-evidence`, files, worker, API | High |
| Activity Timeline | Audit and immutable domain history | Approved event projection with source-type discriminator | Yes for accepted update/evidence visibility | Compose public domain events; no generic mutable feed | Historical records append-only | query service, API, web | Medium |
| Evidence attribution | Files/documents, criteria, responsibility | Evidence/source/revision/link/attribution entities and confirm/reject commands | Yes, Slice 3 | One evidence aggregate inside updates/evidence boundary | Volume not performance; actual responsibility period | `packages/updates-evidence`, database/API | High |
| GitHub suggestions | Worker/queue, audit | Suggestion/source IDs, webhook reconciliation, merge/reassign/link states | Yes, Slice 4 | GitHub App adapter producing suggestions only | Employee confirmation required | GitHub adapter, worker, updates/evidence API | High |
| Dynamic criteria context | Phase 1 criteria versions | Active-at-event query from update/evidence/Work Item | No new entity | Public criteria query interface | Never retroactive; no auto-average | criteria public interface, query composition | Low |
| Thursday check-in | Worker and update history | Substantive-update query, reminder state, leave exclusion | Yes, Slice 6 | Scheduled query plus idempotent reminder | Approved leave excluded | worker, updates query, notification adapter | Medium |
| Monthly readiness | Phase 1 Documentation Readiness | Work Item/update/evidence inputs and coarse manager projection | Yes, Slice 6 | Extend existing readiness inputs through public interfaces | Non-scoring; no quotas; coarse manager view | existing readiness module/query | Medium |
| Manager operations | Manager permissions, Project/Workstream scope | Aggregated action/blocker/coarse-readiness query | Yes, Slice 7 | Read-only composed query plus bounded resolution commands | No rank/score/individual readiness value | API query service, web | Medium |
| Evaluation Fact View | Responsibility, criteria, documents, audit | Period fact query/snapshot linking claim, facts, unclear parts, result, evidence | Yes, Slice 8 | Immutable source-linked preparation snapshot | Fact vs interpretation; no AI rating | evaluation query/snapshot module | High |

## Confirmed new production concepts

### Work Item

A Work Item requires:

- organization and stable identity;
- one required Project;
- zero or one Workstream belonging to the same Project;
- title, description, type, status, priority, start date, and optional due date;
- primary assignee and participants with server-side access checks;
- employee role and contribution context;
- requirements, acceptance criteria, dependencies, blocker, and next action;
- links to criteria, updates, evidence, GitHub suggestions, and history.

Allowed initial statuses are exactly:

- Planned
- Ready
- In Progress
- Blocked
- In Review
- Done
- Cancelled

Status history, assignment history, and responsibility attribution must be append-only. No sprint, story point, time tracking, workload score, or workflow builder is part of this delta.

### Update

An update retains:

- original employee input;
- source type: text or voice;
- original transcript and employee-corrected transcript when voice is used;
- deterministic or routed AI structured draft with schema and prompt version;
- employee edits;
- employee confirmation timestamp;
- related Project, optional Workstream, Work Item, criteria, and evidence;
- activity, result, contribution boundaries, participants, impact, blocker, decision, learning, and next step;
- model-route trace only when a real AI route is used.

The employee confirmation is a protected human gate. No structured output becomes an accepted update before confirmation.

### Activity event

Activity is a domain projection over accepted events, not a mutable generic feed. It distinguishes original input, structured summary, verified fact, employee interpretation, suggested evidence, confirmed evidence, blocker, decision, and responsibility change.

Events reference their authoritative source and are append-only. Feature modules publish through a bounded interface; they do not write arbitrary activity rows.

### Evidence and GitHub suggestion

Evidence records:

- source kind and immutable source reference;
- original external source ID and URL;
- Project, optional Workstream, and optional Work Item;
- state: suggested, confirmed, rejected, or ignored;
- Manual, AI-Assisted, Agent-Generated, or Mixed execution mode;
- employee contribution context;
- confirmation actor and timestamp;
- source verification and attribution state.

GitHub webhook and reconciliation behavior remains idempotent. GitHub items are suggestions only until employee confirmation. Commit, PR, file, and line volume must not enter employee-performance contracts.

## Required module boundaries

Recommendation after approval:

- add a bounded `work-items` domain module owning Work Item lifecycle and persistence;
- add an `updates-evidence` module owning update confirmation, evidence confirmation, and their immutable source records;
- expose activity through a read model composed from approved public events;
- query Projects, Workstreams, criteria, responsibility, and documents only through their Phase 1 public interfaces;
- route all future AI structuring through the existing AI Router;
- enqueue asynchronous work through the existing worker and queue.

No direct cross-module table reads are permitted.

## Proposed APIs

Exact contracts require a later implementation plan and security review. The smallest useful surface is:

- list My Work with bounded filters and stable view identity;
- get/create/update Work Item through server-side permission checks;
- transition Work Item status with optimistic concurrency;
- list/resolve Inbox actions;
- create update draft and submit employee-confirmed update;
- create/edit/confirm/reject evidence;
- list GitHub suggestions and link them to Work Items;
- read Project/Workstream activity projection;
- read employee Evaluation Fact View;
- read manager operational summary with coarse readiness only.

Every protected mutation requires authorization. UI hiding is not authorization.

## Transaction and immutability requirements

Use transactions for:

- Work Item status transition plus history event;
- assignee change plus responsibility/attribution history;
- employee update confirmation plus accepted activity event;
- evidence confirmation plus contribution context and audit event;
- GitHub suggestion merge/reassignment plus source-link history.

Do not update protected source, responsibility, criteria, update, evidence, or evaluation history in place. Corrections create revisions or formal transitions.

## Privacy and manager projection

The manager operational query may expose Project/Workstream health, actions, blockers, and coarse readiness labels. It must not return:

- individual Documentation Readiness percentage or numeric value;
- readiness rank;
- employee rank;
- productivity score;
- predicted or suggested rating;
- activity-volume leaderboard;
- GitHub-volume leaderboard.

The manager rating screen remains separate from individual Documentation Readiness values. Final rating remains a human manager decision.

## AI and voice production delta

- All structuring calls use the AI Router.
- Schemas contain no rating, rank, productivity score, or readiness score.
- Voice upload follows existing file validation, private storage, and untrusted-input rules.
- Raw audio, raw transcript, employee correction, and accepted summary have explicit retention and access policies.
- Uploaded text and audio are treated as untrusted AI input and protected against instruction injection.
- Prompt/schema changes require versioning and relevant English/Arabic evaluation fixtures.

The prototype’s deterministic adapter is not production AI code and must not be promoted into the production module as a provider.

## Migration outline — not authorized

A later approved implementation would likely need forward-only tables for Work Items, assignments/participants, status history, dependencies, updates and revisions, evidence and source links, GitHub suggestions, and confirmation events.

Before any migration is written:

1. approve the Product Reset direction;
2. approve the bounded domain model and module ownership;
3. map new foreign keys to existing Project, Workstream, user, criteria, audit, and responsibility identities;
4. define historical immutability and retention;
5. define indexes and concurrency tokens;
6. test from empty database and the Phase 1 release snapshot.

## Explicitly excluded

- production code in this prototype checkpoint;
- a second Project, Workstream, identity, audit, queue, or AI store;
- automatic employee score or rating;
- task or GitHub volume as performance;
- generic workflow builder;
- time tracking and workload scoring;
- retroactive criteria application;
- mutation of closed evaluations or protected history;
- activation of T016 Arabic evaluation rubric.
