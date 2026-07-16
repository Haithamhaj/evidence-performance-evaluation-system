# Phase 0 Foundation Design

**Project:** Evidence-Based Performance Evaluation System

**Date:** 2026-07-15

**Status:** Approved for implementation planning; implementation method not yet selected

**Scope:** Phase 0 only — Tasks T001–T017

**Parent sources:** `docs/PROJECT_REFERENCE.md`, `docs/EVALUATION_RUBRIC.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/REVIEW_RESOLUTION.md`, `AGENTS.md`, and `TASKS.md`

> **Superseding decision — 2026-07-17:** Phase 0 is complete without T016 semantic approval. English-only pilot use is permitted. T016 remains draft, inactive, and deferred on `deferred/arabic-rubric-v1`; Arabic employee use remains blocked until its direct human semantic reviews and activation conditions pass. Existing localization and RTL foundations remain unchanged.

## 1. Purpose and decision summary

Phase 0 creates the technical and governance foundations needed by every later phase. It does not implement project, evidence, evaluation, coaching, or continuity product workflows.

The recommended foundation is a TypeScript modular monolith in one pnpm workspace, coordinated by Turborepo and deployed as three independent processes:

- Next.js Web for role-specific Arabic-first and English user interfaces.
- NestJS API for domain rules, authorization, transactions, persistence, and public contracts.
- NestJS Worker for BullMQ consumers, AI work, document jobs, notification jobs, and later integration jobs.

PostgreSQL is authoritative. Redis is non-authoritative queue and lock infrastructure. S3-compatible object storage holds files and large artifacts. Keycloak supplies the local OIDC environment. All AI access passes through a provider-neutral AI Router. Localization, RTL, authorization, audit, eligibility snapshots, structured AI output, and task-graph validation are foundations rather than later retrofits; only Arabic employee release waits for T016 semantic approval.

The design intentionally keeps the user-facing surface simple while making internal boundaries explicit and testable.

## 2. Facts, assumptions, and recommendations

### 2.1 Approved facts

- The architecture is a modular monolith, not microservices.
- Web, API, and Worker are separate processes.
- PostgreSQL, Prisma, Redis/BullMQ, S3-compatible storage, OIDC, and a provider-neutral AI Router are approved.
- English-only pilot use is permitted. Arabic employee use requires approved Arabic rubric content and semantic review; RTL remains an Arabic-release requirement.
- AI must never assign or recommend performance ratings.
- Cycle 1 is `Calibration — Non-Baseline`.
- The pilot manager evaluation is `Identified`; the manager sees identity, status, ratings, comments, and timestamps.
- Future privacy modes remain configurable and frozen into a cycle snapshot.
- Documentation Readiness is operational context, never a performance score.

### 2.2 Implementation assumptions

- The pilot runs as a containerized single-organization deployment before any Kubernetes work.
- The implementation branch will pin exact stable dependency and container versions after compatibility checks; floating `latest` tags are prohibited in committed configuration.
- Local development may use one PostgreSQL server with separate databases and credentials for the application and Keycloak.
- External AI provider choices and production hosting remain environment decisions; Phase 0 must work with a deterministic fake adapter and an OpenAI-compatible adapter.
- Arabic rubric content cannot be activated until the product owner or delegated subject-matter reviewer approves semantic equivalence.

### 2.3 Recommendation

Use Node.js 24 LTS, pnpm 11 workspaces, Turborepo, strict ESM TypeScript, and exact lockfile versions selected during plan execution. Node 24 is the current LTS line as of this design date; Node 26 remains Current until its LTS promotion. No early-access or preview dependency is allowed for a core foundation.

## 3. Alternatives considered

### 3.1 Recommended: pnpm workspaces with Turborepo

**Why:** pnpm provides strict workspace dependency declaration and a single lockfile; Turborepo adds a small task graph, caching, and filtered execution without imposing application architecture.

**Trade-offs:** two tools instead of one; cache configuration must be correct; workspace cycles must be rejected.

**Fit:** best balance between simplicity, repeatability, and future repository size.

### 3.2 Alternative: pnpm workspaces only

**Benefits:** fewer tools and the smallest bootstrap.

**Costs:** root scripts become hand-maintained orchestration; affected-package execution, task dependencies, and caching become harder as apps and packages grow.

**Decision:** acceptable for a small repository, but the approved product spans three processes and many shared packages. The small initial saving is unlikely to survive Phase 1.

