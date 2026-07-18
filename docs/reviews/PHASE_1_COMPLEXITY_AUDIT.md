# Phase 1 Maintainability and Complexity Audit

## Audit status

- **Scope:** Phase 1 only; no Phase 2 code or plan execution was included.
- **Branch:** `codex/phase-1-projects-workstreams-documents`
- **Measured baseline:** commit `74866cb` (`docs: close Phase 1 execution plan`)
- **Audit date:** 2026-07-18
- **Method:** read-only repository classification, line counts, package-dependency inspection, ESLint diagnostic thresholds, duplicate-code scanning, Git diff statistics, local test execution, and GitHub Actions log inspection.
- **Changes made during the audit:** documentation and acceptance artifacts only. No production refactor or CI remediation was applied.
- **Confidence:** high for the measured counts and CI diagnosis; medium-high for the simplification ordering because protected-domain ownership must be preserved during any later refactor.

## Executive conclusion

Phase 1 is functionally broad and intentionally carries more governance code than a typical CRUD feature. The strongest complexity is concentrated in protected areas: immutable history, authorization, AI artifact lineage, document readiness, and dynamic-criteria review. Those controls should not be removed merely to reduce line counts.

There are, however, bounded simplification opportunities:

1. stop repeating a full repository boundary scan for every fixture case;
2. extract small shared mechanics from the project/workstream services without introducing a generic base service;
3. consolidate repeated readiness/comparison operation lifecycle code;
4. split a few very large transactional functions by business stage while keeping one transaction boundary;
5. remove or absorb workspace packages that have no meaningful consumer;
6. consolidate repeated API authentication guards and controller plumbing.

No refactor is recommended before product acceptance. The current GitHub Actions failure is not evidence of a product behavior defect and should be addressed later with a narrowly scoped test timeout.

## GitHub Actions `quality` failure diagnosis

### Exact failure

Pull Request #3, workflow run `29629196213`, job `88039508773`, failed in:

```text
pnpm test:coverage
```

The failing file was:

```text
tests/repository/workspace.test.ts
```

It ran 24 tests; 19 failed after 105.602 seconds:

- line 105: `excludes generated output from source-boundary validation`;
- line 128: 18 parameterized rejection cases, covering the direct and `/internal` import forms of:
  - `@evaluation/database`
  - `@evaluation/ai-routing`
  - `ioredis`
  - `redis`
  - `bullmq`
  - `openai`
  - `@anthropic-ai/sdk`
  - `@google/generative-ai`
  - `@google/genai`

The first failure exceeded Vitest's default 5,000 ms test timeout. The remaining cases were a mixture of the same timeout and cascading `ENOENT` errors from `scripts/validate-boundaries.mjs:3467`. The scanner was still reading a temporary forbidden-import fixture after the timed-out test's cleanup removed it.

### Responsible files and packages

| Area                                 | Responsibility                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `tests/repository/workspace.test.ts` | Starts the full repository boundary scanner once per fixture case and uses the default 5-second timeout.               |
| `scripts/validate-boundaries.mjs`    | Scans approximately 346 source files per invocation and reads each temporary fixture while the test owns its lifetime. |
| Root repository test package         | Runs the boundary suite under Vitest coverage; this is not a feature-package unit failure.                             |
| `@vitest/coverage-v8` execution      | Adds instrumentation and runner overhead, making the CI timing gap more visible.                                       |

### Local result versus GitHub Actions

The exact local runtime required by the repository is Node `24.18.0` and pnpm `11.13.0`. The default local shell initially exposed Node 22/pnpm 9 and correctly refused to run; the comparison below uses the required runtime.

| Check                                        | Local result                       | GitHub Actions result                   |
| -------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Full `pnpm test:coverage`                    | PASS: 80 files, 669 tests, 52.92 s | FAIL in repository boundary tests       |
| Focused workspace test with coverage         | PASS: 24/24, 46.92 s               | 19/24 failed, file duration 105.602 s   |
| Generated-output boundary case               | 2.115 s                            | exceeded 5 s                            |
| Individual forbidden-import cases            | approximately 2.05–2.17 s each     | default timeout or cleanup-race cascade |
| Build/typecheck subprocesses inside the file | 3.389 s / 2.748 s                  | 12.729 s / 11.540 s                     |

