# Security, Recovery & Production Readiness Engine Design

**Status:** Product Owner approved as part of the Complete Engine Program on 2026-08-05  
**Program:** E6C  
**Capability scope:** CAP-041–CAP-044 and T073–T077 technical gates

## 1. Outcome

Prove that the complete pilot engine can be monitored, secured, backed up, restored, and operated safely with explicit external gates and rollback procedures. This program hardens existing domains; it does not create a second policy, audit, identity, or data platform.

## 2. Threat model and security review

Maintain one current threat model covering:

- OIDC/session/callback state and deactivated-user denial;
- role/scope/acting-authority authorization;
- private Gmail/Calendar context and connector tokens;
- GitHub webhook/install credentials and untrusted repository content;
- upload/archive/malware and signed object reads;
- prompt injection, tool/input confusion, schema bypass, and AI-provider leakage;
- evaluation/upward-feedback/coaching/leave privacy;
- report/export artifact access;
- queue/job replay and idempotency abuse;
- audit tampering and administrative override abuse;
- backup exfiltration and destructive restore.

Every protected API receives positive and negative authorization tests. Credentials, access tokens, model keys, private content, and future private-mode originals are absent from logs and normal error payloads.

## 3. Retention and privacy controls

Versioned retention configuration supports organization/data-type policies, archive/hide state, legal/operational holds, and future deletion workflows. The pilot does not automatically delete historical records. Any future deletion implementation must preserve protected referential/audit requirements or replace content with an approved retained identity/tombstone model.

Future manager-feedback privacy modes remain disabled but their field isolation, fail-closed policy selection, topic suppression, identity-link separation, and audit-before-sensitive-read contracts are security-tested.

## 4. Observability

Structured logs, metrics, traces, queue/job health, dependency probes, and alerts use correlation/operation IDs and redaction. Required operational signals include API/worker availability, database/Redis/object-store latency, queue age/failure, connector health, AI route/provider failures, notification delivery, export generation, backup age, and authorization/audit anomalies.

Health endpoints expose only bounded liveness/readiness. Detailed diagnostics require System Administrator/operations authorization and still omit secrets/private payloads.

## 5. Backup

Define automated, encrypted, access-controlled backups for PostgreSQL, private object storage/version metadata, non-secret configuration, encryption-key recovery references, and required operational manifests. Record start/end, source versions, recovery point, integrity hashes, retention, and verification result without storing secrets in the repository.

Local/deterministic and production procedures are separate. Production destinations, credentials, schedules, and key custody are external gates.

## 6. Restore drill

Restore is a destructive protected human operation. The runbook requires:

1. explicit target environment and authorization;
2. preflight/maintenance mode and fresh safety backup;
3. database/object/config restore to an isolated or approved target;
4. migration/version compatibility checks;
5. audit-chain, historical foreign-key, closed-evaluation, upward-response, evidence/source, delegation/responsibility, and object integrity checks;
6. connector/queue replay isolation;
7. smoke journeys and reconciliation;
8. approval to promote or rollback.

No automated agent performs a destructive shared/production restore without direct human approval.

## 7. Performance and resilience

- Normal pilot list/detail requests target under 500 ms excluding external/AI work.
- Lists use pagination and bounded projections.
- Heavy analysis/report/sync work is durable and asynchronous.
- AI/provider/connector outage leaves stored records accessible and manual paths usable.
- Workers drain safely; retries do not duplicate authoritative effects.
- Load tests cover representative pilot concurrency, large history, timeline/report pagination, and queue pressure without turning operational metrics into employee analytics.

## 8. External gate register

Record owner, required action, secret location class, minimum permission, validation, rotation/revocation, recovery, and current state for OIDC, Google OAuth, GitHub App, object storage/ClamAV, Redis/workers, AI providers, email provider/domain, telemetry destination, backup target/key custody, and deployment infrastructure.

An adapter may be technically complete while live use remains `EXTERNAL_GATE`; the product must show truthful administrator-required recovery instead of simulated success.

## 9. Pilot dry run and rollback

Run one English `Calibration — Non-Baseline` simulated quarter with realistic users/projects/sources through protected interfaces. Include failures/retries, identified upward feedback, coaching, leave/delegation, deactivation/reassignment, notifications, exports, and restore evidence. Arabic evaluation is included only after T016; Arabic/RTL non-evaluation foundations continue to run.

Publish onboarding, support, incident, connector-revocation, queue-replay, export revocation, backup/restore, and deployment rollback runbooks. Product launch remains a Product Owner and external-administrator gate after final frontend acceptance.

## 10. Extensibility

Security controls attach to stable policy/action/resource identifiers. Probes, telemetry exporters, backup targets, deployment adapters, incident workflows, retention policies, and load profiles are replaceable through narrow interfaces. A future multi-tenant or private-mode design requires its own approved threat model rather than implicit reuse.

## 11. Verification

- Repository secret, AI boundary, performance-input, dependency, and protected-copy scans.
- Full authorization/privacy-mode and audit-atomicity suites.
- Prompt-injection/upload/archive/object-read tests.
- Queue replay/idempotency and provider/connector outage tests.
- Redaction/log/trace/health alert tests.
- Backup creation and isolated restore drill with integrity comparison.
- Supported-toolchain full `verify`, integration, AI, migration, and browser suites.
- Hosted required checks on the exact merge commit.

## 12. Exit gate

No unresolved P0/P1 remains; operational signals and alerts are active in the target environment or explicitly externally gated; backup/restore evidence and rollback runbooks exist; the technical dry run passes; and every external dependency is truthful, owned, and recoverable.
