# Internal Beta Rollout

## Purpose

Release the daily employee experience gradually without creating extra employee work or granting AI
new authority. Rollout is an operational release-channel decision; permissions remain server-side and
unchanged.

## Cohorts

| Cohort                   | People                    | Enabled experience                                                 | Exit condition                                              |
| ------------------------ | ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| 0 — Dogfood              | Codex plus Product Owner  | Home, Project, Work, Capture, Review, receipts, source review      | Complete one realistic end-to-end workday and review issues |
| 1 — Small employee group | 3–5 willing employees     | Same daily baseline; external connectors only for consenting users | One working week without unresolved P0/P1 defects           |
| 2 — Department beta      | Remaining pilot employees | Approved capabilities only                                         | Weekly review accepts stability and support load            |

Use separate internal release channels or deployments for cohorts. Do not put employee identity lists
in source code. Access remains governed by the normal identity and authorization system.

## Feature flags

All flags are server-controlled and default on for the selected release artifact. Set a flag to
`false` in the affected cohort environment to use the retained route or manual fallback:

| Experience              | Flag                                     |
| ----------------------- | ---------------------------------------- |
| Final Home              | `AI_NATIVE_FINAL_HOME_ENABLED`           |
| Final Project           | `AI_NATIVE_FINAL_PROJECT_ENABLED`        |
| Final Work              | `AI_NATIVE_FINAL_WORK_ENABLED`           |
| Universal Capture       | `AI_NATIVE_FINAL_CAPTURE_ENABLED`        |
| Review and Confirmation | `AI_NATIVE_FINAL_REVIEW_ENABLED`         |
| Intelligent Today       | `AI_NATIVE_INTELLIGENT_TODAY_ENABLED`    |
| Work workspace          | `AI_NATIVE_WORK_WORKSPACE_ENABLED`       |
| Live receipts           | `AI_NATIVE_EXPERIENCE_STREAM_ENABLED`    |
| Source review           | `AI_NATIVE_SOURCE_REVIEW_ENABLED`        |
| Continuity workspace    | `AI_NATIVE_CONTINUITY_WORKSPACE_ENABLED` |

## Before enabling a cohort

1. Record release commit, cohort owner, active flags, and provider gates.
2. Verify login/logout, employee Home, Project, Work, Capture, confirmation, and manual fallback.
3. Confirm managers do not see employee-private source context or readiness percentages.
4. Confirm AI failure leaves manual work available and never produces ratings.
5. Give employees the short user guide and one support path.

## Rollback

For a surface regression, disable only its flag and retain the rest of the daily experience. For an
authorization/privacy defect, pause the affected cohort and follow `docs/runbooks/INCIDENT_RESPONSE.md`.
Database migrations remain forward-only; follow `docs/runbooks/DEPLOYMENT_ROLLBACK.md`.

## Product Owner gate

Expanding each cohort requires a visible journey review. This is a release decision, not an approval
for AI ratings, employee ranking, private-content telemetry, or automatic Project progress.
