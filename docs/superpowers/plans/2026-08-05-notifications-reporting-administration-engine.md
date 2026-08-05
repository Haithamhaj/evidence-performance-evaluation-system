# Notifications, Reporting & Administration Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver deduplicated actionable notifications, authorized reproducible exports, and safe System Administrator composition without moving authority out of source domains.

**Architecture:** Add three narrow packages: `@evaluation/notifications`, `@evaluation/reporting`, and `@evaluation/administration`. Notifications owns intents/preferences/attempts; Reporting owns export requests/manifests/artifacts; Administration composes owner-domain commands and safe health. Source domains retain facts/configuration authority, and email/object-storage/health providers remain replaceable adapters.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7.0.2, NestJS API/worker, Next.js verification routes, Prisma/PostgreSQL, Redis/BullMQ foundation, object-storage adapters, Zod, Vitest, Playwright.

## Global Constraints

- Notification content contains the smallest safe next action; every deep link reauthorizes on open.
- Notification rules never shame, score, rank, or infer performance from activity volume.
- In-app intent persists independently of email failure; retries never duplicate authoritative effects.
- Export generation pins projection/schema/locale/cycle/source versions and reauthorizes every download.
- English evaluation exports are allowed; Arabic evaluation exports remain blocked until T016.
- Artifacts are encrypted, private, expiring, revocable, and audited; no secret/private payload appears in logs.
- System Administrator is separate from Manager and cannot evaluate, read feedback content merely by role, activate unapproved Arabic rubric, change active-cycle visibility, or reassign Projects.
- Administration delegates mutations to owner domains; it is not a second configuration database.
- Normal list/detail targets remain under 500 ms; report/delivery work is asynchronous and paginated.

---

### Task 1: Define contracts and three package boundaries

**Files:**

- Create: `packages/contracts/src/notifications.ts`
- Create: `packages/contracts/src/reporting.ts`
- Create: `packages/contracts/src/administration.ts`
- Create: corresponding contract tests; modify contracts index
- Create: `packages/notifications/{package.json,tsconfig.json,src/index.ts}`
- Create: `packages/reporting/{package.json,tsconfig.json,src/index.ts}`
- Create: `packages/administration/{package.json,tsconfig.json,src/index.ts}`
- Modify: root/API/web/worker manifests and `pnpm-lock.yaml`

**Interfaces:**

- Consumes: domain event identity, user/role scope, object-storage reference, health probe shape.
- Produces: notification intent/delivery, export request/manifest, admin command/health schemas.

- [ ] **Step 1: Write RED contract tests**

```ts
expect(NotificationUrgencySchema.parse("ACTION_REQUIRED")).toBe("ACTION_REQUIRED");
expect(() => NotificationIntentSchema.parse({ ...validIntent, employeeScore: 82 })).toThrow();
expect(() =>
  ExportManifestSchema.parse({ ...validManifest, signedUrl: "https://secret" }),
).toThrow();
```

- [ ] **Step 2: Run RED**

Run the three contract test files; expect missing modules.

- [ ] **Step 3: Implement strict schemas**

```ts
export const DeliveryChannelSchema = z.enum(["IN_APP", "EMAIL"]);
export const NotificationUrgencySchema = z.enum([
  "INFORMATION",
  "ACTION",
  "ACTION_REQUIRED",
  "CRITICAL",
]);
export const ExportStateSchema = z.enum([
  "REQUESTED",
  "GENERATING",
  "READY",
  "FAILED",
  "EXPIRED",
  "REVOKED",
]);
export const AdminHealthStateSchema = z.enum(["HEALTHY", "DEGRADED", "ACTION_REQUIRED"]);
```

Define versioned categories/template arguments/deep links/dedupe/preferences/attempts, report types/audiences/formats/pinned sources/artifact descriptors, and admin capabilities/expected versions/reasons/health dependencies. Exclude tokens, raw logs, private prompt/content, ratings recommendations, ranks, and readiness values.

- [ ] **Step 4: Add packages, verify, commit**

Run lockfile update, tests, four package typechecks, scans; commit `feat: define operations contracts`.

---

### Task 2: Add the forward-only operations schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0032_operations_delivery_reporting/migration.sql`
- Create: `packages/database/src/operations-delivery-schema.integration.test.ts`
- Modify: `scripts/run-integration-tests.mjs`

**Interfaces:**

- Consumes: users, operations, audit, source event IDs.
- Produces: notification intents/preferences/attempts/read states, export request/manifest/artifact/access/revocation, admin mutation receipt references, probe history.

- [ ] **Step 1: Write RED schema test**

```ts
expect(tableNames).toEqual(
  expect.arrayContaining([
    "NotificationIntent",
    "NotificationPreference",
    "NotificationDeliveryAttempt",
    "ExportRequest",
    "ExportManifest",
    "ExportArtifact",
    "ExportAccessEvent",
    "ExportRevocation",
  ]),
);
```

