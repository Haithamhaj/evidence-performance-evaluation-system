# Full Engine Integration Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile every approved capability against production evidence, prove all cross-domain technical journeys, and issue a truthful `READY_FOR_FINAL_FRONTEND_DESIGN` or `NOT_READY` decision.

**Architecture:** E7 adds no product feature, schema, or domain package. It consumes all merged engine contracts, tests, migrations, acceptance evidence, operational drills, and external gates; machine-readable registers and integration tests expose gaps. Confirmed P0/P1 defects return to the owning subsystem for one bounded fix and focused re-verification.

**Tech Stack:** Existing Node/TypeScript monorepo, Vitest, Playwright, Prisma/PostgreSQL, repository validators, Markdown/HTML operational artifacts, GitHub Actions.

## Global Constraints

- No pilot capability remains `PLANNED` at exit.
- Allowed final states: `COMPLETE`, approved `PARTIAL`, `EXTERNAL_GATE`, `DEFERRED_APPROVED`, `SUPERSEDED`.
- Counts are inventory only, never completion scores or employee metrics.
- Every authoritative requirement maps to implementation evidence, and every public implementation maps to an approved requirement.
- E7 does not refactor architecture or add features.
- Full employee, manager, Project owner, and System Administrator journeys run without direct database edits.
- ClickUp is a clean-room future interaction reference only; it adds no engine task/integration/code dependency.
- Final frontend work starts only after Product Owner review of a `READY_FOR_FINAL_FRONTEND_DESIGN` audit.

---

### Task 1: Reconcile the feature register and capability matrix

**Files:**

- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Create: `scripts/validate-engine-capability-register.mjs`
- Create: `tests/repository/engine-capability-register.test.ts`

**Interfaces:**

- Consumes: `CAP-nnn`, T001–T077, authoritative document references, owner package/API, migration, tests, acceptance, and external-gate IDs.
- Produces: one validated row per capability with exact final state/reason/evidence.

- [ ] **Step 1: Write RED register validation**

```ts
expect(rows.filter((row) => row.state === "PLANNED")).toEqual([]);
expect(rows.filter((row) => row.state === "COMPLETE" && row.code.length === 0)).toEqual([]);
expect(rows.filter((row) => row.state === "EXTERNAL_GATE" && !row.gateId)).toEqual([]);
```

- [ ] **Step 2: Run RED**

Run `pnpm exec vitest run --root . tests/repository/engine-capability-register.test.ts`; expect incomplete/invalid rows.

- [ ] **Step 3: Implement validator and reconcile rows**

Require `capabilityId`, source section, task IDs, owner, state, reason, contracts, production code, migration, tests, acceptance, external gate, user roles, AI boundary, human gate, visibility, history, recovery, and frontend moment. `PARTIAL`/`DEFERRED_APPROVED` require explicit approval reference.

- [ ] **Step 4: Verify and commit**

Run validator, task graph, and link/path existence checks; commit `docs: reconcile engine capabilities`.

---

### Task 2: Add bidirectional trace and architecture-boundary audit

**Files:**

- Create: `docs/reviews/ENGINE_BIDIRECTIONAL_TRACE.md`
- Create: `scripts/audit-engine-trace.mjs`
- Create: `tests/repository/engine-trace.test.ts`
- Modify: `scripts/validate-boundaries.mjs`

**Interfaces:**

- Consumes: authoritative numbered rules, capability rows, public routes/commands/events/AI routes/configuration/jobs.
- Produces: source→capability→code and code→capability→source trace plus orphan/duplicate/boundary findings.

- [ ] **Step 1: Write RED trace tests**

```ts
expect(unmappedAuthoritativeRules).toEqual([]);
expect(orphanPublicContracts).toEqual([]);
expect(directCrossDomainPrismaReads).toEqual([]);
expect(unversionedPublicSchemas).toEqual([]);
```

- [ ] **Step 2: Run RED**

Run repository trace/boundary tests; record concrete gaps.

- [ ] **Step 3: Implement audit extraction**

Read explicit register metadata and repository exports/routes; detect duplicate evidence/activity stores, direct foreign-domain table reads, hidden frontend-only rules, dead provisional routes, provider SDK calls, and public schemas/events/jobs without a version.