The local coverage report was produced successfully:

| Metric     |         Local coverage |
| ---------- | ---------------------: |
| Statements | 33.09% (2,832 / 8,556) |
| Branches   | 26.53% (1,667 / 6,282) |
| Functions  |   37.00% (555 / 1,500) |
| Lines      | 34.51% (2,670 / 7,735) |

No coverage threshold is configured, and GitHub Actions did not fail a threshold comparison.

### Classification

**Environment-sensitive repository test timeout/performance mismatch.**

It is not:

- a behavioral failure in Phase 1 product code;
- a missing-coverage or coverage-percentage policy failure;
- evidence that one of the 17 accepted boundary rejection behaviors is incorrect.

The fixture scanner performs the expected rejection locally. The slower Linux coverage runner crosses the test's generic timeout, and asynchronous cleanup creates secondary file-not-found failures.

### Smallest possible later fix

Add an explicit bounded timeout, recommended at 30 seconds, only to:

- the generated-output exclusion test; and
- the parameterized forbidden-import rejection cases.

This is smaller and safer than adding tests, changing production code, or weakening the boundary rule. A later performance improvement may add a targeted scanner input or cache the unchanged full-repository scan, but that is a separate maintainability task and is not required to correct the false timeout.

## Repository composition

The following categories are mutually exclusive and use tracked files at baseline commit `74866cb`.

| Category                    |   Files |      Lines |         Bytes | Notes                                                                                        |
| --------------------------- | ------: | ---------: | ------------: | -------------------------------------------------------------------------------------------- |
| Production source           |     179 |     26,756 |       924,790 | Application and package runtime source, including non-TypeScript assets.                     |
| Tests and fixtures          |     352 |     37,032 |     1,754,180 | Unit, integration, E2E, boundary fixtures, and test support.                                 |
| Documentation               |      28 |     17,373 |       794,601 | Approved references, plans, operational state, and reviews.                                  |
| Migrations                  |      12 |      3,771 |       167,782 | Forward-only SQL migration files.                                                            |
| Infrastructure              |       9 |        462 |        15,234 | Local service composition, Keycloak realm, and container configuration.                      |
| Tooling/configuration/other |      70 |      8,051 |       498,344 | Scripts, manifests, configuration, and repository metadata.                                  |
| Lockfiles                   |       1 |      5,791 |       190,020 | `pnpm-lock.yaml`; separated because generated dependency resolution distorts source metrics. |
| **Total tracked**           | **651** | **99,236** | **4,344,951** |                                                                                              |

Generated files were treated separately:

- **Tracked generated files:** 0.
- **Ignored local Prisma-generated output:** 65 files, 140,756 lines, approximately 7.4 MB.

Generated Prisma output is intentionally excluded from production complexity and duplication findings.

## Phase 1 change size

Compared with `main`, Phase 1 changes 228 files with 50,513 additions and 466 deletions.

| Category              | Files changed | Additions | Deletions |
| --------------------- | ------------: | --------: | --------: |
| Production source     |           102 |    18,864 |       137 |
| Tests and fixtures    |            95 |    23,068 |        31 |
| Documentation         |             8 |     4,587 |       245 |
| Migrations            |             3 |     2,501 |         0 |
| Infrastructure        |             2 |        29 |         0 |
| Tooling/configuration |            17 |     1,323 |        53 |
| Lockfile              |             1 |       141 |         0 |

Tests and fixtures exceed production additions, which is consistent with the protected workflow and historical-integrity requirements. It also means test execution design is now a material maintainability concern.

## Production file size and complexity

The TypeScript/TSX production scan covered 171 files:

| File-size band  | Files |
| --------------- | ----: |
| 1,000+ lines    |     1 |
| 500–999 lines   |    10 |
| 300–499 lines   |    15 |
| 100–299 lines   |    48 |
| Under 100 lines |    97 |

