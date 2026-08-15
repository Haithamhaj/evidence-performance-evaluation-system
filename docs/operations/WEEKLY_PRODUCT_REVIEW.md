# Weekly Internal Product Review

## Goal

Improve the product while keeping product feedback separate from employee performance. Review the
system, not the people using it.

## Inputs

- Aggregate suggestion categories: Helpful, Wrong Project, Wrong Source relation, Unnecessary,
  Missing context, Bad draft, Wrong timing, and Technical error.
- Provider and recovery incidents using safe reason codes only.
- Support issues and repeated usability friction.
- Release health, queue recovery, and connector status.
- Product telemetry only after its external privacy/retention gate is approved.

Never include employee rankings, individual readiness values, ratings, private source bodies, prompt
content, raw navigation trails, activity counts, or time-on-task.

## Product metrics

| Metric                       | Meaning                                                             | Safe source                                       | Guardrail                           |
| ---------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Helpful suggestion share     | Whether prepared assistance is understandable                       | Aggregate suggestion-feedback categories          | Never shown per employee            |
| Correction category mix      | Where product interpretation needs work                             | Aggregate non-helpful categories                  | No source/draft body                |
| Manual fallback availability | Whether work remains possible during outage                         | Approved content-free telemetry or incident check | No productivity inference           |
| Decision burden              | Number of product decisions required to finish the intended journey | Approved aggregate journey event                  | Not a measure of employee behavior  |
| Administrative work avoided  | Confirmed workflow steps removed by the product                     | Bounded product study                             | Never inferred from activity volume |
| Recovery completion          | Whether a failed product path returned to a usable state            | Safe recovery reason/result                       | No identity in review output        |

Until the telemetry external gate is approved, review suggestion categories and incidents only. Do
not simulate missing measurements or read protected domain tables as a substitute.

## 30-minute agenda

1. Check unresolved P0/P1 product defects and provider incidents.
2. Review aggregate suggestion categories and the top three friction themes.
3. Select at most one bounded product correction and one documentation correction.
4. Assign owner and acceptance evidence; defer hypothetical hardening.
5. Decide whether the current cohort expands, remains, or rolls back.

## Decision log

Record date, release commit, cohort, aggregate evidence, decision, owner, and next review date. Do not
record private employee content in this document.
