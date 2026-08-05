# Security, Recovery & Production Readiness Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the completed engine is secured, observable, backed up, restorable, resilient, and operable with truthful external gates and protected rollback.

**Architecture:** Harden existing auth, permissions, audit, observability, queue, storage, AI, connector, reporting, and domain modules rather than adding a security platform. Add versioned retention metadata only where persistence is required; backup/restore/performance tooling remains bounded scripts and adapters. Destructive restore is always a direct human gate.

**Tech Stack:** Existing modular monolith, PostgreSQL/Prisma, Redis/workers, S3-compatible storage, OIDC, OpenTelemetry-compatible observability interfaces, Vitest, Playwright, repository scans, shell/PostgreSQL operational tooling.

## Global Constraints

- No secret, credential, access token, private source, private-mode original, model key, or signed artifact URL is logged or committed.
- Every protected API has positive and negative authorization evidence.
- Pilot retention does not automatically delete protected history.
- Future privacy modes remain disabled and fail closed; audit-before-sensitive-read is mandatory where applicable.
- Backups are encrypted and integrity-verified; production target, schedule, credential, and key custody remain external gates.
- No agent performs destructive shared/production restore without direct human authorization.
- Normal list/detail target is under 500 ms excluding external/AI work; large work is paginated/asynchronous.
- Outage preserves stored data and manual paths; retry/replay never duplicates authoritative effects.
- Operational metrics never become employee analytics.

---

### Task 1: Reconcile the threat model and protected-boundary test matrix

**Files:**