### 3.3 Alternative: Nx integrated monorepo

**Benefits:** strong generators, dependency graph enforcement, affected execution, and mature plugins.

**Costs:** a larger framework surface, more generated configuration, more upgrade coupling, and a greater risk that repository conventions become Nx-specific.

**Decision:** not selected. Its extra capabilities do not yet justify the additional abstraction.

## 4. Final monorepo structure

```text
/
├── apps/
│   ├── web/                    # Next.js App Router; no direct database or queue access
│   ├── api/                    # NestJS HTTP API and transactional domain modules
│   └── worker/                 # NestJS standalone application and BullMQ processors
├── packages/
│   ├── contracts/              # Framework-neutral Zod schemas and public types
│   ├── config/                 # Typed environment contracts; no secret values
│   ├── database/               # Prisma schema, client factory, migrations, repositories
│   ├── auth/                   # OIDC claims, token validation helpers, identity mapping
│   ├── permissions/            # Deny-by-default policy engine and scoped decisions
│   ├── audit/                  # Append-only audit contracts and persistence service
│   ├── ai-routing/             # Router, adapters, route policy, run trace, output validation
│   ├── localization/           # Catalogs, locale metadata, direction, rubric content schema
│   ├── observability/          # Logging, trace propagation, metrics, health contracts
│   ├── ui/                     # Accessible tokens and shared primitive components
│   └── test-utils/             # Factories, fake adapters, fixtures, and test setup
├── tests/
│   ├── e2e/                    # Playwright critical-flow tests
│   ├── integration/            # Cross-package and infrastructure verification
│   └── ai-evals/               # Versioned deterministic AI evaluation fixtures
├── infra/
│   ├── docker/                 # Compose, health checks, realm import, local service config
│   └── deployment/             # Reserved for later deployment manifests; no K8s in Phase 0
├── docs/
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── project-state/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.base.json
└── AGENTS.md
```

Only packages required by Phase 0 are created in Phase 0. Later packages such as document processing, GitHub integration, evidence, and notifications are added when their owning phase begins; empty placeholder packages are not created.

Every package has one documented public entry point. Cross-package imports use package exports, never another package's `src` path. `workspace:*` is required for internal dependencies, and workspace dependency cycles fail installation and CI.

## 5. Process and dependency boundaries

### 5.1 Web process

The Web process owns routing, rendering, accessible interactions, locale selection, session initiation, and presentation. It may call the API through generated/typed contracts. It must not import `packages/database`, connect to Redis, process BullMQ jobs, or call an AI provider.

React Server Components are the default. Client components are used only when browser state or interaction requires them. The web shell renders Arabic by default and sets `lang` and `dir` at the root before content is painted.

### 5.2 API process

The API is the only public transactional application boundary. NestJS feature modules own use cases, domain rules, authorization checks, and repositories. Controllers validate input against shared contracts and delegate to application services. Controllers never contain business rules.

The API may enqueue a versioned job but must not perform long AI, document, or integration work during a request. A successful enqueue returns an operation identifier and durable state that can be polled.

### 5.3 Worker process

The Worker has no public product API. It consumes versioned BullMQ job contracts, calls the AI Router or other approved integration ports, and persists results through the package or module that owns the record. It cannot bypass authorization-independent domain invariants merely because work is asynchronous.

The Worker exposes only internal health/readiness endpoints. Every processor supports idempotency, bounded retries, trace propagation, safe failure state, and graceful shutdown.

### 5.4 Shared package rules

- `contracts` contains runtime schemas and types but no React, NestJS, Prisma, or provider SDK dependency.
- `database` owns Prisma and database connectivity. Consumers do not export Prisma models as public domain contracts.
- `permissions` is pure and testable. Framework guards adapt requests to policy inputs.
- `ai-routing` is the only package allowed to depend on AI provider adapters.
- `ui` contains presentation primitives and tokens, not product workflows.
- `localization` owns message keys and direction metadata; feature code cannot hardcode English strings.
- `observability` contains correlation and telemetry setup but never logs protected content by default.

## 6. TypeScript and repository tooling

The repository uses ESM and strict TypeScript. `tsconfig.base.json` enables at least:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `useUnknownInCatchVariables`
- `noImplicitOverride`
- `verbatimModuleSyntax`
- declaration output for shared packages

