# Notifications, Reporting & Administration Engine Design

**Status:** Product Owner approved as part of the Complete Engine Program on 2026-08-05  
**Program:** E6B  
**Capability scope:** CAP-032, CAP-039–CAP-041, T053, and T071–T073

## 1. Outcome

Deliver users the smallest timely next action, generate authorized immutable-source reports, and let a separate System Administrator operate configuration and health safely—without duplicating domain authority or exposing secrets/private content.

## 2. Boundaries

Use three bounded capabilities inside one operational program:

1. Notification Delivery owns notification intents, preferences, schedules, delivery attempts, read/resolution state, dedupe, and channel adapters.
2. Reporting & Export owns export requests, immutable report manifests, generated artifacts, expiry/revocation, and download audit; source domains own report data projections.
3. Administration Composition exposes protected configuration/health commands and read models over owner-domain public interfaces; it does not become a second configuration database.

## 3. Notification design

Initial channels are in-app and email. Domain events or scheduled obligation readers create versioned notification intents with recipient, reason, safe template key/arguments, target action, delivery window, urgency, dedupe key, and source event.

Supported categories include check-ins, monthly readiness, document/criteria review, evidence/attribution, evaluation stages, identified upward submission, coaching/shared plans, leave/handover/delegation/return, reassignment, connector state, AI/manual-recovery failure, export readiness, and system-admin health.

Notification rules never calculate performance or shame by activity volume. Preferences may silence optional channels but cannot suppress configured critical security/ownership alerts. Exact Thursday and monthly schedules are versioned pilot configuration.

## 4. Delivery and recovery

Intent creation is idempotent. In-app notification persists independently of email delivery. Channel workers record attempt, provider receipt, failure category, next retry, sent/failed state, and correlation without storing credentials or excess content. Permanent failure preserves an in-app recovery action.

Deep links target the smallest authorized action and reauthorize on open. A notification never proves that its target still exists or that the recipient still has access.

## 5. Reporting and exports

Source domains expose immutable, audience-specific projections:

- Employee Evaluation: employee cycle and department evaluation projections.
- Manager Evaluation: Identified pilot upward report projection.
- Coaching: approved development-plan projection.
- Continuity/Projects/Daily Work: operational context allowed by report policy.

Export request pins projection/schema/locale/cycle/source-snapshot versions and audience. Generation is asynchronous, reproducible, and audited. Artifacts are private, encrypted through approved storage, time-limited, revocable, and reauthorized before every signed read.

English employee evaluation exports are permitted. Arabic evaluation exports remain blocked until T016. Non-evaluation Arabic/English rendering, bidi, PDF/DOCX/media references, and timezone behavior remain tested.

Department reports may show distributions, criterion trends, skills/development themes, blockers, training needs, Project-type patterns, and operational documentation states. They never show employee ranking, protected readiness values, or inferred ratings.

## 6. Administration composition

The System Administrator can manage permitted user/technical roles, organization configuration, organization templates, localization versions, integrations, AI routes/overrides, notification schedules/templates, retention policies, audit queries, export operations, and system health.

Each mutation delegates to the owning domain, validates expected version, records a reason where required, and audits atomically. System Administrator remains distinct from manager and cannot evaluate employees, read manager feedback content merely by role, change active-cycle visibility, activate unapproved Arabic rubric content, or reassign Projects.

## 7. Health and operational projection

Admin-safe health composes API/worker/database/queue/object-storage/OIDC/AI-route/connector/email/backup-recency states into `HEALTHY`, `DEGRADED`, or `ACTION_REQUIRED` with a bounded next step and correlation reference. It does not expose tokens, credentials, raw logs, private prompts, email/calendar content, or evaluation comments.

Normal list/detail API targets remain under 500 ms at pilot scale; heavy report/delivery/analysis work stays asynchronous and paginated.

## 8. Authorization and privacy

- Recipient-only notification inbox and preference access.
- Export allowlists by report type/audience with access audit before artifact return.
- System Administrator policies separate configuration, health, audit, and restricted operations.
- Manager and employee dashboards consume safe composition projections, never the admin API.
- Email content uses minimal safe information and avoids sensitive details when a deep link can reauthorize them.

## 9. Extensibility

Notification categories, template versions, channels, schedules, criticality, preference rules, report types, formats, locale renderers, storage/email adapters, admin capabilities, and health probes have explicit versioned interfaces. Slack/Teams/WhatsApp or new export formats can be added through adapters without changing source domains.

## 10. Verification

- Intent dedupe, schedule, preference, retry, and deep-link authorization tests.
- Email adapter contract and local deterministic delivery tests; live provider remains an external gate.
- Report projection allowlist, snapshot pinning, generation retry, expiry/revocation, and access-audit tests.
- English report render/visual tests plus non-evaluation Arabic/RTL; Arabic evaluation remains gated.
- System Administrator positive/negative role-separation and override-reason tests.
- Health/redaction/performance/pagination tests.
- End-to-end event → in-app/email attempt → authorized action and closed evaluation → private report download journeys.

## 11. Exit gate

All required domain events produce deduplicated recoverable notifications, representative reports generate from immutable authorized projections, admin configuration/health flows enforce role separation, and no secret/private/ranking/readiness leakage or unresolved P0/P1 remains.
