# Phase 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the complete Phase 0 foundation for the Arabic-first evidence-based performance evaluation system, covering Tasks T001–T017 without implementing Phase 1 product workflows.

**Architecture:** Use one strict ESM TypeScript monorepo with separate Next.js Web, NestJS API, and NestJS Worker processes. PostgreSQL is authoritative; Redis/BullMQ handles non-authoritative asynchronous work; MinIO provides local S3-compatible storage; Keycloak provides local OIDC; all AI calls pass through a provider-neutral Router with durable run traces and structured-output validation.

**Tech Stack:** Node.js 24.18.0 LTS, pnpm 11.13.0, Turborepo 2.10.5, TypeScript 7.0.2, Next.js 16.2.10, React 19.2.7, NestJS 11.1.28, PostgreSQL 17.10, Prisma 7.8.0, Redis 8.2.7, BullMQ 5.80.3, MinIO `RELEASE.2025-09-07T16-13-09Z`, Keycloak 26.7.0, Zod 4.4.3, Vitest 4.1.10, and Playwright 1.61.1.

## Global Constraints

- Implement only Phase 0 Tasks T001–T017. Do not add project, document, evidence, employee-evaluation, manager-evaluation, coaching, continuity, deployment, or GitHub-ingestion product features.
- Use Node.js `24.18.0`, pnpm `11.13.0`, strict ESM, one lockfile, `workspace:*` internal dependencies, and exact dependency versions without ranges.
- Use three independent processes: `apps/web`, `apps/api`, and `apps/worker`. Web cannot import database, Redis, BullMQ, or AI provider code.
- PostgreSQL is authoritative. Redis, object storage, caches, and queues cannot decide protected business state.
- Use Prisma migrations forward-only in shared environments. Never edit a migration after it has been used outside its creation branch.
- Use OIDC Authorization Code with PKCE, validate issuer/audience/signature/expiry, and enforce deactivation from application state.
- Authorization is deny-by-default RBAC plus scoped policy. UI visibility is never authorization.
- The Pilot manager-evaluation mode is `Identified`. Each submitted response is visible immediately to the authorized manager with employee identity, ratings, comments, and timestamp; incomplete or approved-leave employees do not block other responses.
- AI never assigns, predicts, recommends, or implies an employee rating or ranking. Documentation Readiness never becomes a performance input.
- All provider access goes through `@evaluation/ai-routing`; local-only data never falls back to an external provider.
- Arabic is the default locale, English is supported, and RTL, mixed-direction content, keyboard order, and self-hosted fonts are release gates.
- Typography uses self-hosted Noto Sans Arabic and Inter assets with committed license records and no runtime public-font request.
- English rubric Version 1 is the approved source. Arabic content stays inactive until explicit semantic approval for T016 is recorded.
- Logs, traces, audits, and test artifacts exclude credentials, tokens, raw private feedback, raw protected prompts, and uploaded content.
- Unit tests require no network or containers. Integration tests isolate database names, queue prefixes, object prefixes, and OIDC clients.
- Every implementation task follows red-green-refactor: write one failing behavior test, observe the expected failure, add the smallest implementation, observe the pass, run the task verification, then commit only that task.
- The current machine has no Docker-compatible runtime. Before T002 execution, install or explicitly approve Docker Desktop, Colima, Podman, or an equivalent Compose-compatible runtime; do not claim T002 complete without real service checks.
- Begin implementation in an isolated worktree created with `superpowers:using-git-worktrees`. Do not implement directly from this planning session.

## Exact Version Lock

| Component | Exact version or immutable image |
|---|---|
| Node.js | `24.18.0` |
| pnpm | `11.13.0` |
| Turborepo | `2.10.5` |
| TypeScript | `7.0.2` |
| ESLint | `10.7.0` |
| Prettier | `3.9.5` |
| Vitest | `4.1.10` |
| Next.js | `16.2.10` |
| React / React DOM | `19.2.7` |
| NestJS packages | `11.1.28` |
| Prisma / Prisma Client | `7.8.0` |
| Prisma PostgreSQL adapter / pg | `7.8.0` / `8.22.0` |
| Zod | `4.4.3` |
| AWS S3 client / presigner | `3.1087.0` / `3.1087.0` |
| BullMQ | `5.80.3` |
| ioredis | `5.11.1` |
| jose | `6.2.3` |
| openid-client | `6.8.4` |
| Pino / pino-http | `10.3.1` / `11.0.0` |
| OpenTelemetry API / Node SDK | `1.9.1` / `0.220.0` |
| Playwright | `1.61.1` |
| PostgreSQL | `postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394` |
| Redis | `redis:8.2.7-bookworm@sha256:d30960f73a599496d8b2802c97758bab6b1cd421fd06337f837779c47a57e1f3` |
| MinIO | `minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e` |
| Keycloak | `quay.io/keycloak/keycloak:26.7.0@sha256:2eb3cd316835c990e69e26ade292ffa78f6fb0db7d5fc6377463c162e1979ac0` |

Any version change requires a separate compatibility decision, updated lock table, fresh install/build/integration evidence, and a dedicated commit.

## File Responsibility Map

| Area | Files and ownership |
|---|---|
| Repository orchestration | Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.node-version`, `tsconfig.base.json`, ESLint/Prettier/Vitest configuration |
| Web | `apps/web`; locale routing, OIDC initiation, accessible Arabic-first shell, API presentation only |
| API | `apps/api`; `/api/v1`, validation, authorization adapters, transactions, health, OpenAPI |
| Worker | `apps/worker`; BullMQ consumers, job validation, retries, trace propagation, health |
| Public contracts | `packages/contracts`; framework-neutral Zod schemas and inferred types |
| Environment | `packages/config`; process-specific Zod environment schemas without secret values |
| Persistence | `packages/database`; Prisma schema/client/migrations/repository ports |
| Authentication | `packages/auth`; OIDC validation, internal identity mapping, active-user enforcement |
| Authorization | `packages/permissions`; pure policy decisions and reason codes |
| Audit | `packages/audit`; append-only event creation and authorized query port |
| AI | `packages/ai-routing`; route resolution, adapters, output validation, run traces |
| Localization | `packages/localization`; locale metadata, catalogs, rubric content and approval records |
| Observability | `packages/observability`; safe logging, correlation, tracing, metrics, health contracts |
| Shared UI | `packages/ui`; direction-safe accessible primitives and self-hosted typography tokens |
| Test support | `packages/test-utils`, `tests/integration`, `tests/e2e`, `tests/ai-evals`; deterministic factories and isolated resources |
| Local services | `infra/docker`; Compose, database initialization, Keycloak realm, service configuration |
| CI and validation | `.github/workflows`, `scripts`; pinned Actions, secret scan, boundary scan, task-graph validation |

## Required Execution Order

`T001 → {T002, T003, T005, T015} → T004 → T006 → T007 → T008 → {T009, T010, T014} → T011 → T012`, with `T013` after T002 and T005, `T016` after T010 and T015, and `T017` after T003. Execute the numbered tasks below in the written order, which respects that graph.

---

### Task 1: T001 — Create Monorepo Foundation

**Files:**
- Create: `.node-version`
- Create: `.npmrc`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `pnpm-lock.yaml` through the frozen dependency resolution
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `vitest.workspace.ts`
- Create: `scripts/validate-boundaries.mjs`
- Create: `tests/repository/workspace.test.ts`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/main.ts`, `apps/worker/src/app.module.ts`
- Create one `package.json`, `tsconfig.json`, and `src/index.ts` for each Phase 0 package listed in the File Responsibility Map

**Interfaces:**
- Consumes: approved process and package boundaries from the Phase 0 design.
- Produces: workspace scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `test:ai`, `verify`, and `validate:task-graph`; public imports use `@evaluation/<package>`.

- [ ] **Step 1: Verify and activate the locked toolchain**

Run:

```bash
node --version
corepack prepare pnpm@11.13.0 --activate
pnpm --version
```

Expected: Node reports `v24.18.0` and pnpm reports `11.13.0`. If Node differs, stop and install the locked Node version before generating the lockfile.

- [ ] **Step 2: Write the failing workspace contract test**

Create `tests/repository/workspace.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const requiredApps = ["web", "api", "worker"] as const;
const requiredPackages = [
  "contracts",
  "config",
  "database",
  "auth",
  "permissions",
  "audit",
  "ai-routing",
  "localization",
  "observability",
  "ui",
  "test-utils",
] as const;

describe("workspace contract", () => {
  it("declares every Phase 0 workspace with one public entry point", async () => {
    for (const app of requiredApps) {
      const manifest = JSON.parse(await readFile(`apps/${app}/package.json`, "utf8"));
      expect(manifest.name).toBe(`@evaluation/${app}`);
      expect(manifest.private).toBe(true);
    }

    for (const pkg of requiredPackages) {
      const manifest = JSON.parse(await readFile(`packages/${pkg}/package.json`, "utf8"));
      expect(manifest.name).toBe(`@evaluation/${pkg}`);
      expect(manifest.exports).toEqual({ ".": "./src/index.ts" });
    }
  });
});
```

- [ ] **Step 3: Run the test and observe the missing-workspace failure**

Run: `pnpm exec vitest run tests/repository/workspace.test.ts`

Expected: FAIL because the app and package manifests do not exist.

- [ ] **Step 4: Create the root workspace configuration**

Create `package.json`:

```json
{
  "name": "evidence-performance-evaluation-system",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.13.0",
  "engines": { "node": "24.18.0", "pnpm": "11.13.0" },
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint && node scripts/validate-boundaries.mjs",
    "typecheck": "turbo run typecheck",
    "test": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:e2e": "playwright test",
    "test:ai": "vitest run --project ai-evals",
    "validate:task-graph": "python3 scripts/validate_task_graph.py",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "eslint": "10.7.0",
    "prettier": "3.9.5",
    "turbo": "2.10.5",
    "tsx": "4.23.1",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "lint": { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] }
  }
}
```