Application-specific configs extend the base: Next.js uses its supported bundler/module settings; NestJS and Node packages use Node-compatible ESM settings. TypeScript project references may be added only where they materially improve build isolation; Turborepo task dependencies remain the primary repository graph.

ESLint enforces import boundaries, unused code, unsafe promises, and no direct provider SDK imports outside `ai-routing`. Prettier provides mechanical formatting. The repository exposes consistent scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `test:ai`, and `validate:task-graph`.

## 7. Application foundations

### 7.1 Next.js

- App Router and TypeScript.
- Server Components by default.
- Locale-aware root segments and an Arabic-default redirect strategy.
- Accessible shared shell for Employee, Manager, and System Administrator roles.
- CSP-compatible asset loading and no runtime dependency on public font CDNs.
- UI primitives use CSS logical properties so RTL does not require a parallel component tree.
- API error codes are localized in the web layer; the API does not return translated business text.

### 7.2 NestJS API

- Strict NestJS application with global request validation, exception mapping, correlation IDs, OpenAPI generation, and graceful shutdown.
- Fastify may be selected as the HTTP adapter only if the implementation plan verifies compatibility with OIDC, multipart, OpenAPI, and test tooling; Express remains the lower-risk default.
- API versioning begins at `/api/v1`.
- Readiness and liveness endpoints are separate.
- A stable error envelope contains `code`, `messageKey`, `correlationId`, and optional safe field details; stack traces and secrets never leave the server.

### 7.3 NestJS Worker

- Standalone Nest application context with BullMQ processors.
- Queue registration is centralized.
- Job payloads are parsed through Zod before processing.
- Unparseable jobs fail safely and are retained for investigation.
- Queue concurrency is configured per job type, not globally.

## 8. Data and migration foundation

### 8.1 PostgreSQL and Prisma

PostgreSQL is the authoritative source for identity mappings, policy state, eligibility snapshots, rubric versions, AI routes, AI runs, and audit events. Redis and object storage cannot determine protected business state.

Prisma owns the schema and normal access path. SQL migrations may add constraints, triggers, indexes, or grants Prisma cannot express. Prisma types are not exposed as API contracts.

Phase 0 creates only the tables needed by T004–T016. It does not pre-create all later product entities.

### 8.2 Migration workflow

1. A developer changes the Prisma schema and creates a named migration locally.
2. The generated SQL is reviewed, including locks, data loss, indexes, and constraints.
3. Migration files are committed and never edited after use in a shared environment.
4. CI applies all migrations to an empty database using the deployment command.
5. CI also applies the new migration from the previous Phase 0 release snapshot.
6. Schema drift and uncommitted migration changes fail CI.
7. Production and shared environments use forward-only migrations. Recovery uses a corrective migration or tested restore, not an edited historical migration.

Local destructive reset commands are explicit, documented, and refuse non-local database URLs.

### 8.3 Initial database boundaries

- Application and Keycloak use separate databases and database users.
- Test databases are isolated from local development data.
- UTC timestamps are mandatory.
- Stable identifiers use application-generated UUIDs.
- Database constraints protect immutability and uniqueness where practical; application services add contextual rules and audit.

## 9. Redis, BullMQ, and job reliability

Redis is used only for queues, short-lived locks, idempotency assistance, and non-authoritative caching.

Each job contract includes `jobVersion`, `operationId`, `correlationId`, scope identifiers, and a deterministic idempotency key. Job identifiers prevent accidental duplicate enqueueing, while PostgreSQL records durable operation state.

Retries are bounded and use exponential backoff with jitter. Known non-retryable errors fail immediately. Failed jobs remain inspectable with sanitized error information. Reprocessing is an explicit administrative operation and creates an audit event when it can alter persisted state.

Queue names are versioned. Deployment drains or remains backward-compatible with the previous job version; a new deployment must not strand older queued payloads.

## 10. Object storage and MinIO

MinIO provides the local S3-compatible service. Buckets are private. Objects use opaque keys rather than user-provided filenames. PostgreSQL stores ownership, classification, size, content type, checksum, and object key.

Applications access objects through short-lived signed URLs issued after API authorization. Credentials are server-side only. Upload type, size, checksum, and safety-scanning interfaces are defined in Phase 0; full user upload processing belongs to Phase 1.

The Phase 0 verification proves bucket creation, put/get/delete in an isolated test prefix, signed URL expiry, and denial without authorization.