- Create: `docs/security/ENGINE_THREAT_MODEL.md`
- Create: `docs/security/PROTECTED_API_MATRIX.md`
- Create: `scripts/validate-protected-api-matrix.mjs`
- Create: `tests/repository/protected-api-matrix.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: every public API route, role/policy ID, data classification, audit action, and existing threat controls.
- Produces: machine-checked route→allow/deny/audit/privacy coverage and current threat owners.

- [ ] **Step 1: Write RED repository test**

```ts
expect(uncoveredProtectedRoutes).toEqual([]);
expect(matrix.every((row) => row.allowTest && row.denyTest && row.auditRule)).toBe(true);
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . tests/repository/protected-api-matrix.test.ts`; expect uncovered routes/missing matrix.

- [ ] **Step 3: Implement matrix validator and threat model**

Cover OIDC/session/deactivation, acting authority, Google/GitHub, uploads, prompt injection, evaluation/upward/coaching/leave, exports, queues, audit/admin, backup/restore. The validator derives route metadata from explicit module registration and fails on an unclassified protected route.

- [ ] **Step 4: Fill missing tests without changing product rules**

Add exact allow/deny/audit tests to owner integration files. Do not add hypothetical features; only close a missing approved boundary.

- [ ] **Step 5: Verify and commit**

Run matrix, authorization, audit atomicity, secret/AI/performance scans; commit `test: reconcile engine threat boundaries`.

---

### Task 2: Add versioned retention policy and privacy hardening

**Files:**

- Create: `packages/contracts/src/retention.ts`
- Create: `packages/contracts/src/retention.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0033_retention_policy/migration.sql`
- Create: `packages/config/src/retention-policy.ts`
- Create: `packages/config/src/retention-policy.integration.test.ts`
- Create: `tests/integration/private-mode-isolation.integration.test.ts`

**Interfaces:**

- Consumes: organization/data type, archive/hide/hold policy, admin reason/audit.
- Produces: versioned `RetentionPolicyVersion`, `RetentionHold`, and fail-closed privacy isolation contracts.

- [ ] **Step 1: Write RED tests**

```ts
expect(() =>
  RetentionPolicySchema.parse({ ...validPolicy, autoDeleteProtectedHistory: true }),
).toThrow();
expect(await privateProjection.readWithoutPolicy(input)).toMatchObject({ allowed: false });
```

- [ ] **Step 2: Run RED**

Run retention/private-mode tests.

- [ ] **Step 3: Implement additive policy models**

Store organization/data type, archive/hide interval, hold rules, version/effective date/status, creator/reason, and transition history. No deletion worker is added. Future deletion remains an explicit new approval.

- [ ] **Step 4: Harden private-mode isolation**

Test field isolation, unknown policy denial, identity-link separation, topic suppression, and pre-access audit hooks without enabling a private mode in the pilot.

- [ ] **Step 5: Verify and commit**

Run `pnpm db:verify`, retention/config tests, manager-feedback privacy tests, and scans; commit `feat: harden retention and privacy policies`.

---

### Task 3: Harden observability, redaction, probes, and alerts

**Files:**

- Create: `packages/observability/src/redaction.ts`
- Create: `packages/observability/src/redaction.test.ts`
- Create: `packages/observability/src/engine-signals.ts`
- Create: `packages/observability/src/engine-signals.test.ts`
- Create: `packages/observability/src/alert-evaluator.ts`
- Modify: API/worker health controllers and operation middleware
- Create: `tests/integration/observability-redaction.integration.test.ts`

**Interfaces:**

- Consumes: correlation/operation IDs, bounded dependency samples, typed error categories.
- Produces: redacted structured records, metrics/traces, bounded probes, alert events, admin-safe summary.

- [ ] **Step 1: Write RED leakage tests**

```ts
expect(JSON.stringify(redact(sample))).not.toMatch(/sk-|Bearer |refresh_token|private email body/);
expect(publicHealth).toEqual({ status: "ready" });
expect(adminHealth.dependencies[0]).not.toHaveProperty("rawError");
```

- [ ] **Step 2: Run RED**

Run observability tests.

- [ ] **Step 3: Implement signals/redaction/alerts**

Cover API/worker/database/Redis/object/OIDC/AI/connector/notification/export/backup age/authz/audit anomalies. Use allowlisted fields, bounded labels, correlation IDs, and thresholds from versioned config. Public health remains liveness/readiness only.

- [ ] **Step 4: Verify and commit**

Run redaction, health, error-payload, alert, and admin authorization tests; commit `feat: harden engine observability`.

---

### Task 4: Implement deterministic backup manifests and verification

**Files:**

- Create: `scripts/backup/create-engine-backup.mjs`
- Create: `scripts/backup/verify-engine-backup.mjs`
- Create: `scripts/backup/backup-manifest.schema.json`
- Create: `scripts/tests/test_backup_manifest.py`
- Create: `docs/runbooks/BACKUP.md`
- Modify: `package.json`

**Interfaces:**

- Consumes: PostgreSQL dump, object inventory/version metadata, non-secret config inventory, key-recovery references.
- Produces: encrypted backup bundle reference and signed/hash-verified manifest without secrets.

- [ ] **Step 1: Write RED manifest test**

```python
self.assertEqual(manifest["schemaVersion"], 1)
self.assertIn("databaseSha256", manifest)
self.assertNotIn("databasePassword", json.dumps(manifest))
```

- [ ] **Step 2: Run RED**

Run `python3 -m unittest scripts.tests.test_backup_manifest -v`; expect missing script/schema.

- [ ] **Step 3: Implement local deterministic adapter**

Require explicit local target, create consistent DB dump, inventory private objects/config versions, compute SHA-256 hashes, write start/end/recovery point/tool versions/verification result, and encrypt through a passed adapter. Never read or print secrets beyond process-required handles.

- [ ] **Step 4: Implement verification and runbook**

Verification checks schema, hashes, required inventories, age, and decryptability through the supplied key handle. Document production destination/schedule/key custody as `EXTERNAL_GATE`.

- [ ] **Step 5: Verify and commit**

Run manifest unit test, local backup/verify against synthetic environment, secret scan; commit `ops: add verified engine backups`.

---

### Task 5: Implement the protected isolated restore drill

**Files:**

- Create: `scripts/backup/restore-engine-backup.mjs`
- Create: `scripts/backup/verify-restored-engine.mjs`
- Create: `scripts/tests/test_restore_guard.py`
- Create: `docs/runbooks/RESTORE.md`
- Create: `docs/operations/RESTORE_DRILL_EVIDENCE.md`

**Interfaces:**

- Consumes: verified manifest, explicit isolated target, human authorization token/reference, maintenance/replay flags.
- Produces: restored isolated environment, integrity comparison, promotion/rollback decision evidence.

- [ ] **Step 1: Write RED destructive-operation guard test**

```python
result = run_restore(target="production", approval=None)
self.assertNotEqual(result.returncode, 0)
self.assertIn("direct human approval required", result.stderr)
```

- [ ] **Step 2: Run RED**

Run restore guard test; expect missing script.

- [ ] **Step 3: Implement fail-closed restore workflow**

Require exact environment, approval reference, maintenance mode, fresh safety backup, isolated/approved target, connector/queue replay disabled, and migration compatibility before restore. Default target is a generated local isolated database/object prefix only.

- [ ] **Step 4: Implement integrity comparison**

Compare audit chain, foreign keys, closed evaluations, upward responses, evidence/sources, responsibility/delegation windows, objects/hashes, schema version, and representative read journeys. Output pass/fail evidence without protected content.

- [ ] **Step 5: Execute isolated drill and commit**

Run guard tests, local backup, isolated restore, integrity verification, and smoke APIs. Record exact evidence; commit `ops: prove isolated engine restore`.

---

### Task 6: Prove performance, resilience, external gates, and rollback

**Files:**

- Create: `tests/performance/engine-pilot-load.test.ts`
- Create: `tests/integration/provider-outage-recovery.integration.test.ts`
- Create: `docs/operations/EXTERNAL_GATE_REGISTER.md`
- Create: `docs/runbooks/INCIDENT_RESPONSE.md`
- Create: `docs/runbooks/CONNECTOR_REVOCATION.md`
- Create: `docs/runbooks/QUEUE_REPLAY.md`
- Create: `docs/runbooks/EXPORT_REVOCATION.md`
- Create: `docs/runbooks/DEPLOYMENT_ROLLBACK.md`

**Interfaces:**

- Consumes: all list/detail readers, queues, external adapters, operation receipts.
- Produces: latency/pagination/retry evidence and owned external-gate/rollback procedures.

- [ ] **Step 1: Write RED performance/outage tests**

```ts
expect(p95(normalReadDurations)).toBeLessThan(500);
expect(await manualPathAfterAiOutage()).toMatchObject({ available: true });
expect(await replay(jobEnvelopeTwice)).toEqual(firstEffectReceipt);
```

- [ ] **Step 2: Run RED/baseline**

Run focused performance and outage tests; record any failing endpoint/queue rather than weakening thresholds.

- [ ] **Step 3: Apply bounded fixes**

Add only missing pagination/index/batch/timeout/circuit/manual-recovery behavior confirmed by tests. Do not cache protected data across authorization contexts or derive employee metrics.

- [ ] **Step 4: Complete gate register/runbooks**

Record owner/action/secret class/minimum permission/validation/rotation/revocation/recovery/state for OIDC, Google, GitHub, storage/ClamAV, Redis, AI, email, telemetry, backup, and deployment. Mark truthful `EXTERNAL_GATE` values.

- [ ] **Step 5: Verify and commit**

Run load/outage/replay tests and runbook link checks; commit `perf: prove engine resilience and gates`.

---

### Task 7: Execute the technical pilot dry run and E6C checkpoint

**Files:**

- Create: `scripts/seed-engine-dry-run.ts`
- Create: `tests/e2e/engine-technical-dry-run.spec.ts`
- Create: `docs/acceptance/ENGINE_TECHNICAL_DRY_RUN.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html`

**Interfaces:**

- Consumes: E0–E6B complete engine and E6C tooling.
- Produces: complete technical dry-run evidence and readiness state for E7.

- [ ] **Step 1: Seed and run the English simulated quarter**

Exercise daily work, sources, Research/Experiments, progress, E4, E5A, coaching, leave/delegation, deactivation/reassignment, notifications, export, failures/retries, backup, and isolated restore through protected interfaces. Non-evaluation Arabic/RTL remains included; Arabic evaluation stays gated.

- [ ] **Step 2: Run full supported verification**

Run `pnpm verify`, integration, AI, migration, browser, protected matrix, backup/restore, load, and repository scans under Node 24.18.0/pnpm 11.13.0. Record exact counts/skips/durations.

- [ ] **Step 3: Run one critical security review**

One specification/security review covers threat model, retention, observability, backup/restore, external gates, and dry run. Remediate confirmed P0/P1 only and re-review corrected findings.

- [ ] **Step 4: Record and checkpoint**

Update CAP-041–044/T073–077 evidence and operational state, commit `ops: complete security recovery readiness`, push, update PR, and require hosted checks on the exact candidate merge commit.
