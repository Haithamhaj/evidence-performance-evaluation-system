# AI-Native Manual and Operator Wireflows

**Status:** Phase 0A nonvisual workflow definition  
**Rule:** AI/Chat may shorten a path but cannot remove its complete manual or protected operator flow.

## Work

```mermaid
flowchart TD
  T["Today or Work"] --> C{"Create or open Task?"}
  C -->|Create| F["Manual Task form: Project required, Workstream optional"]
  C -->|Open| D["Focused Task detail"]
  F --> V["Validate Project, assignment, and current scope"]
  V --> S["Submit protected Task command with idempotency"]
  D --> E["Edit state, due date, dependency, or content within permission"]
  E --> X["Submit with expected version"]
  S --> R["Reload authoritative Task"]
  X --> R
  R --> M["Show meaningful result / What Changed"]
  X -->|Stale| L["Reload latest; preserve user draft"]
```

AI may prepare a draft or follow-up. The human chooses Project/assignment and submits. Task count or
completion never becomes Project progress or employee performance.

## Project

```mermaid
flowchart TD
  P["Project Overview"] --> O["Read approved document, active contract, snapshot, source coverage"]
  O --> G{"What needs action?"}
  G -->|Document gap| D["Update authoritative Project document"]
  G -->|Contract draft/revision| C["Author/edit measurable rules manually"]
  G -->|Progress condition| Q["Review rule, source, ambiguity, prior snapshot"]
  G -->|Ownership| W["Manager transfer workflow"]
  D --> N["Create prospective version; rerun analysis"]
  C --> A["Authorized owner/approver activates prospective contract"]
  Q --> H["Confirm only contract-defined condition or reject/correct"]
  H --> R["Projects domain recalculates and appends snapshot"]
  Q -->|Missing source| K["Keep prior progress; show missing confirmation/evidence"]
```

No direct percentage override exists. Activity volume never calculates progress.

## Research and Experiment

```mermaid
flowchart TD
  L["Add URL, paper, repository, note, file, or connected source"] --> R["Manual relevance review against Project question"]
  R -->|Relevant| Q["Create/refine research question, assumptions, constraints"]
  R -->|Reject/defer| X["Record source disposition"]
  Q --> E{"Experiment or decision?"}
  E -->|Experiment| M["Define hypothesis, baseline, measures, cases, controls"]
  M --> U["Record run, result, failure, limitations, reproducibility"]
  U --> C["Human conclusion and decision"]
  E -->|Decision| C
  C --> A["Link applied learning to Task, Document, Evidence, or next Experiment"]
  A --> T["Append source-labelled Timeline event"]
```

Failed/inconclusive results remain visible. AI may review or draft but cannot confirm relevance,
method, conclusion, decision, or applied learning.

## Evaluation — Fixed Human Flow

```mermaid
flowchart TD
  C["Open frozen cycle and criterion"] --> F["Read Fact View and approved anchors"]
  F --> R["Human selects rating"]
  R --> J{"Request wording help?"}
  J -->|No| W["Human writes justification"]
  J -->|Yes| A["AI drafts wording from selected facts after rating"]
  A --> E["Human edits and approves wording"]
  W --> S["Submit assessment"]
  E --> S
  S --> M["Manager independent draft remains protected until submitted"]
  M --> D["Comparison and human discussion"]
  D --> X["Manager sets final rating"]
  X --> K["Employee acknowledges or reserves"]
  K --> Z["Immutable closure snapshot"]
```

AI never selects, predicts, challenges, normalizes, or recommends a rating.

## Manager Operations

```mermaid
flowchart TD
  H["Manager Home"] --> Q["Compact authorized operational queues"]
  Q --> I["Open one blocker/check-in/ownership/continuity item"]
  I --> B["Read safe reason, source, freshness, impact, allowed action"]
  B --> C{"Act here or in owner domain?"}
  C -->|Here| A["Confirm specific protected owner-domain command"]
  C -->|Deep link| D["Complete manual Project/check-in/continuity workflow"]
  A --> R["Reload authoritative state and resolve queue item"]
  D --> R
```

The queue excludes private connected context, private coaching, employee readiness percentages,
rankings, leaderboards, productivity scores, and predicted ratings.

## Admin and Operations Recovery

```mermaid
flowchart TD
  A["Admin Console / System Health"] --> S["Read safe status, impact, and required role"]
  S --> G{"External gate or internal recovery?"}
  G -->|External gate| X["Administrator setup required: consent/credential/provider/infrastructure"]
  G -->|Recoverable| R["Open authorized runbook or bounded retry/replay"]
  R --> V["Verify current state, version, idempotency, and audit reason"]
  V --> C["Execute explicit protected operation"]
  C --> E["Verify result and durable receipt"]
  S -->|Backup/restore| B["Show last verified evidence; no casual restore control"]
  B --> H["Direct human approval + credential/key custody gate"]
  H --> P["Protected restore runbook and integrity verification"]
```

System Administrator does not become manager, does not decide permanent reassignment, and does not
receive unrestricted private business content.

## Shared Recovery Vocabulary

- **Your draft is safe:** Retry assistance or continue manually.
- **Needs your review:** A source or relationship is ambiguous.
- **Connection needs attention:** Reconnect without duplicating imported items.
- **Changed since you opened it:** Reload the latest version; history remains intact.
- **You do not have access:** Explain required role/scope without exposing the resource.
- **Service temporarily unavailable:** Bounded retry and safe support reference.
- **Administrator setup required:** The user cannot close an external credential/consent gate.