## 11. OIDC, Keycloak, and authorization

### 11.1 Authentication

Keycloak is the local OIDC provider, not a domain database. A versioned realm import defines clients, redirect URIs, test roles, and non-secret configuration. Bootstrap credentials come from ignored local environment values and CI secrets, never the repository.

The browser uses Authorization Code with PKCE. The API validates signature, issuer, audience, expiry, and required claims using OIDC discovery/JWKS. Deactivation is enforced from authoritative application state even if a token remains cryptographically valid.

OIDC subject identifiers are mapped to internal users. Provider roles may assist initial mapping but do not replace application authorization.

### 11.2 RBAC plus scoped policy

Authorization uses a deny-by-default decision contract:

```text
decide(subject, action, resource, context) -> allow | deny(reasonCode)
```

The initial vocabulary includes Employee, Manager, System Administrator, Project Owner, Workstream Owner, Contributor, and Acting Owner. Phase 0 implements role separation and representative scoped policies; later phases add resource-specific rules without changing the policy interface.

Every protected API action invokes policy enforcement server-side. UI hiding is never authorization. Negative tests are mandatory, especially manager/admin separation and cross-user manager-evaluation access.

### 11.3 Eligibility snapshot foundation

Phase 0 defines versioned eligibility records with `active`, `excluded`, `approved_leave`, and `pending` states. Opening a cycle freezes an eligibility snapshot and the feedback visibility mode. The foundation supports identified completion status without implementing the complete leave/delegation workflow.

## 12. Audit-event foundation

Audit events are append-only and contain event type, actor, effective subject, scope, target, reason where required, before/after references or safe diffs, correlation ID, request source, and UTC timestamp.

Ordinary application paths cannot update or delete audit rows. Database protections backstop the application service. Sensitive values, access tokens, credentials, raw AI prompts, and private-mode content are excluded from normal audit payloads.

Phase 0 audits at least authentication synchronization, role changes, AI route changes, overrides, rubric activation, sensitive access decisions, and administrative replay of failed work.

## 13. AI Router and structured AI runs

### 13.1 Router contract

Every AI call declares:

- a stable route key;
- project and department scope when present;
- a versioned input schema;
- a versioned output schema;
- source references;
- data classification;
- timeout and fallback policy;
- whether human approval is required.

Resolution order is Project override, Department override, then System default. An override cannot be saved without a reason and audit event. Route resolution is testable independently of providers.

### 13.2 Provider adapters

Adapters implement one provider-neutral interface. Phase 0 includes:

- a deterministic fake adapter for tests and local development;
- an external OpenAI-compatible adapter;
- a local OpenAI-compatible endpoint adapter;
- explicit extension contracts for speech and multimodal providers.

Feature modules cannot import provider SDKs or construct provider HTTP requests. Provider-specific errors are normalized into retryable, non-retryable, policy, timeout, and invalid-output categories.

Fallback occurs only when route policy and data classification allow the next provider. A local-to-external fallback is never automatic for data restricted to local processing.

### 13.3 AI run trace

Every run stores route, resolved configuration version, provider/model, scope, source references, prompt version, schema version, start/end time, latency, usage/cost when available, result state, fallback chain, and human-approval state.

Raw sensitive input is not duplicated into logs. Large or protected artifacts are referenced through authorized storage. Historical runs remain linked to the exact route configuration and are not regenerated when routing changes.

### 13.4 Structured-output validation and rating prohibition

Persisted outputs must validate before domain conversion. Invalid output is quarantined and cannot partially update domain records.

The AI evaluation harness scans schemas and representative outputs for prohibited concepts including suggested rating, predicted rating, employee rank, productivity score, or conversion of Documentation Readiness into performance. English and Arabic prohibition tests are required.

Human gates remain explicit: AI may prepare or suggest, but employees approve evidence and criteria, users choose ratings before justification help, and managers decide final ratings.

## 14. Localization, Arabic, and RTL

### 14.1 Catalog architecture

Arabic (`ar`) is the default locale and English (`en`) is required. Catalogs use identical stable keys. CI rejects missing keys, invalid ICU parameters, and unused protected keys.

The Web adapter renders catalogs; API responses return stable codes and structured data. Worker-generated notifications later use the same localization package. No feature component may hardcode user-visible English text.

### 14.2 Direction and mixed content