- [ ] **Step 4: Resolve findings by classification**

Documentation-only gaps are corrected in E7. Functional P0/P1 returns to the named owner subsystem with a focused test/fix/commit; P2/P3 enters backlog without reopening full reviews.

- [ ] **Step 5: Verify and commit**

Run trace, boundary, AI, performance-input, localization, and secret scans; commit `test: audit engine bidirectional trace`.

---

### Task 3: Build one stable cross-domain acceptance fixture

**Files:**

- Create: `scripts/seed-complete-engine-acceptance.ts`
- Create: `tests/e2e/fixtures/complete-engine.ts`
- Create: `tests/integration/complete-engine-fixture.integration.test.ts`
- Modify: `packages/database/src/seed-pilot.ts`

**Interfaces:**

- Consumes: public seed/admin commands from all completed domains.
- Produces: idempotent organization/department/users/projects/sources/research/evaluation/coaching/continuity/operations/failure fixture.

- [ ] **Step 1: Write RED idempotency/prohibition tests**

```ts
expect(await seedTwice()).toEqual(firstSeedReceipt);
expect(await countRows("EmployeeRanking")).toBe(0);
expect(serializedFixture).not.toMatch(
  /productivityScore|suggestedRating|managerReadinessPercentage/,
);
```

- [ ] **Step 2: Run RED**

Run fixture integration test; expect missing seed.

- [ ] **Step 3: Implement through public commands**

Create one organization/department, System Administrator, manager, Codex employee, peers, Projects/Workstreams, documents/contracts/criteria, Tasks, sources, Research/two Experiments, evidence, cycle snapshots, identified upward feedback, coaching, leave/delegation, notifications, reports, and operational failures. Use deterministic external IDs and idempotency keys; no direct post-seed row mutation.

- [ ] **Step 4: Verify and commit**

Run fixture twice against reset and existing DB, then migration and prohibited-field scans; commit `test: seed complete engine acceptance`.

---

### Task 4: Prove cross-domain seams and complete role journeys

**Files:**

- Create: `tests/integration/engine-cross-domain-seams.integration.test.ts`
- Create: `tests/e2e/complete-employee-engine.spec.ts`
- Create: `tests/e2e/complete-manager-engine.spec.ts`
- Create: `tests/e2e/complete-project-owner-engine.spec.ts`
- Create: `tests/e2e/complete-system-admin-engine.spec.ts`
- Create: `docs/acceptance/COMPLETE_ENGINE_TECHNICAL_JOURNEYS.md`

**Interfaces:**

- Consumes: Task 3 fixture and all protected API routes.
- Produces: executable evidence for every cross-domain seam and role.

- [ ] **Step 1: Write RED seam assertions**

```ts
expect(progressAfterRawGitHubVolume).toBe(progressBeforeRawGitHubVolume);
expect(factView.researchFacts).toContainEqual(
  expect.objectContaining({ conclusion: "NOT_SUPPORTED" }),
);
expect(finalEvaluation.managerDecisionSource).toBe("HUMAN_MANAGER");
expect(expiredDelegation.authorization).toBe("DENY");
```

- [ ] **Step 2: Run RED**

Run seam integration and four Playwright files; record missing links only.

- [ ] **Step 3: Complete employee journey**

Today→connected context→confirmed Task→text/voice/file update→GitHub evidence→contract progress→Research/two Experiments/inconclusive preservation→applied learning→check-in/readiness→leave/handover/return→self assessment→comparison/acknowledgment or reservation→identified upward submission→coaching action.

- [ ] **Step 4: Complete manager/owner/admin journeys**

Manager: operational queues, progress ambiguity, leave/delegation, independent assessment, final human decision, identified originals, shared coaching, reassignment. Project owner: documents/contracts/criteria/progress. Administrator: configuration/override reasons, safe audit/health, deactivation without reassignment, export/revocation, retry visibility, isolated restore evidence.

- [ ] **Step 5: Verify and commit**

Run all seams/journeys at desktop and 390 px where user-facing, English plus approved Arabic/RTL shell coverage; commit `test: prove complete engine journeys`.

---

### Task 5: Execute the final verification and bounded review gate

**Files:**

