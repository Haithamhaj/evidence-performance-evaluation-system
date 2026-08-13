# AI-Native Employee Experience — Final Visual Design

**Date:** 2026-08-13  
**Status:** Product Owner visual checkpoint  
**Surface:** Employee daily experience  
**Implementation status:** Design only; no production UI implementation is authorized by this document

## 1. Outcome

The final employee experience must feel like an intelligent work assistant, not a traditional
project-management system with AI added on top.

The employee can understand the day and the active project portfolio within seconds, share any work
input without classifying it first, and confirm exactly what the assistant proposes before the system
creates or links an official record.

The connected journey is:

> Home Overview → Project Workspace → Work → Universal Capture → Clarification → Review & Confirmation

## 2. Visual Decision Status

| Surface               | Decision                                                   | Visual source                                                                     |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Home Overview         | **Approved**                                               | `docs/product/screenshots/ai-native-final-design/home-overview-approved.png`      |
| Work                  | **Approved**                                               | `docs/product/screenshots/ai-native-final-design/work-approved.png`               |
| Universal Capture     | **Approved**                                               | `docs/product/screenshots/ai-native-final-design/universal-capture-approved.png`  |
| Project Workspace     | Direction prepared; **Product Owner confirmation pending** | `docs/product/screenshots/ai-native-final-design/project-workspace-pending.png`   |
| Review & Confirmation | Direction prepared; **Product Owner confirmation pending** | `docs/product/screenshots/ai-native-final-design/review-confirmation-pending.png` |

The screenshots are visual targets, not literal data or permission specifications. Approved engine
contracts, authorization, privacy, history, and human gates remain authoritative.

## 3. Product-Wide Interaction Model

### 3.1 One universal entry

The employee can type, speak, paste a URL, upload an image or file, or add code from any primary
surface. The employee is not asked to choose Task, Update, Evidence, or Project progress before the
assistant understands the input.

The assistant may propose:

- the likely Project and optional Workstream;
- whether the input is a private note, Task, Project Update, or suggested Evidence;
- the related Work Item, milestone, deliverable, KPI, or criterion;
- the missing information required to complete a safe draft;
- one focused clarification at a time.

The employee can correct every proposed relationship and can save the input privately without
creating shared work.

### 3.2 Progressive disclosure

The first view shows only the decision, next action, current state, and why it matters. Source details,
calculation rules, history, and uncertainty open on demand through focused drawers, disclosures, and
review panels.

### 3.3 Assistant behavior

The assistant prepares, connects, summarizes, and drafts. It does not silently execute an official
domain command. Suggestions show their source and uncertainty. When a source is stale or unavailable,
the UI says so and retains the manual path.

## 4. Approved Home Overview

Home is a multi-project employee overview. It answers within 5–10 seconds what needs a decision,
what deserves focus, where each Project is, which KPI or deliverable needs attention, what changed,
and what the assistant prepared.

Required composition:

- concise greeting, assistant brief, and work signals;
- compact active-Project rows;
- circular confirmed Project-progress indicator;
- linear completed/current/next milestone path;
- one meaningful operational KPI with baseline/current/target when defined;
- next action, blocker, and visible progress provenance;
- a `Now` timeline for decisions, meetings, Tasks, and verified changes;
- Smart Brief, suggested action, and `How calculated` disclosure;
- Universal Capture access.

The circle answers **how much confirmed Project progress exists**. The milestone path answers **where
the Project is and what comes next**.

## 5. Approved Work Surface

Work is the employee's execution surface across Projects. It prioritizes current work instead of a
large creation form.

Required composition:

- `Needs my action`, `Today`, and `Overdue` first;
- `Waiting for others` and `Upcoming` progressively disclosed;
- compact Task rows with status, Project, optional Workstream, due date, source, and next action;
- `My work` by default and team work only when authorized;
- List as primary, with retained Board and Calendar routes;
- URL-owned Task drawer with focus return;
- related Gmail, Calendar, GitHub, Documents, Updates, and Evidence through authorized readers;
- assistant-suggested next step;
- Project context and explicit notice that Task completion alone does not change Project progress;
- `Share anything` opens the approved Universal Capture.