- The document root sets `lang="ar"` and `dir="rtl"` for Arabic.
- Layout uses logical properties such as inline start/end.
- Direction is not inferred from user text for whole pages.
- Code, URLs, email-like identifiers, model names, repository paths, and hashes render in isolated LTR containers using `bdi` or explicit direction.
- Icons mirror only when their meaning is directional.
- Keyboard and focus order follow the logical reading order.

### 14.3 Typography

Use a locally built or build-time bundled Arabic font with strong screen readability, recommended `Noto Sans Arabic`, and a compatible Latin font such as Inter. Fonts are self-hosted in produced assets; the production UI does not fetch them from a public CDN. Shared tokens control line height, numerals, and fallback fonts.

### 14.4 Rubric-version governance

English and Arabic text share stable criterion IDs and one rubric version. Each localized record has source hash, translation status, reviewer, approval timestamp, and semantic-equivalence status.

English Version 1 is the approved source. Arabic content begins as draft. Activation fails unless all required criteria, anchors, examples, prompts, and bias guidance exist and the semantic review is approved. A meaning-changing translation creates a new rubric version; it cannot silently update active or historical cycles.

### 14.5 Arabic and dialect fixtures

The Phase 0 AI evaluation set includes:

- formal Arabic project and evaluation text;
- conversational Gulf and Levantine updates;
- mixed Arabic/English technical terms, paths, code, model names, and URLs;
- incomplete and adversarial instructions embedded in uploaded content;
- cases that must not produce ratings, ranking, or performance inference;
- synthetic or explicitly licensed speech clips with golden transcripts and no real employee data.

Fixture provenance, expected result, tolerance, and privacy classification are versioned.

## 15. CI pipeline

GitHub Actions is the initial CI platform. Workflows use least-privilege permissions, concurrency cancellation, pinned action revisions, and no write token for pull-request validation.

Required checks:

1. Repository integrity and task-graph validation.
2. Frozen pnpm install.
3. Formatting check, lint, and package-boundary check.
4. Type checking.
5. Unit tests with coverage reporting.
6. Build of Web, API, and Worker.
7. Migration from empty database.
8. Migration from previous snapshot.
9. Integration tests against PostgreSQL, Redis, MinIO, and Keycloak.
10. Deterministic AI evaluation suite, including Arabic and prohibition fixtures.
11. RTL shell and accessibility smoke tests.
12. Secret-pattern and committed-environment-file scan.

Live AI provider evaluations are opt-in protected workflows, never required for an untrusted fork or ordinary pull request. Their results are recorded separately from deterministic contract tests.

The existing `scripts/validate_task_graph.py` runs before dependency installation where possible, then again through the repository script. CI includes negative fixtures for duplicate IDs, missing dependencies, cycles, and later-phase dependencies.

## 16. Testing architecture

- Vitest for pure TypeScript units, policy rules, contracts, route resolution, and UI primitives.
- Nest testing utilities plus HTTP request tests for API modules.
- Real PostgreSQL integration tests for constraints, transactions, audit immutability, and migrations.
- Real Redis/BullMQ integration tests for retry, idempotency, versioning, and failure retention.
- MinIO integration tests for private object behavior and signed access.
- Keycloak/OIDC contract tests for valid, expired, wrong-audience, deactivated, and role-separation cases.
- Playwright for Arabic/English shells, RTL focus order, login boundary, and role navigation.
- Versioned AI evaluations for schema validity, route behavior, Arabic quality, prompt injection resistance, and the no-rating rule.

Tests are isolated and deterministic. Unit tests do not require containers or network. Integration suites use unique databases, queue prefixes, and object prefixes and clean only their own resources.

Every feature and bug fix after design approval follows test-driven development: failing behavior test, minimal implementation, refactor, and full relevant verification.

## 17. Local development workflow

Target commands:

```text
corepack enable
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm verify
```

`infra:up` starts pinned PostgreSQL, Redis, MinIO, and Keycloak services with health checks. `dev` starts Web, API, and Worker together through Turborepo. Each service also has a filtered command for focused work.

The repository documents ports, health URLs, seed users, reset steps, and common recovery paths. Reset is local-only and visibly destructive. Developers can run unit tests without infrastructure and start only the required infrastructure profile for focused integration work.