- Create: `docs/reviews/ENGINE_FINAL_VERIFICATION.md`
- Create: `docs/reviews/ENGINE_P2_P3_BACKLOG.md`
- Modify: `.github/workflows/ci.yml` only if an approved existing verification command is missing from required checks

**Interfaces:**

- Consumes: exact candidate merge commit and supported toolchain.
- Produces: exact local/hosted verification evidence and zero unresolved P0/P1.

- [ ] **Step 1: Run the full supported local suite**

Run:

```bash
pnpm verify
pnpm test:integration
pnpm test:ai
pnpm db:verify
pnpm test:e2e
```

Also run protected API matrix, trace, backup/restore, load/resilience, and task-graph commands. Record Node 24.18.0/pnpm 11.13.0, exact counts, skips, failures, and durations.

- [ ] **Step 2: Request exactly two final reviews**

One specification/trace review and one security/privacy/integrity/operations review. A finding blocks only when it violates an approved criterion/protected rule or is P0/P1.

- [ ] **Step 3: Perform one bounded remediation cycle**

Return each confirmed P0/P1 to its owner, add focused regression, implement the smallest fix, run affected suites, and re-review corrected findings only. Record P2/P3 in backlog.

- [ ] **Step 4: Verify hosted required checks**

Push the exact candidate commit and require integrity, quality, build, integration, and any approved final-engine gate to pass. Do not infer hosted success from local results.

- [ ] **Step 5: Commit evidence**

Commit `test: record final engine verification` after all evidence references the exact commit.

---

### Task 6: Publish the completion audit and frontend handoff

**Files:**

- Create: `docs/reviews/ENGINE_COMPLETION_AUDIT.md`
- Create: `docs/product/ENGINE_CUSTOMER_JOURNEY_MAP.md`
- Modify: `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Modify: `project-state/SYSTEM_MAP.html`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `TASKS.md`

**Interfaces:**

- Consumes: reconciled register, journeys, final verification/reviews, external gates.
- Produces: `READY_FOR_FINAL_FRONTEND_DESIGN` or `NOT_READY` with exact blockers.

- [ ] **Step 1: Write the audit from evidence**

Separate production engine, deterministic fixtures, provisional verification UI, live external configuration, and deferred final frontend. Every capability row links exact code/test/gate evidence; no completion percentages are generated.

- [ ] **Step 2: Publish customer-journey and handoff metadata**

For each capability record primary user moment/action, read/write contract, AI role/prohibition, human gate, states, recovery, notification, responsive/localization/accessibility needs, and protected visibility. Carry the approved ClickUp reference patterns and exclusions from `2026-08-05-clickup-interaction-reference-design.md`; do not derive navigation from package names.

- [ ] **Step 3: Run extensibility and simplification audit**

Confirm configuration inheritance, schema compatibility, adapter boundaries, prior-version reads, migration paths, and absence of speculative platforms. Identify duplicate concepts/temporary verification routes for later frontend simplification without refactoring now.

- [ ] **Step 4: Validate documents and commit**

Run Prettier, task graph, link/path checks, capability/trace validators, and `git diff --check`. Commit `docs: publish engine completion audit`.

---

### Task 7: Product Owner engine-completion gate

**Files:**

- Modify: `docs/reviews/ENGINE_COMPLETION_AUDIT.md` only for factual review corrections
- Modify: phase PR description/checklist

**Interfaces:**

- Consumes: Task 6 audit and runnable technical journey URLs/accounts.
- Produces: Product Owner decision to start separate final-frontend brainstorming or exact owner blockers.

- [ ] **Step 1: Present the runnable handoff**

Provide exact branch/commit/PR, local URLs, synthetic accounts, role journeys, screenshots, complexity/simplification notes, external gates, and verification counts.

- [ ] **Step 2: Stop at the protected human gate**

Do not start final frontend brainstorming, implementation, merge, destructive restore, live connector installation, paid purchase, or Arabic evaluation release until the Product Owner reviews the engine audit and journey.

- [ ] **Step 3: Record the decision**

If accepted, record `READY_FOR_FINAL_FRONTEND_DESIGN` and open a separate brainstorming cycle. If rejected, record `NOT_READY`, exact capability/owner/evidence, and return only that bounded gap to its subsystem.