Largest production files:

| Lines | File                                                             |
| ----: | ---------------------------------------------------------------- |
| 1,074 | `packages/criteria/src/proposal-service.ts`                      |
|   838 | `packages/projects/src/workstream-service.ts`                    |
|   820 | `packages/projects/src/project-service.ts`                       |
|   644 | `packages/documents/src/readiness-service.ts`                    |
|   631 | `packages/projects/src/responsibility-service.ts`                |
|   579 | `packages/criteria/src/workstream-review-service.ts`             |
|   560 | `apps/api/src/ai-routing/admin-composition.ts`                   |
|   545 | `apps/worker/src/analysis-criteria/analysis-criteria-handler.ts` |
|   531 | `packages/documents/src/comparison-service.ts`                   |
|   512 | `packages/ai-routing/src/router.ts`                              |
|   503 | `packages/documents/src/document-service.ts`                     |
|   491 | `apps/web/src/app/[locale]/projects/workspace-views.tsx`         |
|   452 | `packages/permissions/src/decide.ts`                             |
|   448 | `packages/permissions/src/eligibility.ts`                        |
|   447 | `packages/criteria/src/activation-service.ts`                    |

An audit-only ESLint run used warning thresholds of complexity >10, function length >80 lines, more than five parameters, and more than 40 statements. It produced 148 warnings:

| Diagnostic            | Warnings |
| --------------------- | -------: |
| Cyclomatic complexity |       69 |
| Function length       |       61 |
| Parameter count       |       15 |
| Statement count       |        3 |

Notable concentrations:

- `proposal-service.ts`: 13 warnings; `persistValidatedGeneration` complexity 51 and `validateOwnerFeedbackLineage` complexity 39.
- `permissions/src/decide.ts`: `decideKnownAction` complexity 53 and 143 lines.
- `workstream-review-service.ts`: 8 warnings.
- worker analysis handler and AI router: 7 warnings each.
- readiness and comparison services: 7 and 6 warnings.

These are signals for decomposition, not proof of defects. The permission decision table and criteria lifecycle encode protected policy; any later decomposition must preserve exact decision order and transactional behavior.

## Duplication

An audit-only `jscpd` scan excluded tests and generated output:

| Language        |   Files |      Lines | Clones | Duplicate lines |      Rate |
| --------------- | ------: | ---------: | -----: | --------------: | --------: |
| TypeScript      |     144 |     23,555 |     39 |             612 |     2.60% |
| TSX             |      14 |      1,345 |      1 |              12 |       <1% |
| SQL             |      11 |      3,745 |      1 |              17 |       <1% |
| **All scanned** | **202** | **30,920** | **41** |         **641** | **2.07%** |

The global duplication rate is low. The meaningful clusters are:

- project and workstream services repeating membership, status, ownership, serialization, and authorization mechanics;
- readiness and comparison services repeating analysis-operation lifecycle handling;
- criteria proposal and revision services repeating source/prompt lineage work;
- `openai-compatible.ts` and `prompt-aware-openai-compatible.ts`;
- repeated controller decorators, request parsing, and health-controller structure;
- three near-identical feature authentication guards in projects, documents, and analysis/criteria.

## Package and abstraction review

There are 17 workspaces and 42 internal dependency edges.

| Package                    |                                 Runtime consumers | Audit observation                                                                                                    |
| -------------------------- | ------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------- |
| `@evaluation/config`       |                                                 0 | One-line index; currently package overhead without a consumer.                                                       |
| `@evaluation/test-utils`   |                                                 0 | One-line index; no demonstrated shared-test value.                                                                   |
| `@evaluation/ui`           |                                         1 (`web`) | Contains a small bidi component and styles; possibly premature as a standalone design-system package.                |
| `@evaluation/auth`         |                                         1 (`api`) | Single consumer, but the security boundary is valuable and should remain unless replacement is demonstrably simpler. |
| `@evaluation/localization` | 1 runtime consumer (`web`) plus root/seed tooling | Single app consumer, but locale catalogs and rubric identity justify a separate boundary.                            |
| `@evaluation/criteria`     |                                                 2 | Protected lifecycle domain; appropriate boundary.                                                                    |
| `@evaluation/contracts`    |                                                 9 | High-leverage shared contract package.                                                                               |
| `@evaluation/database`     |                                                 7 | Shared persistence boundary, with direct access constrained by repository rules.                                     |