Current-machine readiness check on 2026-07-15 found Node 22 and pnpm 9 available, but no Docker-compatible container runtime. Phase 0 implementation therefore requires installing or approving a supported container runtime and aligning Node/pnpm through the repository's pinned toolchain before T002 verification.

## 18. Environment variables and secrets

`packages/config` defines runtime-specific Zod schemas. Each process validates its environment at startup and fails with safe, actionable missing-key errors.

- `.env.example` contains names and non-secret local examples only.
- `.env`, `.env.*`, credentials, and local agent state remain ignored.
- Browser-exposed values require an explicit public prefix and review.
- Secrets are injected by local ignored files, CI secret storage, or the deployment secret system.
- Provider credentials, OIDC client secrets, database passwords, MinIO keys, and GitHub credentials are never logged.
- Separate credentials exist for application, migration, worker, Keycloak, and CI roles where practical.
- Rotation does not require code changes.

Configuration inheritance is explicit. Missing configuration never silently falls back to a production provider or a less-private AI route.

## 19. Observability foundation

Use structured JSON logs with stable event names, safe error codes, service name, environment, correlation ID, trace ID, operation ID, route, and duration. Human-readable pretty logs are a local presentation mode only.

OpenTelemetry-compatible tracing covers Web-to-API requests, API-to-queue enqueue, Worker job execution, database spans, and AI Router calls. Metrics cover request latency, error counts, queue depth/age, job success/failure, AI latency/fallback, and dependency health.

Telemetry excludes secrets, access tokens, raw rubric comments, uploaded content, and future private-mode response bodies. Sampling and retention are environment policies. Health endpoints distinguish process liveness from dependency readiness.

## 20. Material decision register

| Decision | Chosen approach | Alternatives | Trade-off and alignment | Later effect and risk |
|---|---|---|---|---|
| Workspace | pnpm 11 + Turborepo | pnpm only; Nx | Small orchestration layer with strict dependencies; matches TypeScript monorepo | Easier affected builds; cache errors are a risk mitigated by uncached CI verification |
| Runtime | Node 24 LTS | Node 22 LTS; Node 26 Current | Current LTS and broad framework support | Requires local upgrade; re-evaluate when Node 26 becomes LTS |
| Module format | ESM | CommonJS; mixed | One module model and alignment with modern Prisma/Next | Some packages may need compatibility work; no mixed hidden boundary |
| Web | Next.js App Router | SPA/Vite; Pages Router | Approved stack and server-first rendering | Requires disciplined client boundaries |
| API | NestJS modular API | Next route handlers; microservices | Approved modular monolith and strong guards/modules | Nest conventions add structure; avoid domain logic in decorators/controllers |
| Worker | Separate Nest context + BullMQ | API in-process jobs; separate service stack | Independent scaling without microservices | Shared packages must not become a bypass around domain rules |
| Contracts | Framework-neutral Zod | generated TS only; class-validator DTOs only | Runtime validation shared across processes | Schema duplication avoided; OpenAPI adapter must be tested |
| Database | PostgreSQL + Prisma | TypeORM; raw SQL; event sourcing | Approved authoritative relational model and migrations | Raw SQL still needed for advanced constraints; no full event sourcing |
| Jobs | Redis/BullMQ | database queue; managed cloud queue | Approved stack and strong local parity | Redis is non-authoritative; idempotency must persist durably |
| Objects | S3 API + MinIO local | local filesystem; database blobs | Approved portable object boundary | Signed URL and metadata consistency require integration tests |
| Identity | OIDC + Keycloak local | custom auth; vendor-only auth | Approved abstraction and portable pilot setup | Keycloak operational weight; keep application authorization independent |
| Authorization | RBAC + scoped policies | role checks only; full ABAC engine | Matches protected scope rules without policy over-engineering | Resource rules expand safely; negative-test burden is mandatory |
| Audit | Append-only table with DB protection | logs only; event sourcing | Meets traceability without event-sourcing complexity | Payload discipline required to avoid sensitive-data leakage |
| AI | Provider-neutral Router | direct SDKs; one provider | Required project/dept/system routing and trace | Adapter maintenance; enforced import boundary prevents bypass |
| AI output | Versioned Zod validation + quarantine | free text persistence; best-effort parsing | Protects domain state and human gates | Invalid outputs become visible operational failures, not silent partial data |
| Localization | Shared keyed catalogs with Arabic/RTL foundations | web-only translation; later RTL retrofit | English-only pilot is permitted; Arabic release remains gated | Translation governance adds upfront work but prevents semantic drift |
| Styling direction | logical CSS + one component tree | separate RTL UI; automatic mirroring | Simple user experience and less visual fragmentation | Requires explicit mixed-direction testing |
| CI | GitHub Actions, deterministic default | local-only checks; another CI vendor | Fits repository governance and task graph | Private remote and governance are verified; workflow behavior is verified during Phase 0 implementation |
| Testing | unit + real infrastructure integration + Playwright + AI evals | mocks only; end-to-end only | Matches approved verification strategy | Container runtime is a local prerequisite |
| Observability | structured logs + OTel traces/metrics | console logs; vendor-specific SDK only | Portable and privacy-reviewable | Browser telemetry remains minimal until stable need exists |