- [ ] **Step 2: Run RED**

Run new schema test; expect missing tables.

- [ ] **Step 3: Implement constraints**

Unique notification dedupe `(recipientId, category, dedupeKey)`, unique export idempotency `(requesterId, idempotencyKey)`, append-only attempts/access/revocations, expiring artifact metadata, safe provider receipt, indexes on unread/due-retry/ready-expiry. Do not store provider credentials or signed URLs.

- [ ] **Step 4: Verify and commit**

Run `pnpm db:verify` plus schema test; commit `feat: add notification and export schema`.

---

### Task 3: Implement intent creation, preferences, schedules, and delivery

**Files:**

- Create: `packages/notifications/src/intent-service.ts`
- Create: `packages/notifications/src/intent-service.integration.test.ts`
- Create: `packages/notifications/src/preference-service.ts`
- Create: `packages/notifications/src/delivery-service.ts`
- Create: `packages/notifications/src/delivery-service.integration.test.ts`
- Create: `packages/notifications/src/adapters/in-memory-email.ts`
- Create: `apps/worker/src/notifications/notification-delivery.processor.ts`
- Create: `apps/worker/src/notifications/notifications.module.ts`
- Modify: `apps/worker/src/app.module.ts`

**Interfaces:**

- Consumes: versioned domain events/scheduled-obligation readers, recipient resolver, email adapter, queue/audit ports.
- Produces: `NotificationIntentService.create`, inbox reader, preferences, `NotificationDeliveryService.deliver`.

- [ ] **Step 1: Write RED dedupe/retry tests**

```ts
expect(await service.create(inputTwice)).toEqual(firstIntent);
expect((await delivery.deliver(intentId)).inAppState).toBe("READY");
expect((await delivery.deliverWithEmailFailure(intentId)).emailState).toBe("RETRY_SCHEDULED");
```

- [ ] **Step 2: Run RED**

Run notifications integration tests.

- [ ] **Step 3: Implement intent/preference/schedule logic**

Support approved categories from check-ins through system health. Required security/ownership alerts ignore optional channel mute; other preferences control email only, not authoritative state. Thursday/monthly schedules are explicit versioned configuration.

- [ ] **Step 4: Implement worker delivery**

Create in-app state before email. Record attempt/provider receipt/failure category/next retry/correlation. Permanent failure preserves the in-app recovery action. Reauthorize only when the target is opened, never when the intent is generated.

- [ ] **Step 5: Verify and commit**

Run dedupe/schedule/preference/retry/deep-link/revoked-access/redaction tests; commit `feat: deliver actionable notifications`.

---

### Task 4: Implement reproducible report generation and protected artifacts

**Files:**

- Create: `packages/reporting/src/export-service.ts`
- Create: `packages/reporting/src/export-service.integration.test.ts`
- Create: `packages/reporting/src/projection-registry.ts`
- Create: `packages/reporting/src/renderers/html.ts`
- Create: `packages/reporting/src/renderers/pdf.ts`
- Create: `packages/reporting/src/artifact-access-service.ts`
- Create: `apps/worker/src/reporting/export.processor.ts`
- Create: `apps/worker/src/reporting/reporting.module.ts`
- Modify: `apps/worker/src/app.module.ts`
- Create: `tests/integration/export-artifact-authorization.integration.test.ts`

**Interfaces:**

- Consumes: immutable audience-specific readers from E4/E5A/E5B/Continuity/Projects/Daily Work, approved object storage.
- Produces: `ExportService.request/generate/retry/revoke`, artifact manifest, authorized download descriptor.

- [ ] **Step 1: Write RED snapshot/access tests**

```ts
expect(manifest.sourceVersions).toEqual(expectedPinnedVersions);
expect(await access.open(otherEmployee, artifactId)).toMatchObject({ allowed: false });
expect(await access.open(ownerAfterExpiry, artifactId)).toMatchObject({
  allowed: false,
  reason: "EXPIRED",
});
```

- [ ] **Step 2: Run RED**

Run reporting and artifact authorization integration tests.

- [ ] **Step 3: Implement projection allowlist and generation**

Register exact report type→audience→source reader→locale/format mappings. Reject Arabic evaluation reports until T016. Pin source/schema/locale/cycle versions before queueing. Render deterministic English evaluation and bilingual non-evaluation HTML/PDF with UTC→user timezone conversion and bidi-safe technical text.

- [ ] **Step 4: Implement artifact protection**

Write encrypted private object through existing storage interface, persist hash/size/type/expiry, and create a short-lived signed descriptor only after current authorization plus access audit. Revoke/expire without deleting immutable manifest.

- [ ] **Step 5: Verify and commit**