The empty `config` and `test-utils` packages are the clearest single-consumer/zero-consumer abstractions. The `ui` package should remain only if a second UI consumer or a real shared design system is planned soon.

## Overengineering and safe simplification opportunities

### 1. Repository boundary test repeats full work

**Observed:** 19 fixture cases each run a scanner over approximately 346 source files.

**Recommendation:** first apply the bounded timeout fix. Later, allow the scanner to accept a targeted fixture path or cache the unchanged repository scan.

**Risk:** low if the same 17 rejection cases and zero-current-codebase false positives remain asserted.

### 2. Project and workstream services duplicate mechanics

**Observed:** the two largest resource services repeat membership periods, responsibility lookups, status transitions, authorization context loading, and response serialization.

**Recommendation:** extract narrow internal helpers for time windows, active-owner lookup, and scope serialization. Do not introduce a generic resource base service.

**Risk:** medium. Project-owner coordination rights differ from workstream-contributor rights.

### 3. Analysis lifecycle is repeated

**Observed:** readiness, comparison, proposal, revision, API composition, and worker handlers repeat operation/request state changes, lineage pins, and result references.

**Recommendation:** introduce one internal operation-lifecycle helper that owns only queued/running/succeeded/failed transitions. Keep output validation and domain persistence in the owning module.

**Risk:** medium-high because immutable history and AI lineage are protected.

### 4. Large transactional functions mix stages

**Observed:** validation, authorization, locking, model output validation, persistence, transition creation, and audit writing often live in one 150–220 line function.

**Recommendation:** split into named stages that receive the same transaction object. Preserve one serializable transaction where required.

**Risk:** medium-high. Do not move protected writes outside their transaction.

### 5. Repeated API guards and controller plumbing

**Observed:** three feature authentication guards are structurally identical, and controllers duplicate decorator wiring and correlation parsing.

**Recommendation:** consolidate authentication into one API-local guard. Consolidate only stable parsing helpers; retain feature policy guards.

**Risk:** low-medium if feature authorization remains server-side and separate.

### 6. Empty or premature packages

**Observed:** `config` and `test-utils` have no consumers; `ui` has one small consumer.

**Recommendation:** remove empty workspaces after confirming no Phase 2 contract depends on them. Consider absorbing `ui` into `web` until a second consumer exists.

**Risk:** low. This is repository organization only, not product behavior.

### 7. Documentation volume

**Observed:** documentation is 17,373 lines before this audit, including detailed execution plans.

**Recommendation:** keep approved references immutable, but archive completed implementation plans from the active reading path and keep `PROJECT_STATE.md` operationally short.

**Risk:** low if authoritative sources and decision history remain intact.

## Complexity that should remain protected

The following should not be simplified by deleting layers:

- server-side permission decisions and negative authorization tests;
- immutable document, criteria, audit, and responsibility history;
- AI Router-only provider access;
- route-bound prompt and output-schema lineage;
- human owner, contributor, and manager gates;
- manager readiness projection that hides individual detail and percentages;
- Arabic/English stable IDs and RTL behavior;
- transaction boundaries for owner transfer, criteria publication/activation, and historical snapshots.

## Recommended simplification order after acceptance

1. Apply only the bounded workspace-test timeout fix and confirm CI.
2. Remove zero-consumer packages.
3. Consolidate API authentication guards.
4. Optimize the boundary-test scanner without changing rejection coverage.
5. Extract project/workstream helper mechanics.
6. Extract the analysis operation lifecycle.
7. Decompose the highest-complexity protected methods with characterization tests.

No item above should begin until the Phase 1 product acceptance review is complete.