## 21. Exact Phase 0 scope

Phase 0 implements and verifies T001–T017:

- monorepo, package boundaries, lint/type/build/test tooling;
- local PostgreSQL, Redis, MinIO, and Keycloak;
- CI and task-graph validation;
- Prisma package and migration workflow;
- structured logging, safe error model, health, and trace propagation;
- OIDC authentication and deactivation enforcement;
- RBAC and scoped policy foundation;
- pilot organization, department, roles, and separate manager/admin seed identities;
- append-only audit foundation;
- approved English rubric seed and Arabic approval workflow;
- AI Router, adapters, trace, structured validation, and deterministic evaluation harness;
- Worker/BullMQ foundation;
- evaluation eligibility and identified completion-state snapshot foundation;
- Arabic/English catalogs, RTL shell, mixed-direction utilities, typography, and Arabic/dialect fixtures;
- CI checks proving task IDs, dependencies, cycles, and phase order.

Phase 0 exit requires all three applications to start, authentication and representative authorization checks to pass, AI calls to be impossible outside the Router, task-graph negative tests to fail correctly, English rubric seed comparison to pass, and Arabic/English shells to pass RTL/accessibility checks.

T016 remains a product-owner approval gate: the Arabic rubric cannot become employee-visible merely because technical validation passes.

## 22. Explicit exclusions from Phase 0

- Project and Workstream CRUD or user-facing feature screens.
- Document upload, parsing, readiness analysis, and dynamic criteria workflows.
- Text/voice update workflows, evidence, contribution attribution, and disputes.
- GitHub App implementation and GitHub evidence ingestion.
- Thursday check-ins and Monthly Evaluation Readiness execution.
- Employee self-assessment, manager assessment, comparison, final ratings, closure, or reports.
- Upward manager-evaluation submission UI and reports.
- Coaching and development actions.
- Full leave, delegation, handover, offboarding, and reassignment workflows.
- Production deployment, Kubernetes, commercial tenancy, billing, HRIS, Google Drive sync, ranking, or automated employment decisions.
- Full private-mode behavior beyond configuration, schema, authorization contracts, and negative tests needed to avoid hardcoding Identified behavior.

## 23. Protected-rule verification

Phase 0 automated checks must prove:

- no AI schema or fixture output contains a rating recommendation or employee ranking;
- Documentation Readiness types cannot be assigned to a performance-rating field;
- raw GitHub/activity counts do not exist as performance inputs;
- rubric and visibility configurations are versioned and snapshot-capable;
- closed/active immutability contracts exist before later feature tables use them;
- pilot visibility is `Identified`, with no anonymity text in catalogs;
- future private modes remain representable but do not restrict the pilot manager's authorized identified access;
- Arabic and English rubric content share IDs and version, and Arabic activation requires semantic approval;
- manager and System Administrator seed identities and permissions remain separate.

## 24. Known risks and mitigations

### 24.1 GitHub repository and authentication

GitHub authentication is operational. The private repository is published at `https://github.com/Haithamhaj/evidence-performance-evaluation-system`, `main` is the default branch, the local `origin` targets that repository, and the local and remote design commit hashes were verified as equal. The six phase milestones and 23 required governance labels are configured. GitHub Pages remains disabled. Phase 0 still needs to implement and exercise the planned GitHub Actions workflows; repository availability is no longer a blocker.

### 24.2 Local container runtime

No Docker, Podman, Colima, or equivalent command is currently available. T002 and infrastructure integration tests require an approved runtime installation before execution.

### 24.3 Arabic semantic approval