## 6. Approved Universal Capture

Universal Capture is the intelligent entry. Employees do not need to understand internal record types
before sharing work.

Journey:

1. **Capture:** mixed text, voice, URL, image, code, and file input in one composer.
2. **Clarify:** show the assistant's understanding and ask one missing question at a time.
3. **Review & confirm:** show every proposed record, relationship, and consequence before action.

Capture requirements:

- likely Project with confidence and correction;
- likely meaning and related Work/milestone/KPI;
- honest missing-measurement or missing-source state;
- prominent `Private draft until you review and confirm`;
- `Save privately for later`;
- no Task, Update, Evidence, progress change, or evaluation input during capture/clarification;
- safe treatment of untrusted documents, code, links, and comments.

## 7. Project Workspace Direction — Pending Confirmation

The prepared Project Workspace direction contains Project purpose, ownership, Workstreams, current
document, circular progress, milestone journey, KPI baseline/current/target, deliverables, attention
queue, unified Work/Updates/Evidence/Documents rows, append-only Timeline, and a Project Smart Brief.
It explicitly preserves the rule that suggested Evidence cannot change progress until the approved
rule or authorized human confirmation is recorded.

## 8. Review & Confirmation Direction — Pending Confirmation

The prepared final review separates:

- editable Project Update draft;
- separately selectable suggested Evidence and contribution context;
- a separate progress proposal that cannot change official progress automatically;
- rationale, sources, uncertainty, and exact `After confirmation` consequences;
- independent owner-confirmation action where required;
- `Back and edit`, `Save private draft`, and `Confirm selected actions`.

## 9. Progress and KPI Rules

- Visible percentages are Project/Workstream operational progress, never employee performance.
- Official progress comes only from the active human-approved Progress Contract or authorized human
  confirmation required by it.
- Task completion, update frequency, GitHub activity, commits, files, and lines changed never
  calculate Project progress.
- KPI visuals use approved baseline, target, unit, direction, calculation rule, and source freshness.
- Missing or ambiguous inputs produce review, not an invented percentage.

## 10. Protected Evaluation Boundary

These surfaces must not expose or generate employee scores/rankings, productivity scores,
manager-facing individual Documentation Readiness percentages, predicted/recommended ratings,
automatic manager judgment, or a claim that Project progress equals employee performance.

## 11. Responsive and Accessibility Requirements

- Desktop uses persistent navigation and focused right drawers.
- Mobile uses bottom navigation and visible bottom sheets.
- Keyboard operation, visible focus, focus return, dialog trapping, Escape, reduced motion, and
  semantic announcements are required.
- English is the pilot language. Arabic/RTL foundations remain functional; Arabic employee
  evaluation content remains behind its separate language gate.

## 12. Implementation Boundaries

- Keep the modular monolith and existing engine authorities.
- Compose public readers/commands; do not recreate domain logic in the browser.
- Preserve server authorization, owner-private context, GitHub confirmation, retained routes, and
  rollback flags.
- Do not add a generic activity platform, second store/authentication system, or package per screen.
- The shared experience composition layer has no domain command authority.

## 13. Failure and Recovery

- Connector failure leaves manual capture available.
- AI failure leaves an editable deterministic/private draft path.
- Stale decisions require fresh authorized review.
- Reconnect uses durable receipts and bounded replay.
- Upload failure identifies the source without discarding other input.
- Recovery messages state what was saved, what was not performed, and the safe next action.

## 14. Gate Before Implementation Planning

1. Product Owner confirms Project Workspace.
2. Product Owner confirms Review & Confirmation.
3. The complete desktop journey is reviewed as one system.
4. Mobile and Arabic/RTL adaptations derive from the accepted hierarchy.
5. Planning maps every visible element to an existing engine capability or explicit bounded delta.