Create `.node-version` containing `24.18.0`, and configure `.npmrc` with `engine-strict=true`, `save-exact=true`, and `shared-workspace-lockfile=true`.

- [ ] **Step 5: Create strict TypeScript and package manifests**

Use this complete base in `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": false
  }
}
```

Each shared package manifest must use this shape, replacing `contracts` with the package directory name:

```json
{
  "name": "@evaluation/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 6: Install, generate the lockfile, and run the workspace test**

Run:

```bash
pnpm install
pnpm exec vitest run tests/repository/workspace.test.ts
pnpm lint
pnpm typecheck
pnpm build
```

Expected: install completes with one `pnpm-lock.yaml`; the workspace test passes; boundary, lint, type, and all three application builds pass.

- [ ] **Step 7: Commit T001**

```bash
git add .node-version .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json eslint.config.mjs prettier.config.mjs vitest.workspace.ts scripts/validate-boundaries.mjs tests/repository apps packages
git commit -m "chore: establish phase 0 monorepo"
```

---

### Task 2: T002 — Add Local Infrastructure

**Files:**
- Create: `.env.example`
- Create: `.env.test.example`
- Create: `infra/docker/compose.yml`
- Create: `infra/docker/postgres/001-databases.sh`
- Create: `infra/docker/keycloak/evaluation-realm.json`
- Create: `scripts/verify-infra.mjs`
- Create: `scripts/reset-local-infra.mjs`
- Create: `tests/repository/compose.test.ts`
- Create: `tests/integration/object-storage.integration.test.ts`
- Create: `docs/local-development.md`
- Modify: `package.json` scripts

**Interfaces:**
- Consumes: root scripts and Node runtime from T001.
- Produces: PostgreSQL at `127.0.0.1:5432`, Redis at `127.0.0.1:6379`, MinIO API at `127.0.0.1:9000`, Keycloak at `127.0.0.1:8081`; scripts `infra:up`, `infra:down`, `infra:verify`, and guarded `infra:reset`.

- [ ] **Step 1: Write the failing immutable-image test**

Create `tests/repository/compose.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("local infrastructure", () => {
  it("pins every required service by tag and digest", async () => {
    const compose = await readFile("infra/docker/compose.yml", "utf8");
    expect(compose).toContain("postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394");
    expect(compose).toContain("redis:8.2.7-bookworm@sha256:d30960f73a599496d8b2802c97758bab6b1cd421fd06337f837779c47a57e1f3");
    expect(compose).toContain("minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e");
    expect(compose).toContain("quay.io/keycloak/keycloak:26.7.0@sha256:2eb3cd316835c990e69e26ade292ffa78f6fb0db7d5fc6377463c162e1979ac0");
    expect(compose).not.toMatch(/image:\s+\S+:latest(?:\s|$)/);
  });
});
```

- [ ] **Step 2: Run the test and observe the missing Compose file**

Run: `pnpm exec vitest run tests/repository/compose.test.ts`

Expected: FAIL with `ENOENT` for `infra/docker/compose.yml`.

- [ ] **Step 3: Create the Compose topology**

Create `infra/docker/compose.yml` with these exact service boundaries:

```yaml
name: evaluation-system
services:
  postgres:
    image: postgres:17.10-bookworm@sha256:4f736ae292687621d4dbe0d499ffd024a36bd2ee7d8ca6f2ccd4c800f047b394
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD}
    ports: ["127.0.0.1:5432:5432"]
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./postgres/001-databases.sh:/docker-entrypoint-initdb.d/001-databases.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 20
  redis:
    image: redis:8.2.7-bookworm@sha256:d30960f73a599496d8b2802c97758bab6b1cd421fd06337f837779c47a57e1f3
    command: ["redis-server", "--appendonly", "yes"]
    ports: ["127.0.0.1:6379:6379"]
    volumes: ["redis-data:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20
  minio:
    image: minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e
    command: ["server", "/data", "--console-address", ":9001"]
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports: ["127.0.0.1:9000:9000", "127.0.0.1:9001:9001"]
    volumes: ["minio-data:/data"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 3s
      retries: 20
  keycloak:
    image: quay.io/keycloak/keycloak:26.7.0@sha256:2eb3cd316835c990e69e26ade292ffa78f6fb0db7d5fc6377463c162e1979ac0
    command: ["start-dev", "--import-realm", "--health-enabled=true"]
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: ${KEYCLOAK_DB_USERNAME}
      KC_DB_PASSWORD: ${KEYCLOAK_DB_PASSWORD}
      KC_BOOTSTRAP_ADMIN_USERNAME: ${KEYCLOAK_ADMIN_USERNAME}
      KC_BOOTSTRAP_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
    ports: ["127.0.0.1:8081:8080", "127.0.0.1:9002:9000"]
    volumes:
      - ./keycloak/evaluation-realm.json:/opt/keycloak/data/import/evaluation-realm.json:ro
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/9000 && printf 'GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3 && grep -q '200 OK' <&3"]
      interval: 10s
      timeout: 5s
      retries: 30
volumes:
  postgres-data:
  redis-data:
  minio-data:
```

The realm file must define one public PKCE web client, one bearer-only API audience, local test groups, and redirect URIs restricted to `http://localhost:3000/*`.

- [ ] **Step 4: Add safe environment and reset contracts**

`.env.example` contains non-secret local-only values for all variables referenced by Compose plus `DATABASE_URL`, `TEST_DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `OIDC_ISSUER`, and `OIDC_AUDIENCE`. `scripts/reset-local-infra.mjs` exits unless both `APP_ENV=local` and `RESET_LOCAL_DATA=YES`; on success it runs `docker compose -f infra/docker/compose.yml down --volumes`.

- [ ] **Step 5: Run real service verification**

Add `@aws-sdk/client-s3@3.1087.0` and `@aws-sdk/s3-request-presigner@3.1087.0` as exact test dependencies, then run:

```bash
cp .env.example .env.local
docker compose --env-file .env.local -f infra/docker/compose.yml config --quiet
docker compose --env-file .env.local -f infra/docker/compose.yml up -d --wait
node scripts/verify-infra.mjs
pnpm exec vitest run tests/integration/object-storage.integration.test.ts
docker compose --env-file .env.local -f infra/docker/compose.yml restart
node scripts/verify-infra.mjs
```

Expected: all four services become healthy; application and Keycloak databases accept only their own users; Redis returns `PONG`; MinIO liveness returns HTTP 200; OIDC discovery returns the `evaluation` issuer; data remains after restart. The object-storage test creates a private bucket, writes/reads/checksums/deletes an object under a unique prefix, confirms anonymous GET returns 403, confirms a short-lived signed GET works, and confirms the same URL fails after expiry.

- [ ] **Step 6: Run tests and Commit T002**

```bash
pnpm exec vitest run tests/repository/compose.test.ts
git add .env.example .env.test.example infra/docker scripts/verify-infra.mjs scripts/reset-local-infra.mjs tests/repository/compose.test.ts tests/integration/object-storage.integration.test.ts docs/local-development.md package.json pnpm-lock.yaml
git commit -m "chore: add local phase 0 infrastructure"
```

---

### Task 3: T003 — Establish CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/scan-secrets.mjs`
- Create: `tests/repository/ci.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: T001 workspace scripts and T002 Compose services.
- Produces: least-privilege GitHub checks `integrity`, `quality`, `build`, and `integration`; pull-request jobs have read-only contents permission.

- [ ] **Step 1: Write the failing CI contract test**

Create `tests/repository/ci.test.ts`:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("CI contract", () => {
  it("pins actions and runs every Phase 0 gate", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0");
    expect(workflow).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
    for (const command of ["validate:task-graph", "lint", "typecheck", "test", "build", "test:integration", "test:ai", "test:e2e"]) {
      expect(workflow).toContain(`pnpm ${command}`);
    }
  });
});
```

- [ ] **Step 2: Run the test and observe the missing workflow failure**

Run: `pnpm exec vitest run tests/repository/ci.test.ts`

Expected: FAIL with `ENOENT` for `.github/workflows/ci.yml`.

- [ ] **Step 3: Create the pinned CI workflow**

Create `.github/workflows/ci.yml` with this top-level security and concurrency contract:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  integrity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      - run: python3 scripts/validate_task_graph.py
      - run: node scripts/scan-secrets.mjs
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with: { node-version: 24.18.0, cache: pnpm }
      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271
        with: { version: 11.13.0, run_install: false }
      - run: pnpm install --frozen-lockfile
      - run: pnpm validate:task-graph
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020
        with: { node-version: 24.18.0, cache: pnpm }
      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271
        with: { version: 11.13.0, run_install: false }
      - run: pnpm install --frozen-lockfile
      - run: docker compose --env-file .env.test.example -f infra/docker/compose.yml up -d --wait
      - run: pnpm test:integration -- --passWithNoTests
      - run: pnpm test:ai -- --passWithNoTests
      - run: pnpm test:e2e -- --pass-with-no-tests
      - if: always()
        run: docker compose --env-file .env.test.example -f infra/docker/compose.yml down --volumes
```

Set `integration.needs: quality`; add migration checks to `integration` when T004 lands. The three explicit no-test flags keep the early CI commit green before its dependent suites exist; remove all three in Task 17 after those suites are present. Live-provider AI checks remain a separate protected manual workflow and receive no pull-request secrets.

- [ ] **Step 4: Verify the workflow locally and remotely**

Run:

```bash
pnpm exec vitest run tests/repository/ci.test.ts
node scripts/scan-secrets.mjs
pnpm verify
```

Expected: local gates pass. After pushing the implementation branch, temporarily change one unit assertion to be false, push that commit, confirm the `quality` job fails, revert that single assertion, and confirm CI returns green.

- [ ] **Step 5: Commit T003**

```bash
git add .github/workflows/ci.yml scripts/scan-secrets.mjs tests/repository/ci.test.ts package.json pnpm-lock.yaml
git commit -m "ci: establish phase 0 quality gates"
```

---

### Task 4: T004 — Create Database Package and Migration Workflow

**Files:**
- Create: `packages/database/prisma.config.ts`
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0001_database_foundation/migration.sql`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/transactions.ts`
- Create: `packages/database/src/index.ts`
- Create: `packages/database/src/client.integration.test.ts`
- Create: `scripts/assert-local-database.mjs`
- Create: `scripts/verify-migrations.mjs`
- Modify: `packages/database/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `DATABASE_URL` and `TEST_DATABASE_URL` from T002.
- Produces: `createDatabaseClient(connectionString: string): PrismaClient`, `withTransaction<T>(client, operation): Promise<T>`, and commands `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:reset:local`, `db:verify`.

- [ ] **Step 1: Write the failing real-database test**

Create `packages/database/src/client.integration.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client.js";

const client = createDatabaseClient(process.env.TEST_DATABASE_URL ?? "");

afterAll(async () => client.$disconnect());

describe("database foundation", () => {
  it("uses PostgreSQL and persists UTC system metadata", async () => {
    const row = await client.systemMetadata.create({
      data: { key: `integration:${crypto.randomUUID()}`, value: "phase-0" },
    });
    expect(row.createdAt.toISOString()).toMatch(/Z$/);
  });
});
```

- [ ] **Step 2: Run the test and observe the missing client failure**

Run: `pnpm --filter @evaluation/database test:integration`

Expected: FAIL because `createDatabaseClient` and the generated Prisma client do not exist.

- [ ] **Step 3: Add the Prisma 7 configuration and minimal schema**

Create `packages/database/prisma.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

Create `packages/database/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model SystemMetadata {
  id        String   @id @default(uuid()) @db.Uuid
  key       String   @unique
  value     String
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)
}
```

Implement `createDatabaseClient` using `@prisma/adapter-pg@7.8.0` and `pg`, and reject an empty connection string before constructing the adapter. Do not export generated Prisma model types from the package public entry point.

- [ ] **Step 4: Generate and verify the first migration**

Run:

```bash
pnpm --filter @evaluation/database prisma generate
pnpm --filter @evaluation/database prisma migrate dev --name database_foundation
pnpm --filter @evaluation/database test:integration
pnpm db:verify
```

Expected: the empty test database migrates, the integration test passes, schema drift is absent, and rebuilding the test database from migrations produces the same schema.

- [ ] **Step 5: Add destructive-command protection**

`scripts/assert-local-database.mjs` must parse the target URL and exit unless the host is `localhost`, `127.0.0.1`, or the Compose service name `postgres`, and unless `APP_ENV` equals `local` or `test`. `db:reset:local` invokes this guard before `prisma migrate reset`.

- [ ] **Step 6: Add migration checks to CI and Commit T004**

```bash
git add packages/database scripts/assert-local-database.mjs scripts/verify-migrations.mjs package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "feat: establish database migration workflow"
```

---

### Task 5: T005 — Implement Structured Logging and Error Model

**Files:**
- Create: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/errors.test.ts`
- Create: `packages/observability/src/logger.ts`
- Create: `packages/observability/src/logger.test.ts`
- Create: `packages/observability/src/correlation.ts`
- Create: `packages/observability/src/health.ts`
- Create: `packages/observability/src/index.ts`
- Create: `apps/api/src/platform/correlation.middleware.ts`
- Create: `apps/api/src/platform/error.filter.ts`
- Create: `apps/api/src/platform/health.controller.ts`
- Create: `apps/web/src/app/[locale]/error.tsx`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**
- Consumes: framework-neutral contracts from T001.
- Produces: `ErrorEnvelopeSchema`, `AppError`, `createLogger(options)`, `redact(value)`, correlation header `x-correlation-id`, and separate `/health/live` and `/health/ready` responses.

- [ ] **Step 1: Write the failing redaction and envelope tests**

Create `packages/observability/src/logger.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redact } from "./logger.js";

describe("safe observability", () => {
  it("removes secrets and private response bodies recursively", () => {
    expect(
      redact({
        authorization: "Bearer secret",
        token: "secret",
        managerFeedback: "private text",
        safe: { correlationId: "corr-1" },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      token: "[REDACTED]",
      managerFeedback: "[REDACTED]",
      safe: { correlationId: "corr-1" },
    });
  });
});
```

Create `packages/contracts/src/errors.test.ts` to assert the exact public envelope `{ code, messageKey, correlationId, details? }` and reject `stack`, SQL text, tokens, and arbitrary unknown properties.

- [ ] **Step 2: Run tests and observe missing exports**

Run: `pnpm --filter @evaluation/contracts test && pnpm --filter @evaluation/observability test`

Expected: FAIL because the error schema and redaction implementation are absent.

- [ ] **Step 3: Implement the framework-neutral error contract**

Create `packages/contracts/src/errors.ts`:

```ts
import { z } from "zod";

export const ErrorDetailSchema = z.object({
  field: z.string().min(1),
  messageKey: z.string().min(1),
}).strict();

export const ErrorEnvelopeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/),
  messageKey: z.string().min(1),
  correlationId: z.string().min(1),
  details: z.array(ErrorDetailSchema).optional(),
}).strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly messageKey: string,
    readonly status: number,
    readonly details?: ErrorEnvelope["details"],
  ) {
    super(code);
    this.name = "AppError";
  }
}
```

- [ ] **Step 4: Implement logger, correlation, filters, and health**

Use Pino with a fixed redact list for authorization, cookies, tokens, credentials, raw prompts, uploaded content, and private feedback. Accept a valid incoming correlation UUID or generate a new UUID; echo it in the response and include it in logs and error envelopes. Liveness reports process availability only; readiness reports PostgreSQL, Redis, and required configuration without returning credentials or connection strings.

- [ ] **Step 5: Verify cross-process propagation**

Add an integration test that calls API with `x-correlation-id: 9a11bb8f-79f5-4a72-a98f-2e763e97699b`, enqueues a test operation, and asserts the same ID appears in sanitized API and Worker test log sinks. The Worker portion becomes active when T013 lands; until then the test asserts the API boundary and shared carrier contract.

Run:

```bash
pnpm --filter @evaluation/contracts test
pnpm --filter @evaluation/observability test
pnpm --filter @evaluation/api test
pnpm typecheck
```

Expected: schemas, redaction, API filter, correlation, and health tests pass with no protected values in captured output.

- [ ] **Step 6: Commit T005**

```bash
git add packages/contracts packages/observability apps/api/src/platform apps/api/src/app.module.ts apps/api/src/main.ts apps/web/src/app/[locale]/error.tsx pnpm-lock.yaml
git commit -m "feat: add safe errors and observability foundation"
```

---

### Task 6: T006 — Implement Authentication

**Files:**
- Create: `packages/database/prisma/migrations/0002_identity/migration.sql`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/auth/src/principal.ts`
- Create: `packages/auth/src/token-validator.ts`
- Create: `packages/auth/src/token-validator.test.ts`
- Create: `packages/auth/src/user-sync.ts`
- Create: `packages/auth/src/index.ts`
- Create: `apps/api/src/auth/auth.guard.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/auth/me.controller.ts`
- Create: `apps/web/src/auth/oidc.ts`
- Create: `apps/web/src/app/api/auth/login/route.ts`
- Create: `apps/web/src/app/api/auth/callback/route.ts`
- Create: `apps/web/src/app/api/auth/logout/route.ts`
- Create: `tests/integration/auth.integration.test.ts`

**Interfaces:**
- Consumes: Keycloak issuer/client from T002, database client from T004, safe errors from T005.
- Produces: `AuthenticatedPrincipal { userId, oidcSubject, email, roles, active }`, `validateAccessToken(token, config)`, `syncOidcUser(principal)`, and API request property `request.principal`.

- [ ] **Step 1: Write the failing token-validation tests**

Create `packages/auth/src/token-validator.test.ts` with locally generated JOSE keys and tokens covering valid, expired, wrong issuer, wrong audience, missing subject, and deactivated internal user. The valid case must assert this exact public result:

```ts
expect(principal).toEqual({
  oidcSubject: "oidc-user-1",
  email: "employee@pilot.local",
  issuer: "http://localhost:8081/realms/evaluation",
});
```

- [ ] **Step 2: Run tests and observe the missing validator**

Run: `pnpm --filter @evaluation/auth test`

Expected: FAIL because `validateAccessToken` is not exported.

- [ ] **Step 3: Add identity persistence**

Extend Prisma with:

```prisma
model User {
  id          String   @id @default(uuid()) @db.Uuid
  email       String   @unique
  displayName String
  active      Boolean  @default(true)
  identities OidcIdentity[]
  createdAt   DateTime @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @db.Timestamptz(6)
}

model OidcIdentity {
  id        String   @id @default(uuid()) @db.Uuid
  issuer    String
  subject   String
  userId    String   @db.Uuid
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  @@unique([issuer, subject])
}
```

Generate a named migration. User synchronization updates approved profile fields but never reactivates a deactivated user from token claims.

- [ ] **Step 4: Implement OIDC validation and web PKCE routes**

Use `openid-client@6.8.4` for discovery and Authorization Code with PKCE, and `jose@6.2.3` for API verification. Store browser session state in encrypted, `HttpOnly`, `Secure` outside local development, `SameSite=Lax` cookies. Validate callback state, nonce, issuer, and audience. Logout clears the local session and redirects through the provider end-session endpoint when advertised.

- [ ] **Step 5: Run contract and real-provider tests**

```bash
pnpm --filter @evaluation/auth test
pnpm db:migrate
pnpm exec vitest run tests/integration/auth.integration.test.ts
```

Expected: valid Keycloak login and `/api/v1/me` succeed; bad credentials fail at Keycloak; wrong audience and expired tokens return `AUTH_INVALID_TOKEN`; deactivated users return `AUTH_USER_INACTIVE` even with a valid token.

- [ ] **Step 6: Commit T006**

```bash
git add packages/database/prisma packages/auth apps/api/src/auth apps/web/src/auth apps/web/src/app/api/auth tests/integration/auth.integration.test.ts pnpm-lock.yaml
git commit -m "feat: implement oidc authentication"
```

---

### Task 7: T007 — Implement Authorization Framework

**Files:**
- Create: `packages/permissions/src/model.ts`
- Create: `packages/permissions/src/decide.ts`
- Create: `packages/permissions/src/decide.test.ts`
- Create: `packages/permissions/src/index.ts`
- Create: `apps/api/src/permissions/policy.guard.ts`
- Create: `apps/api/src/permissions/require-policy.decorator.ts`
- Create: `apps/api/src/permissions/permissions.module.ts`
- Create: `tests/integration/authorization.integration.test.ts`

**Interfaces:**
- Consumes: authenticated internal user from T006.
- Produces: `decide(subject, action, resource, context): Decision`, where `Decision` is `{ allowed: true } | { allowed: false; reasonCode: DenialReason }`.

- [ ] **Step 1: Write the failing permission matrix**

Create `packages/permissions/src/decide.test.ts` with table cases for Employee, Manager, System Administrator, Project Owner, Workstream Owner, Contributor, and Acting Owner. Include these protected cases:

```ts
it("shows a submitted identified response immediately to its authorized manager", () => {
  expect(decide(manager, "managerFeedback.response.read", submittedResponse, context)).toEqual({ allowed: true });
});

it("denies a manager from another department", () => {
  expect(decide(otherManager, "managerFeedback.response.read", submittedResponse, context)).toEqual({
    allowed: false,
    reasonCode: "SCOPE_MISMATCH",
  });
});

it("does not depend on full-team completion", () => {
  expect(decide(manager, "managerFeedback.response.read", submittedResponse, { ...context, incompleteEligibleCount: 4 })).toEqual({ allowed: true });
});
```

- [ ] **Step 2: Run tests and observe deny/undefined failures**

Run: `pnpm --filter @evaluation/permissions test`

Expected: FAIL because roles, actions, and `decide` do not exist.

- [ ] **Step 3: Implement the pure decision contract**

Create `packages/permissions/src/model.ts`:

```ts
export type Role =
  | "employee"
  | "manager"
  | "system_administrator"
  | "project_owner"
  | "workstream_owner"
  | "contributor"
  | "acting_owner";

export type Decision =
  | { allowed: true }
  | { allowed: false; reasonCode: "UNAUTHENTICATED" | "INACTIVE" | "ROLE_REQUIRED" | "SCOPE_MISMATCH" | "RESOURCE_STATE" };

export type PolicyInput = Readonly<{
  subjectId: string;
  active: boolean;
  roles: ReadonlyArray<{ role: Role; scopeType: "system" | "organization" | "department" | "project" | "workstream"; scopeId: string }>;
}>;
```

Policy functions must be pure, deny unknown actions, ignore UI state, and use submitted resource state plus scope rather than team completion counts.

- [ ] **Step 4: Adapt policies to NestJS and verify negatives**

The decorator records an action and resource loader; the guard reads `request.principal`, loads the resource scope, calls `decide`, and throws a safe `AUTHZ_<REASON>` error. Add integration cases proving a System Administrator identity is not the pilot manager, an employee cannot read another employee's response, and an authorized manager can read each submitted identified response immediately.

Run:

```bash
pnpm --filter @evaluation/permissions test
pnpm exec vitest run tests/integration/authorization.integration.test.ts
```

Expected: the complete matrix passes, including all negative and immediate-visibility cases.

- [ ] **Step 5: Commit T007**

```bash
git add packages/permissions apps/api/src/permissions tests/integration/authorization.integration.test.ts
git commit -m "feat: add scoped authorization policies"
```

---

### Task 8: T008 — Seed Pilot Organization and Roles

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0003_pilot_organization_roles/migration.sql`
- Create: `packages/database/prisma/seed.ts`
- Create: `packages/database/src/seed-pilot.ts`
- Create: `packages/database/src/seed-pilot.integration.test.ts`
- Modify: `packages/database/package.json`

**Interfaces:**
- Consumes: User identities from T006 and role vocabulary from T007.
- Produces: stable seed keys `leapai`, `ai-department`, `pilot-manager`, `system-admin`, and idempotent `seedPilot(client, subjects)`.

- [ ] **Step 1: Write the failing idempotency and separation test**

Create `packages/database/src/seed-pilot.integration.test.ts`:

```ts
it("seeds LeapAI twice without duplicates and separates manager from administrator", async () => {
  await seedPilot(client, { managerSubject: "pilot-manager", adminSubject: "system-admin" });
  await seedPilot(client, { managerSubject: "pilot-manager", adminSubject: "system-admin" });

  expect(await client.organization.count({ where: { key: "leapai" } })).toBe(1);
  expect(await client.department.count({ where: { key: "ai-department" } })).toBe(1);

  const manager = await loadSeededUser("pilot-manager");
  const admin = await loadSeededUser("system-admin");
  expect(manager.id).not.toBe(admin.id);
  expect(manager.roles).toEqual(["manager"]);
  expect(admin.roles).toEqual(["system_administrator"]);
});
```

- [ ] **Step 2: Run the test and observe missing organization models**

Run: `pnpm --filter @evaluation/database test:integration -- seed-pilot`

Expected: FAIL because Organization, Department, and RoleAssignment are absent.

- [ ] **Step 3: Add scoped organization models and transactional upserts**

Add `Organization`, `Department`, and `RoleAssignment` with unique stable keys, UTC timestamps, explicit scope type/id, and foreign keys. `seedPilot` executes one transaction, uses upserts only on stable keys, reads OIDC subjects from environment, and refuses equal manager/admin subjects.

- [ ] **Step 4: Verify idempotency and role separation**

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:seed
pnpm --filter @evaluation/database test:integration -- seed-pilot
```

Expected: one organization, one department, distinct manager/admin users, and no duplicate role assignments after the second seed.

- [ ] **Step 5: Commit T008**

```bash
git add packages/database/prisma packages/database/src/seed-pilot.ts packages/database/src/seed-pilot.integration.test.ts packages/database/package.json
git commit -m "feat: seed leapai pilot identities and roles"
```

---

### Task 9: T009 — Create Audit Foundation

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0004_append_only_audit/migration.sql`
- Create: `packages/audit/src/audit-event.ts`
- Create: `packages/audit/src/audit-service.ts`
- Create: `packages/audit/src/audit-service.integration.test.ts`
- Create: `packages/audit/src/index.ts`
- Create: `apps/api/src/audit/audit.module.ts`
- Create: `apps/api/src/audit/audit.controller.ts`
- Create: `tests/integration/audit-authorization.integration.test.ts`

**Interfaces:**
- Consumes: database transactions from T004, authenticated actor from T006, policy decisions from T007.
- Produces: `AuditEventInputSchema`, `appendAuditEvent(tx, input): Promise<AuditEventRef>`, and authorized paginated query by event type, actor, scope, target, correlation ID, and UTC range.

- [ ] **Step 1: Write the failing append-only database test**

Create `packages/audit/src/audit-service.integration.test.ts`:

```ts
it("allows insert and rejects update and delete", async () => {
  const event = await appendAuditEvent(client, {
    eventType: "identity.synchronized",
    actorId: userId,
    effectiveSubjectId: userId,
    scopeType: "organization",
    scopeId: organizationId,
    targetType: "user",
    targetId: userId,
    correlationId: crypto.randomUUID(),
    source: "api",
    safeDiff: { fields: ["displayName"] },
  });

  await expect(client.auditEvent.update({ where: { id: event.id }, data: { eventType: "changed" } })).rejects.toThrow();
  await expect(client.auditEvent.delete({ where: { id: event.id } })).rejects.toThrow();
});
```

- [ ] **Step 2: Run the test and observe missing schema/service failures**

Run: `pnpm --filter @evaluation/audit test:integration`

Expected: FAIL because `AuditEvent` and `appendAuditEvent` do not exist.

- [ ] **Step 3: Add event schema and database protection**

The migration creates `AuditEvent` with UUID, event type, actor/effective subject, scope, target, optional reason, safe JSON diff, correlation ID, source, and `createdAt TIMESTAMPTZ`. Add a PostgreSQL trigger that raises SQLSTATE `55000` on every UPDATE or DELETE. Grant the application role INSERT/SELECT only; migration ownership remains separate.

Create the strict input contract:

```ts
export const AuditEventInputSchema = z.object({
  eventType: z.string().regex(/^[a-z]+(?:\.[a-z]+)+$/),
  actorId: z.string().uuid(),
  effectiveSubjectId: z.string().uuid(),
  scopeType: z.enum(["system", "organization", "department", "project", "workstream", "cycle"]),
  scopeId: z.string().uuid(),
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500).optional(),
  safeDiff: z.record(z.string(), z.unknown()).optional(),
  correlationId: z.string().uuid(),
  source: z.enum(["api", "worker", "seed", "admin_replay"]),
}).strict();
```

Reject keys matching token, secret, password, prompt, rawContent, privateFeedback, or authorization before persistence.

- [ ] **Step 4: Verify service and API authorization**

Run:

```bash
pnpm db:migrate
pnpm --filter @evaluation/audit test:integration
pnpm exec vitest run tests/integration/audit-authorization.integration.test.ts
```

Expected: protected actions append events; update/delete fail at both service and database levels; ordinary employees receive 403; authorized administrators receive sanitized paginated results.

- [ ] **Step 5: Commit T009**

```bash
git add packages/database/prisma packages/audit apps/api/src/audit tests/integration/audit-authorization.integration.test.ts
git commit -m "feat: add append-only audit foundation"
```

---

### Task 10: T010 — Seed Approved Evaluation Rubric

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0005_rubric_v1/migration.sql`
- Create: `packages/localization/src/rubric/rubric-schema.ts`
- Create: `packages/localization/src/rubric/v1.en.json`
- Create: `packages/localization/src/rubric/source-hash.ts`
- Create: `scripts/extract-approved-rubric.mjs`
- Create: `scripts/compare-approved-rubric.mjs`
- Create: `tests/integration/rubric-seed.integration.test.ts`
- Modify: `packages/database/prisma/seed.ts`
- Modify: `packages/localization/src/index.ts`

**Interfaces:**
- Consumes: `docs/EVALUATION_RUBRIC.md` as the approved English source and pilot organization from T008.
- Produces: immutable rubric version `1`, 12 employee criteria, 60 employee anchors, Project Contribution with five anchors and weight 25, five manager criteria with 25 anchors, weight total 100, and a source SHA-256 stored with the version.

- [ ] **Step 1: Write the failing source-comparison test**

Create `tests/integration/rubric-seed.integration.test.ts`:

```ts
it("matches approved English rubric Version 1 exactly", async () => {
  const rubric = await loadRubricVersion("1", "en");
  expect(rubric.employeeCriteria).toHaveLength(12);
  expect(rubric.employeeCriteria.flatMap((criterion) => criterion.anchors)).toHaveLength(60);
  expect(rubric.managerCriteria).toHaveLength(5);
  expect(rubric.managerCriteria.flatMap((criterion) => criterion.anchors)).toHaveLength(25);
  expect(rubric.sections.reduce((sum, section) => sum + section.weight, 0)).toBe(100);
  expect(rubric.sourceHash).toBe(await sha256File("docs/EVALUATION_RUBRIC.md"));
  expect(await compareApprovedRubric(rubric)).toEqual([]);
});
```

- [ ] **Step 2: Run the test and observe missing rubric persistence**

Run: `pnpm exec vitest run tests/integration/rubric-seed.integration.test.ts`

Expected: FAIL because rubric models, content, and comparison functions are absent.

- [ ] **Step 3: Define versioned rubric content and persistence**

Use this strict top-level contract in `rubric-schema.ts`:

```ts
export const RubricContentSchema = z.object({
  version: z.literal("1"),
  locale: z.literal("en"),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  sections: z.array(z.object({ id: z.string(), title: z.string(), weight: z.number().int().min(0).max(100) }).strict()).length(4),
  employeeCriteria: z.array(CriterionSchema).length(12),
  projectContribution: CriterionSchema,
  managerCriteria: z.array(ManagerCriterionSchema).length(5),
  biasGuidance: z.array(z.string().min(1)).min(1),
}).strict();
```

The extractor reads the approved headings and anchor tables, emits stable IDs from the document (`PPB-01` through `EED-04`, `PROJECT-CONTRIBUTION`, `MGR-01` through `MGR-05`), validates counts and weights, computes the source hash, and refuses to overwrite a committed active version. Commit the generated `v1.en.json`; runtime seed reads JSON rather than parsing Markdown.

- [ ] **Step 4: Generate, inspect, seed, and compare**

Run:

```bash
node scripts/extract-approved-rubric.mjs docs/EVALUATION_RUBRIC.md packages/localization/src/rubric/v1.en.json
node scripts/compare-approved-rubric.mjs
pnpm db:migrate
pnpm db:seed
pnpm exec vitest run tests/integration/rubric-seed.integration.test.ts
```

Expected: extraction reports 12/60 employee, 1/5 Project Contribution, 5/25 manager, and 100% weight; seed is idempotent; comparison reports zero differences.

- [ ] **Step 5: Verify historical protection**

Add a database test proving an active rubric version cannot change criterion text, anchor text, weights, IDs, locale source hash, or activation timestamp. A corrected meaning requires a new version row.

- [ ] **Step 6: Commit T010**

```bash
git add packages/database/prisma packages/localization/src/rubric packages/localization/src/index.ts scripts/extract-approved-rubric.mjs scripts/compare-approved-rubric.mjs tests/integration/rubric-seed.integration.test.ts
git commit -m "feat: seed approved evaluation rubric v1"
```

---

### Task 11: T011 — Implement AI Router

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0006_ai_routing/migration.sql`
- Create: `packages/ai-routing/src/contracts.ts`
- Create: `packages/ai-routing/src/resolve-route.ts`
- Create: `packages/ai-routing/src/resolve-route.test.ts`
- Create: `packages/ai-routing/src/router.ts`
- Create: `packages/ai-routing/src/router.test.ts`
- Create: `packages/ai-routing/src/adapters/fake.ts`
- Create: `packages/ai-routing/src/adapters/openai-compatible.ts`
- Create: `packages/ai-routing/src/output-validator.ts`
- Create: `packages/ai-routing/src/index.ts`
- Create: `apps/api/src/ai-routing/ai-routing.module.ts`
- Create: `tests/integration/ai-run-trace.integration.test.ts`
- Modify: `scripts/validate-boundaries.mjs`

**Interfaces:**
- Consumes: database transactions T004, safe telemetry T005, authorization T007, append-only audit T009.
- Produces: `AiProviderAdapter.generate(request): Promise<ProviderResult>`, `resolveRoute(routeKey, scope, classification)`, `AiRouter.run(input): Promise<ValidatedAiResult<T>>`, and durable route/config/run records.

- [ ] **Step 1: Write the failing route precedence and privacy tests**

Create `packages/ai-routing/src/resolve-route.test.ts`:

```ts
it.each([
  [{ projectId: "p1", departmentId: "d1" }, "project"],
  [{ departmentId: "d1" }, "department"],
  [{}, "system"],
])("resolves project then department then system", async (scope, expectedLevel) => {
  expect((await resolveRoute(repository, "evaluation.summary", scope, "internal")).level).toBe(expectedLevel);
});

it("refuses external fallback for local-only data", async () => {
  await expect(resolveFallback(localFailureRoute, "local_only")).rejects.toMatchObject({ code: "AI_FALLBACK_FORBIDDEN" });
});
```

Create `router.test.ts` to assert invalid structured output is quarantined and cannot call a persistence callback.

- [ ] **Step 2: Run tests and observe missing router failures**

Run: `pnpm --filter @evaluation/ai-routing test`

Expected: FAIL because route resolution, adapters, and output validation are absent.

- [ ] **Step 3: Define provider-neutral contracts**

Create `packages/ai-routing/src/contracts.ts`:

```ts
export type DataClassification = "public" | "internal" | "confidential" | "local_only";

export type AiRunRequest<TInput, TOutput> = Readonly<{
  routeKey: string;
  projectId?: string;
  departmentId?: string;
  input: TInput;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  outputSchema: z.ZodType<TOutput>;
  sourceReferences: readonly string[];
  classification: DataClassification;
  timeoutMs: number;
  requiresHumanApproval: boolean;
  correlationId: string;
}>;

export interface AiProviderAdapter {
  readonly providerKey: string;
  readonly locality: "local" | "external";
  generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult>;
}
```

Provider errors normalize to `retryable`, `non_retryable`, `policy`, `timeout`, or `invalid_output`. The fake adapter returns deterministic fixtures; both OpenAI-compatible adapters use the same HTTP contract with different base URLs and locality.

- [ ] **Step 4: Persist configuration and run trace transactionally**

Add versioned `AiRoute`, `AiRouteConfig`, and `AiRun` models. Every override requires a non-empty reason and an audit event in the same transaction. Store route/config version, provider/model, scope, source references, prompt/schema versions, timing, usage/cost when present, result state, fallback chain, classification, and human-approval state. Store protected input by authorized reference, never in logs.

- [ ] **Step 5: Enforce the single-provider boundary**

Extend `scripts/validate-boundaries.mjs` so imports of provider SDKs or direct `/chat/completions` HTTP construction outside `packages/ai-routing` fail with `BOUNDARY_DIRECT_AI_PROVIDER`. Add a repository test with a prohibited fixture and an allowed adapter fixture.

- [ ] **Step 6: Verify precedence, fallback, trace, and quarantine**

```bash
pnpm --filter @evaluation/ai-routing test
pnpm exec vitest run tests/integration/ai-run-trace.integration.test.ts
pnpm lint
```

Expected: precedence is project > department > system; allowed provider failure falls back in configured order; local-only fallback stops; override without reason fails; each run is traced; invalid output is quarantined without partial persistence.

- [ ] **Step 7: Commit T011**

```bash
git add packages/database/prisma packages/ai-routing apps/api/src/ai-routing tests/integration/ai-run-trace.integration.test.ts scripts/validate-boundaries.mjs pnpm-lock.yaml
git commit -m "feat: implement provider-neutral ai router"
```

---

### Task 12: T012 — Implement AI Evaluation Harness

**Files:**
- Create: `tests/ai-evals/harness.ts`
- Create: `tests/ai-evals/harness.test.ts`
- Create: `tests/ai-evals/prohibited-output.ts`
- Create: `tests/ai-evals/fixtures/manifest.json`
- Create: `tests/ai-evals/fixtures/formal-arabic.json`
- Create: `tests/ai-evals/fixtures/gulf-dialect.json`
- Create: `tests/ai-evals/fixtures/levantine-dialect.json`
- Create: `tests/ai-evals/fixtures/mixed-direction.json`
- Create: `tests/ai-evals/fixtures/prompt-injection.json`
- Create: `tests/ai-evals/fixtures/visibility-modes.json`
- Create: `tests/ai-evals/fixtures/no-rating.json`
- Create: `.github/workflows/live-ai-evals.yml`
- Modify: `vitest.workspace.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: fake adapter and output validation from T011, rubric IDs from T010.
- Produces: deterministic `runEvalCase(case, adapter): EvalResult`, prohibited-concept scanner for English and Arabic, versioned fixture provenance, and protected opt-in live-provider workflow.

- [ ] **Step 1: Write the failing prohibition test**

Create `tests/ai-evals/harness.test.ts`:

```ts
it.each([
  "Suggested rating: 4",
  "Predicted rating is exceeds expectations",
  "Employee rank: 2 of 8",
  "Productivity score: 91",
  "التقييم المقترح ٤",
  "ترتيب الموظف الثاني",
  "جاهزية التوثيق تعني أداءً منخفضًا",
])("rejects prohibited performance output: %s", async (text) => {
  const result = await scanProhibitedOutput({ text });
  expect(result.allowed).toBe(false);
});
```

Add a passing case for a factual evidence summary that states uncertainty and cites source references without rating language.

- [ ] **Step 2: Run the AI test and observe missing scanner failure**

Run: `pnpm test:ai`

Expected: FAIL because the harness and prohibited-output scanner do not exist.

- [ ] **Step 3: Implement deterministic fixture contracts**

Each manifest entry must contain `id`, `version`, `locale`, `dialect`, `classification`, `provenance`, `inputPath`, `expectedSchemaVersion`, `requiredSourceReferences`, `forbiddenConcepts`, and `expectedDisposition`. Fixtures use synthetic or explicitly licensed content only; no employee data is permitted.

The scanner checks normalized keys and text for rating recommendation, predicted rating, rank, productivity score, activity-volume inference, and Documentation Readiness conversion. It returns machine-readable violations and never rewrites the output into an allowed result.

- [ ] **Step 4: Cover routes, Arabic, dialects, visibility, and injection**

Add at least one deterministic case for formal Arabic, Gulf Arabic, Levantine Arabic, Arabic/English paths and model names, malicious instructions inside source content, each future visibility mode contract, invalid JSON, timeout, provider fallback, and the approved `Identified` pilot. The `Identified` case must retain submitted identity; private future modes must not alter the pilot route.

- [ ] **Step 5: Add protected live evaluation workflow**

The manual workflow uses read-only contents, environment approval, no pull-request trigger, encrypted repository/environment secrets, sanitized artifacts, and action SHAs from the CI lock. It reports separately from deterministic required checks.

- [ ] **Step 6: Run verification and Commit T012**

```bash
pnpm test:ai
pnpm test
node scripts/scan-secrets.mjs
git add tests/ai-evals vitest.workspace.ts package.json .github/workflows/live-ai-evals.yml
git commit -m "test: add deterministic ai evaluation harness"
```

---

### Task 13: T013 — Implement Worker and Queue Infrastructure

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0007_operations/migration.sql`
- Create: `packages/contracts/src/jobs.ts`
- Create: `packages/contracts/src/jobs.test.ts`
- Create: `apps/worker/src/queue/queue.module.ts`
- Create: `apps/worker/src/queue/job-runner.ts`
- Create: `apps/worker/src/queue/job-runner.integration.test.ts`
- Create: `apps/worker/src/queue/test.processor.ts`
- Create: `apps/worker/src/health/health.controller.ts`
- Modify: `apps/worker/src/app.module.ts`
- Modify: `apps/worker/src/main.ts`
- Create: `tests/integration/queue-reliability.integration.test.ts`

**Interfaces:**
- Consumes: Redis T002, correlation/logging T005, database T004, audit T009, AI Router T011.
- Produces: `JobEnvelopeSchema`, `enqueueJob(queue, envelope)`, versioned queue names, durable `Operation` status, processor idempotency, bounded retry, sanitized retained failure, and graceful shutdown.

- [ ] **Step 1: Write the failing job contract test**

Create `packages/contracts/src/jobs.test.ts`:

```ts
it("requires version, operation, trace, scope, and idempotency", () => {
  expect(
    JobEnvelopeSchema.parse({
      jobVersion: 1,
      jobType: "system.test",
      operationId: "4fd02cc1-2a49-4af6-a4a3-240e906495c5",
      correlationId: "9a11bb8f-79f5-4a72-a98f-2e763e97699b",
      scope: { organizationId: "cfc37f55-68f1-4c7c-b787-b76c44f02e67" },
      idempotencyKey: "system.test:fixture-1",
      payload: { value: "safe" },
    }).jobVersion,
  ).toBe(1);
});
```

- [ ] **Step 2: Run tests and observe missing queue contracts**

Run: `pnpm --filter @evaluation/contracts test -- jobs`

Expected: FAIL because `JobEnvelopeSchema` is absent.

- [ ] **Step 3: Implement durable operation and queue contracts**

`JobEnvelopeSchema` is strict and limits serialized payload size. `Operation` stores pending/running/succeeded/failed state, job type/version, idempotency key, attempt count, sanitized error code, timestamps, and result reference. A unique database constraint on idempotency key prevents duplicate protected effects.

Use queue names `<domain>:v<jobVersion>`. Configure attempts per job type, exponential backoff with bounded jitter, and immediate failure for policy, schema, and non-retryable errors. Failed jobs remain inspectable; Redis is not the only record of outcome.

- [ ] **Step 4: Add idempotent processor and trace propagation**

`job-runner.ts` parses before processing, transitions `Operation` transactionally, restores `correlationId` and trace carrier, returns the existing success for a duplicate idempotency key, and writes an audit event before an administrative replay that can alter persistent state.

- [ ] **Step 5: Verify retry, failure retention, duplicate handling, and shutdown**

Run:

```bash
pnpm db:migrate
pnpm exec vitest run tests/integration/queue-reliability.integration.test.ts
```

Expected: retryable fixture succeeds on attempt 3; non-retryable fixture stops after attempt 1; invalid payload is retained with `JOB_SCHEMA_INVALID`; duplicate enqueue produces one protected effect; API and Worker logs share the correlation ID; SIGTERM closes consumers without losing the active operation record.

- [ ] **Step 6: Commit T013**

```bash
git add packages/database/prisma packages/contracts/src/jobs.ts packages/contracts/src/jobs.test.ts apps/worker/src/queue apps/worker/src/health apps/worker/src/app.module.ts apps/worker/src/main.ts tests/integration/queue-reliability.integration.test.ts pnpm-lock.yaml
git commit -m "feat: add durable worker queue foundation"
```

---

### Task 14: T014 — Implement Evaluation Eligibility Snapshot Foundation

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0008_evaluation_eligibility/migration.sql`
- Create: `packages/contracts/src/evaluation-cycle.ts`
- Create: `packages/contracts/src/evaluation-cycle.test.ts`
- Create: `apps/api/src/evaluation-eligibility/eligibility.service.ts`
- Create: `apps/api/src/evaluation-eligibility/eligibility.service.integration.test.ts`
- Create: `apps/api/src/evaluation-eligibility/evaluation-eligibility.module.ts`
- Create: `tests/integration/identified-visibility-contract.integration.test.ts`

**Interfaces:**
- Consumes: database T004, policies T007, pilot roles T008.
- Produces: `openCycle(input): EligibilitySnapshot`, frozen `visibilityMode`, eligibility states `active | excluded | approved_leave | pending`, `recordSubmissionMarker(cycleId, employeeId, submittedAt)`, and `getCompletionStatus(cycleId, managerId)`. This task does not create Phase 4 ratings, comments, submission UI, or reports.

- [ ] **Step 1: Write the failing frozen-snapshot and immediate-visibility tests**

Create `tests/integration/identified-visibility-contract.integration.test.ts`:

```ts
it("does not block an identified submission marker on incomplete or leave entries", async () => {
  const cycle = await openPilotCycle({ visibilityMode: "identified" });
  await setEligibility(cycle.id, employeeA, "active");
  await setEligibility(cycle.id, employeeB, "approved_leave");
  await recordSubmissionMarker(cycle.id, employeeA, new Date("2026-07-15T10:00:00.000Z"));

  const completion = await getCompletionStatus(cycle.id, pilotManager.id);
  expect(completion).toContainEqual({
    employeeId: employeeA.id,
    submittedAt: "2026-07-15T10:00:00.000Z",
  });
  expect(completion).toContainEqual({ employeeId: employeeB.id, state: "approved_leave", submittedAt: null });
});
```

- [ ] **Step 2: Run test and observe missing cycle foundation**

Run: `pnpm exec vitest run tests/integration/identified-visibility-contract.integration.test.ts`

Expected: FAIL because cycle, eligibility snapshot, and completion-state persistence are absent.

- [ ] **Step 3: Add cycle and frozen snapshot models**

Create `EvaluationCycle`, `EligibilitySnapshot`, and `EligibilityEntry` with version, source reason, state, effective timestamps, and unique cycle/user entries. Opening a cycle copies eligible users and visibility mode into immutable snapshot rows. Database and service checks reject mutation after `openedAt`, except the explicitly audited pre-close transition from `pending` or `approved_leave` to `excluded` allowed by the approved rule.

- [ ] **Step 4: Implement completion status without a publication gate**

`getCompletionStatus` returns one row per frozen eligible employee with state and submitted timestamp. The pure visibility contract from T007 authorizes each submitted resource independently and never checks whether all eligible entries submitted. No field named `publishWhenComplete`, `teamComplete`, or equivalent belongs in the schema or contracts. Ratings, comments, response persistence, submission UI, and reports stay outside Phase 0.

- [ ] **Step 5: Verify freeze, leave, exclusion, and phase independence**

```bash
pnpm db:migrate
pnpm exec vitest run apps/api/src/evaluation-eligibility/eligibility.service.integration.test.ts
pnpm exec vitest run tests/integration/identified-visibility-contract.integration.test.ts
python3 scripts/validate_task_graph.py
```

Expected: eligibility and mode freeze at open; leave and exclusion are representable and audited; submitted identified responses appear immediately; all 77 task dependencies remain phase-valid with no Phase 4 dependency on Phase 5.

- [ ] **Step 6: Commit T014**

```bash
git add packages/database/prisma packages/contracts/src/evaluation-cycle.ts packages/contracts/src/evaluation-cycle.test.ts apps/api/src/evaluation-eligibility tests/integration/identified-visibility-contract.integration.test.ts
git commit -m "feat: add frozen evaluation eligibility snapshots"
```

---

### Task 15: T015 — Implement Localization and RTL Foundation

**Files:**
- Create: `packages/localization/src/locales.ts`
- Create: `packages/localization/src/catalog.ts`
- Create: `packages/localization/src/catalog.test.ts`
- Create: `packages/localization/src/catalogs/ar.json`
- Create: `packages/localization/src/catalogs/en.json`
- Create: `packages/ui/src/bidi-text.tsx`
- Create: `packages/ui/src/bidi-text.test.tsx`
- Create: `packages/ui/src/styles/tokens.css`
- Create: `packages/ui/src/styles/fonts.css`
- Create: `apps/web/src/middleware.ts`
- Modify: `apps/web/src/app/[locale]/layout.tsx`
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/public/fonts/NotoSansArabic-Variable.woff2`
- Create: `apps/web/public/fonts/Inter-Variable.woff2`
- Create: `tests/e2e/locale-shell.spec.ts`
- Create: `tests/e2e/rtl-focus.spec.ts`
- Create: `tests/e2e/mixed-direction.spec.ts`
- Create: `scripts/check-user-visible-copy.mjs`

**Interfaces:**
- Consumes: Web shell T001 and error message keys T005.
- Produces: `Locale = "ar" | "en"`, `getCatalog(locale)`, Arabic-default locale routing, root `lang/dir`, logical CSS tokens, and `<BidiText kind="auto-isolate | code | url | email | model | path | hash">`.

- [ ] **Step 1: Write the failing catalog and direction tests**

Create `packages/localization/src/catalog.test.ts`:

```ts
it("keeps Arabic and English catalogs key-identical", async () => {
  const ar = await getCatalog("ar");
  const en = await getCatalog("en");
  expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
});

it("uses Arabic as the default locale", () => {
  expect(defaultLocale).toBe("ar");
  expect(localeMetadata.ar.direction).toBe("rtl");
  expect(localeMetadata.en.direction).toBe("ltr");
});
```

Write Playwright assertions that `/` redirects to `/ar`, root HTML is `lang=ar dir=rtl`, `/en` is LTR, tab order follows DOM order, and code/path/hash samples remain LTR inside the RTL page.

- [ ] **Step 2: Run tests and observe missing locale contracts**

Run: `pnpm --filter @evaluation/localization test && pnpm test:e2e -- locale-shell`

Expected: FAIL because catalogs, routing, and locale-aware layout are absent.

- [ ] **Step 3: Implement locale metadata and typed catalogs**

Create `packages/localization/src/locales.ts`:

```ts
export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";
export const localeMetadata = {
  ar: { direction: "rtl", languageTag: "ar", dateLocale: "ar-JO" },
  en: { direction: "ltr", languageTag: "en", dateLocale: "en-GB" },
} as const satisfies Record<Locale, { direction: "rtl" | "ltr"; languageTag: string; dateLocale: string }>;
```

Catalog keys include shell navigation, role names, safe error codes, login/logout, health state, and rubric approval status. Feature code imports keys; `scripts/check-user-visible-copy.mjs` rejects hardcoded user-facing English strings outside catalog, test, and documentation files.

- [ ] **Step 4: Implement one direction-safe component tree**

Use CSS logical properties only for spacing/alignment. `BidiText` renders code, URL, email, model, path, and hash as `<bdi dir="ltr">`; auto-isolated user text renders `<bdi>`. Mirror only icons whose semantics indicate direction. Self-host the two font assets and include their licenses under `apps/web/public/fonts/LICENSES.md`; make no runtime font CDN request.

- [ ] **Step 5: Verify Arabic, English, accessibility, and mixed content**

```bash
pnpm --filter @evaluation/localization test
pnpm --filter @evaluation/ui test
pnpm test:e2e -- locale-shell rtl-focus mixed-direction
node scripts/check-user-visible-copy.mjs
```

Expected: Arabic and English keys match; both shells render; root direction is correct before paint; keyboard/focus order passes; paths, URLs, emails, model names, and hashes remain readable; no runtime font request leaves the app.

- [ ] **Step 6: Commit T015**

```bash
git add packages/localization/src/locales.ts packages/localization/src/catalog.ts packages/localization/src/catalog.test.ts packages/localization/src/catalogs packages/ui/src apps/web/src apps/web/public/fonts tests/e2e scripts/check-user-visible-copy.mjs
git commit -m "feat: establish arabic-first rtl foundation"
```

---

### Task 16: T016 — Translate and Approve the Arabic Evaluation Rubric

**Files:**
- Create: `packages/localization/src/rubric/v1.ar.json`
- Create: `packages/localization/src/rubric/translation-approval.ts`
- Create: `packages/localization/src/rubric/translation-approval.test.ts`
- Create: `scripts/export-rubric-review.mjs`
- Create: `scripts/import-approved-rubric.mjs`
- Create: `docs/rubric/arabic-v1-review.md`
- Create: `tests/integration/rubric-localization.integration.test.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0009_arabic_rubric_approval/migration.sql`

**Interfaces:**
- Consumes: approved English rubric T010 and localization T015.
- Produces: Arabic content with identical IDs/version, per-entry source hash and status, `approveArabicRubric(input, reviewer): ApprovalRecord`, and activation guard requiring complete semantic approval.

- [ ] **Step 1: Write the failing activation-guard test**

Create `packages/localization/src/rubric/translation-approval.test.ts`:

```ts
it("refuses Arabic activation while any semantic item is unresolved", () => {
  const draft = makeArabicRubric({ unresolvedIds: ["EED-03.anchor.4"] });
  expect(() => assertArabicRubricActivatable(draft)).toThrowError("RUBRIC_AR_SEMANTIC_REVIEW_REQUIRED");
});

it("requires exact English IDs, version, and source hashes", () => {
  expect(compareLocaleStructure(englishRubric, approvedArabicRubric)).toEqual([]);
});
```

- [ ] **Step 2: Run tests and observe missing approval rules**

Run: `pnpm --filter @evaluation/localization test -- translation-approval`

Expected: FAIL because Arabic review and activation contracts do not exist.

- [ ] **Step 3: Export the exact human review inventory**

`export-rubric-review.mjs` produces `docs/rubric/arabic-v1-review.md` with all 12 criteria, 60 employee anchors, Project Contribution and five anchors, five manager criteria, 25 manager anchors, definitions, examples, prompts, evidence guidance, and bias guidance. Each row includes stable ID, English source, Arabic text, reviewer disposition, and semantic note. The script fails unless the inventory counts match T010.

- [ ] **Step 4: Complete the subject-matter approval gate**

The product owner or delegated Arabic evaluation subject-matter reviewer supplies and reviews every Arabic entry. Record reviewer user ID, UTC approval time, English source hash, Arabic content hash, rubric version `1`, and decision `approved`. If adjacent rating anchors are not semantically distinct, keep the version inactive and return the specific IDs for correction. AI-generated or machine-translated text alone cannot satisfy this step.

- [ ] **Step 5: Import only the approved artifact**

`import-approved-rubric.mjs` validates the signed review inventory against the English IDs and source hash, writes canonical `v1.ar.json`, and inserts localized rows plus one approval record in a transaction. The activation service requires zero missing entries, zero unresolved dispositions, matching version/source hashes, and an authorized reviewer. Arabic cannot activate independently after the English source changes.

- [ ] **Step 6: Verify complete bilingual integrity**

```bash
node scripts/export-rubric-review.mjs
node scripts/import-approved-rubric.mjs docs/rubric/arabic-v1-review.md
pnpm db:migrate
pnpm exec vitest run tests/integration/rubric-localization.integration.test.ts
pnpm test:ai
```

Expected: exact IDs and version match; required content counts are complete; adjacent Arabic anchors remain distinct according to the signed review; activation succeeds only with approval; Arabic AI fixtures pass prohibition and semantic-reference checks.

- [ ] **Step 7: Commit T016 only after approval evidence exists**

```bash
git add packages/localization/src/rubric/v1.ar.json packages/localization/src/rubric/translation-approval.ts packages/localization/src/rubric/translation-approval.test.ts scripts/export-rubric-review.mjs scripts/import-approved-rubric.mjs docs/rubric/arabic-v1-review.md tests/integration/rubric-localization.integration.test.ts packages/database/prisma
git commit -m "feat: add approved arabic rubric v1"
```

---

### Task 17: T017 — Add Task Dependency Graph Validation

**Files:**
- Modify: `scripts/validate_task_graph.py:1-120`
- Create: `scripts/tests/test_validate_task_graph.py`
- Create: `scripts/tests/fixtures/valid.md`
- Create: `scripts/tests/fixtures/duplicate-id.md`
- Create: `scripts/tests/fixtures/unknown-dependency.md`
- Create: `scripts/tests/fixtures/cycle.md`
- Create: `scripts/tests/fixtures/later-phase-dependency.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `TASKS.md` and CI T003.
- Produces: `validate_task_graph(path: Path) -> ValidationResult`, CLI exit `0` only for valid graphs, machine-readable diagnostics for duplicate ID, unknown dependency, cycle, and later-phase dependency.

- [ ] **Step 1: Write the failing validator regression tests**

Create `scripts/tests/test_validate_task_graph.py`:

```python
from pathlib import Path
import unittest

from scripts.validate_task_graph import validate_task_graph

FIXTURES = Path(__file__).parent / "fixtures"

class TaskGraphTests(unittest.TestCase):
    def test_valid_graph(self):
        self.assertEqual(validate_task_graph(FIXTURES / "valid.md").errors, [])

    def test_duplicate_id(self):
        self.assertIn("DUPLICATE_TASK_ID:T001", validate_task_graph(FIXTURES / "duplicate-id.md").errors)

    def test_unknown_dependency(self):
        self.assertIn("UNKNOWN_DEPENDENCY:T999", validate_task_graph(FIXTURES / "unknown-dependency.md").errors)

    def test_cycle(self):
        self.assertTrue(any(error.startswith("DEPENDENCY_CYCLE:") for error in validate_task_graph(FIXTURES / "cycle.md").errors))

    def test_later_phase_dependency(self):
        self.assertIn("LATER_PHASE_DEPENDENCY:T001->T018", validate_task_graph(FIXTURES / "later-phase-dependency.md").errors)

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests and observe the import/path failure**

Run: `python3 -m unittest scripts.tests.test_validate_task_graph -v`

Expected: FAIL because the current script executes only against the repository file and does not expose the required path-based result interface.

- [ ] **Step 3: Refactor the validator without changing valid behavior**

Expose a frozen `ValidationResult` dataclass with `task_count` and ordered `errors`. Accept an optional CLI path defaulting to `TASKS.md`; parse task ID, phase, and dependencies; reject duplicates and unknown IDs; detect cycles with an explicit visiting stack; reject an edge from an earlier phase to a later phase. Print `TASK GRAPH VALID: <count> tasks` on success and one diagnostic per line on failure.

- [ ] **Step 4: Run positive and negative verification**

```bash
python3 -m unittest scripts.tests.test_validate_task_graph -v
python3 scripts/validate_task_graph.py TASKS.md
python3 scripts/validate_task_graph.py scripts/tests/fixtures/later-phase-dependency.md
```

Expected: five unit tests pass; the repository graph reports `TASK GRAPH VALID: 77 tasks`; the invalid fixture exits nonzero and prints `LATER_PHASE_DEPENDENCY:T001->T018`.

- [ ] **Step 5: Ensure CI runs validation before and after install**

Keep the dependency-free Python invocation in the `integrity` job and `pnpm validate:task-graph` in the installed `quality` job. Both must use `TASKS.md`; fixture tests run in the unit suite. Replace the transitional integration commands with strict `pnpm test:integration`, `pnpm test:ai`, and `pnpm test:e2e` commands now that every suite contains real tests.

- [ ] **Step 6: Run the complete Phase 0 gate**

```bash
python3 scripts/validate_task_graph.py
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:integration
pnpm test:ai
pnpm test:e2e
pnpm db:verify
node scripts/scan-secrets.mjs
git diff --check
```

Expected: 77 valid tasks; frozen install; zero lint/type/test/build/migration/secret-scan failures; all three applications build; infrastructure, AI, Arabic/English, RTL, authorization, audit, queue, and migration checks pass.

- [ ] **Step 7: Update operational continuity artifacts**

Modify `project-state/PROJECT_STATE.md:1-97` with the achieved Phase 0 reality, unresolved operational risks, protected areas, exact verification evidence, and next recommended action. Modify `project-state/SYSTEM_MAP.html:1-234` only where implemented boundaries or flow state differ from the approved map; render it and visually verify Web → API → Queue → Worker, database authority, AI Router boundary, OIDC, audit, and localization.

- [ ] **Step 8: Commit T017 and Phase 0 verification record**

```bash
git add scripts/validate_task_graph.py scripts/tests .github/workflows/ci.yml package.json project-state/PROJECT_STATE.md project-state/SYSTEM_MAP.html
git commit -m "test: enforce phase-valid task dependencies"
```

---

## Phase 0 Completion Gate

Do not report Phase 0 complete until all of the following evidence exists in the same implementation branch:

- Clean `pnpm install --frozen-lockfile` on Node `24.18.0` and pnpm `11.13.0`.
- Web, API, and Worker build and start independently; liveness and readiness are distinct.
- PostgreSQL, Redis, MinIO, and Keycloak pass real integration checks using immutable images.
- Empty-database and previous-snapshot migrations pass; schema drift is absent.
- Valid, invalid, expired, wrong-audience, and deactivated authentication cases pass.
- Authorization matrix passes, including manager/admin separation, cross-scope denial, and immediate identified-response visibility without team completion.
- Audit mutation is rejected by PostgreSQL and unauthorized query is denied.
- English rubric counts, weights, source hash, and immutable activation match the approved document.
- AI route precedence, allowed fallback, local-only denial, output quarantine, run trace, and no-rating/no-ranking fixtures pass.
- Queue retry, non-retryable failure, duplicate idempotency, retained failure, trace propagation, and graceful shutdown pass.
- Eligibility and visibility snapshots freeze correctly; approved leave does not hide other responses.
- Arabic/English catalog parity, RTL focus order, mixed-direction isolation, self-hosted fonts, and user-visible-copy scan pass.
- T016 has explicit Arabic semantic approval; without it, report Phase 0 as blocked at that approval gate rather than complete.
- Task graph reports exactly 77 valid tasks and every negative fixture fails for the intended reason.
- GitHub Actions passes on the implementation branch, including proof that an intentional assertion failure is detected and the restored branch returns green.

## Self-Review and Coverage Check

### Task coverage

| Source task | Plan task | Coverage result |
|---|---:|---|
| T001 Monorepo | 1 | Apps, packages, strict tooling, boundary test, install/build verification |
| T002 Infrastructure | 2 | PostgreSQL, Redis, MinIO, Keycloak, health, persistence, reset guard |
| T003 CI | 3 | Pinned Actions, least privilege, install/quality/build/integration gates, intentional failure proof |
| T004 Database | 4 | Prisma package, empty/rebuild migration, drift, test database, destructive guard |
| T005 Logging/errors | 5 | Safe envelope, correlation, redaction, health, API/Worker trace carrier |
| T006 Authentication | 6 | PKCE, OIDC validation, sync, expiry, audience, deactivation |
| T007 Authorization | 7 | All seven roles, scoped deny-by-default policy, negative and identified-pilot cases |
| T008 Pilot seed | 8 | LeapAI, AI department, idempotency, distinct manager/admin identities |
| T009 Audit | 9 | Append-only service/table/trigger, safe payload, authorized query |
| T010 English rubric | 10 | 12/60, Project Contribution, 5/25 manager, 100%, source comparison, immutability |
| T011 AI Router | 11 | Route precedence, adapters, fallback policy, audit, trace, structured validation, quarantine |
| T012 AI harness | 12 | English/Arabic, Gulf/Levantine, mixed direction, injection, privacy modes, rating prohibition |
| T013 Worker/queue | 13 | Versioning, idempotency, bounded retry, retained failure, durable operation, trace |
| T014 Eligibility | 14 | Frozen active/excluded/leave/pending snapshot, completion status, no full-team gate |
| T015 Localization | 15 | Arabic default, English, RTL, catalogs, bidi, typography, date/number metadata, accessibility |
| T016 Arabic rubric | 16 | Full content inventory, structural parity, semantic human gate, activation protection |
| T017 Task graph | 17 | IDs, dependencies, cycles, phase order, positive and negative CI checks |

### Design coverage

| Design area | Covered by |
|---|---|
| Monorepo, process boundaries, strict ESM TypeScript | Tasks 1, 3 |
| PostgreSQL/Prisma, migration safety, UTC/UUIDs | Tasks 2, 4, 6, 8–11, 13–16 |
| Redis/BullMQ reliability | Tasks 2, 13 |
| S3-compatible private storage foundation | Task 2 infrastructure checks; full upload is explicitly outside Phase 0 |
| OIDC/Keycloak and scoped RBAC | Tasks 2, 6, 7, 8 |
| Append-only audit | Task 9 and audit consumers in Tasks 11, 13, 14, 16 |
| AI Router/adapters/run trace/validation | Tasks 11, 12 |
| Arabic/English, RTL, bidi, fonts | Tasks 12, 15, 16 |
| Rubric governance and Arabic approval | Tasks 10, 16 |
| CI, testing, secrets, observability | Tasks 3, 5, 12, 17 |
| Pilot `Identified` immediate visibility | Tasks 7 and 14; regression evidence required in completion gate |
| Future privacy modes without pilot restriction | Tasks 12 and 14 contracts only |
| Protected no-rating/no-ranking/readiness rules | Tasks 7, 10–12, completion gate |
| Operational continuity | Task 17 state/map update and final verification record |

### Self-review result

- **Spec coverage:** all design sections and every source task T001–T017 map to a task or an explicit Phase 0 exclusion.
- **Unfinished-marker scan:** no unresolved implementation marker is present; T016 is an explicit human approval gate with defined input, validation, evidence, and stop condition.
- **Type consistency:** `AuthenticatedPrincipal`, `Decision`, `AuditEventInput`, `AiRunRequest`, `AiProviderAdapter`, `JobEnvelope`, `Operation`, `EvaluationCycle`, and `EligibilitySnapshot` have one owning task and stable downstream consumers.
- **Dependency consistency:** the written order respects every dependency in `TASKS.md`; no Phase 0 task consumes a Phase 1–5 implementation.
- **Protected-rule consistency:** no AI rating or ranking, no Documentation Readiness performance conversion, no full-team publication gate, no role conflation, and no Arabic activation without semantic approval.
- **Scope consistency:** object upload UI, GitHub App ingestion, product evaluation screens, coaching, full leave/delegation, deployment, and later product domains remain excluded.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-15-phase-0-foundation-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — use `superpowers:subagent-driven-development`; dispatch a fresh subagent per task and perform two-stage review between tasks for faster, isolated iteration.
2. **Inline Execution** — use `superpowers:executing-plans`; execute tasks in this session in batches with explicit verification checkpoints.

Do not begin either option until the user chooses one.