Automated parity checks cannot approve evaluation meaning. T016 needs human subject-matter review. The system must keep Arabic content inactive until that approval exists.

### 24.4 Resolved publication-rule contradiction

With explicit document-owner approval, `docs/PROJECT_REFERENCE.md` section 27.2 now matches sections 24.3 and 24.4: approved leave may postpone or exclude one employee's evaluation, but it does not block other identified responses. Each pilot response is visible to the manager immediately after submission with employee identity, criterion ratings, written comments, and timestamp, while completion status remains visible by eligible employee. No full-team publication gate applies to the pilot `Identified` mode.

### 24.5 Package and framework compatibility

The implementation plan will record exact stable versions and run a compatibility spike before the first scaffold commit. Preview releases are excluded. Lockfile and container digests make builds reproducible.

### 24.6 Boundary erosion

Shared packages can become hidden coupling. Public exports, import linting, ownership documentation, and contract tests prevent Web-to-database access, direct AI SDK calls, and arbitrary cross-domain persistence.

## 25. Phase dependency check

The design preserves the validated order:

- T001 enables tooling, Web shell, and later apps.
- T002 precedes database-backed auth and worker infrastructure.
- T004 precedes identity mappings, audit, rubric, AI routes, and eligibility.
- T006 precedes scoped authorization.
- T009 precedes auditable AI route overrides.
- T011 precedes the AI evaluation harness and all later AI-dependent features.
- T013 precedes asynchronous document, GitHub, notification, and aggregation work.
- T015 precedes Arabic rubric approval and all employee-facing screens.
- T003 precedes CI task-graph enforcement.

No Phase 0 decision depends on a later feature module. Later modules consume stable contracts from Phase 0 rather than being preimplemented inside it.

## 26. Self-review record

- **Unfinished-marker scan:** no unfinished marker or unresolved implementation placeholder remains.
- **Contradiction scan:** the identified-pilot publication contradiction is resolved in `docs/PROJECT_REFERENCE.md` section 27.2 and recorded in Section 24.4; no full-team gate applies to the pilot.
- **Ambiguity scan:** process ownership, data authority, AI routing, localization activation, and Phase 0 boundaries are explicit.
- **Scope check:** limited to T001–T017 and their verification foundations.
- **Protected-rule check:** AI rating, readiness/performance separation, no ranking, non-retroactivity, immutability, human final judgment, calibration, and identified pilot behavior are preserved.
- **Repository consistency check:** package names and structure extend the approved implementation plan without changing architecture.
- **Phase dependency check:** blocking foundations precede all consumers.
- **Arabic/RTL coverage check:** catalogs, typography, direction, mixed content, fixtures, approval, CI, and accessibility are included.
- **Pilot identified-manager-evaluation check:** identity and visibility remain permitted; no anonymity gate is reintroduced.
- **Future privacy-configuration check:** cycle-frozen modes and isolated future contracts remain representable.
- **Security and secret-management check:** OIDC validation, scoped policy, private storage, audit, secret injection, safe logs, and CI least privilege are defined.
- **Testing-boundary check:** unit, integration, migration, authorization, AI, Arabic, RTL, and infrastructure tests have separate responsibilities.

## 27. Approval gate

Product-owner approval was recorded on 2026-07-15. It authorizes creation of the detailed Phase 0 implementation plan only. It does not authorize implementation, dependency installation, worktree creation, a pull request, or merging.

After explicit approval, the next artifact is:

`docs/superpowers/plans/2026-07-15-phase-0-foundation-plan.md`

The plan maps every task T001–T017 to exact files, failing tests, commands, expected results, interfaces, migrations, frequent commits, and verification evidence. After plan review, work stops at the execution-method choice until the product owner selects an option.

## 28. Official technical references checked

- Node.js release status: https://nodejs.org/en/about/previous-releases
- pnpm workspaces: https://pnpm.io/workspaces
- Turborepo repository structure: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository
- Next.js installation requirements: https://nextjs.org/docs/app/getting-started/installation
- NestJS first steps and runtime requirements: https://docs.nestjs.com/first-steps
- Prisma ORM: https://www.prisma.io/docs/orm
- BullMQ workers: https://docs.bullmq.io/guide/workers
- Keycloak containers and health: https://www.keycloak.org/server/containers
- OpenTelemetry JavaScript: https://opentelemetry.io/docs/languages/js/