Run reproducibility, retry, expiry/revocation, cross-role denial, Arabic gate, visual render, and audit tests; commit `feat: generate protected reports`.

---

### Task 5: Implement System Administrator composition and safe health

**Files:**

- Create: `packages/administration/src/admin-command-service.ts`
- Create: `packages/administration/src/admin-command-service.integration.test.ts`
- Create: `packages/administration/src/health-composition.ts`
- Create: `packages/administration/src/health-composition.test.ts`
- Create: `packages/administration/src/ports.ts`
- Modify: `packages/administration/src/index.ts`
- Modify: `packages/observability/src/health.ts`
- Modify: `packages/observability/src/index.ts`

**Interfaces:**

- Consumes: owner-domain admin commands, expected-version/reason, bounded dependency probes.
- Produces: `AdminCommandService.execute` and `AdminHealthComposition.read`.

- [ ] **Step 1: Write RED role/separation tests**

```ts
await expect(admin.evaluateEmployee(input)).rejects.toMatchObject({ code: "AUTHZ_ACTION" });
await expect(admin.reassignProject(input)).rejects.toMatchObject({ code: "AUTHZ_ACTION" });
expect(health).not.toHaveProperty("databaseUrl");
```

- [ ] **Step 2: Run RED**

Run administration tests.

- [ ] **Step 3: Implement delegated mutation composition**

Allow only explicit capability IDs for users/technical roles, organization configuration/templates, permitted localization, integrations, AI routes/overrides, notifications, retention, audit query, exports, and health. Resolve owner command, validate expected version, require reason where policy says, and audit in the owner's transaction.

- [ ] **Step 4: Implement bounded health projection**

Compose API/worker/database/queue/object/OIDC/AI/connector/email/backup recency into `HEALTHY|DEGRADED|ACTION_REQUIRED`, next action, and correlation reference. Redact secrets, raw logs, prompts, connected content, and evaluation comments.

- [ ] **Step 5: Verify and commit**

Run positive/negative roles, override reason, active-cycle/Arabic/reassignment denial, health redaction/pagination/latency tests; commit `feat: compose safe system administration`.

---

### Task 6: Expose APIs, worker composition, and end-to-end operations journey

**Files:**

- Create: `apps/api/src/operations/operations.module.ts`
- Create: `apps/api/src/operations/notifications.controller.ts`
- Create: `apps/api/src/operations/exports.controller.ts`
- Create: `apps/api/src/operations/administration.controller.ts`
- Create: `apps/api/src/operations/operations-policy.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/web/src/platform/operations-client.ts`
- Create: `apps/web/src/app/[locale]/notifications/page.tsx`
- Create: `apps/web/src/app/[locale]/admin/operations/page.tsx`
- Create: `tests/integration/operations-api.integration.test.ts`
- Create: `tests/e2e/notifications-reporting-administration.spec.ts`

**Interfaces:**

- Consumes: Tasks 1–5 services.
- Produces: recipient inbox/preferences, export lifecycle/download, and System Administrator configuration/health routes.

- [ ] **Step 1: Write RED API tests**

```ts
expect(await api.readNotification(otherEmployee, intentId)).toMatchObject({ status: 403 });
expect(await api.downloadExport(otherManager, artifactId)).toMatchObject({ status: 403 });
expect(await api.readAdminHealth(managerToken)).toMatchObject({ status: 403 });
```

- [ ] **Step 2: Run RED**

Run operations API integration test.

- [ ] **Step 3: Implement protected routes and verification UI**

Show event→in-app action→email attempt/recovery; request→generate→download→revoke report; and safe admin command/health states. Every action validates current role/scope and expected version. UI hides technical identifiers/provider errors.

- [ ] **Step 4: Verify and commit**

Run package/API/worker/Playwright tests and typechecks; commit `feat: expose notification reporting administration`.

---

### Task 7: Complete the E6B acceptance checkpoint

**Files:**

- Create: `scripts/seed-operations-acceptance.ts`
- Create: `docs/acceptance/NOTIFICATIONS_REPORTING_ADMINISTRATION_ENGINE.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`

**Interfaces:**

- Consumes: full E6B surface.
- Produces: CAP-032/CAP-039–041 and T053/T071–073 evidence.

- [ ] **Step 1: Seed deterministic events/reports/failures**

Include one deduplicated check-in intent, email retry, critical reassignment alert, closed E4 report, revoked artifact, degraded connector, and safe admin next action.

- [ ] **Step 2: Run related suites and critical reviews**

Run migration, package, API, worker, rendering, Playwright, authorization, audit, redaction, performance, lint/typecheck, and protected scans. Request one spec review and one security/privacy review; fix confirmed P0/P1 only.

- [ ] **Step 3: Record and checkpoint**

Document exact results/external email gate, update tasks/state, commit `feat: complete operations engine`, push, and update PR.
