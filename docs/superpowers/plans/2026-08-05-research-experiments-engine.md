# Research & Experiments Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bounded Research & Experiments engine, including safe link-to-Project relevance review, versioned research, reproducible experiments, human-confirmed decisions, applied learning, and neutral Timeline/readiness/Fact View composition.

**Architecture:** Add one `@evaluation/research-experiments` package and one NestJS API module inside the existing modular monolith. The new domain owns Research/Experiment lifecycle and persistence; Projects, Work Items, Documents, Connected Work Context, Updates & Evidence, Timeline composition, Evaluation Preparation, authorization, audit, and AI Router retain their current ownership and are consumed only through public interfaces. The web work is a minimal bilingual contract-verification surface, not the final frontend.

**Tech Stack:** Node.js 24.18.0, pnpm 11.13.0, TypeScript 7.0.2, NestJS 11.1.28, Next.js App Router, React, Prisma 7.8.0/PostgreSQL, Zod 4.4.3, Vitest 4.1.10, Playwright 1.61.1, existing AI Router, audit writer, OIDC, and private-context encryption.

## Global Constraints

- Preserve every protected product, privacy, history, authorization, audit, localization, and AI rule in `AGENTS.md`.
- AI never assigns, predicts, recommends, normalizes, or challenges an employee or manager rating.
- Research volume, source count, Experiment count, run count, token count, duration, Update frequency, GitHub activity, commits, files, and lines changed never become Project progress or employee performance inputs.
- A Research Record requires one Project; Workstream and Work Item are optional and must belong to that Project.
- One Research Record may contain multiple Experiments.
- AI drafts; an employee confirms shared sources, Research activation, official Tasks, conclusions, decisions, Evidence links, and Applied Learning.
- A source link and review remain private until the employee confirms Project sharing.
- Source relevance is not proof of Project benefit, Experiment outcome, employee contribution, or Applied Learning.
- Every production AI call uses the existing AI Router and a versioned prompt/output schema with source references and route trace.
- All persisted timestamps are UTC; user rendering uses the existing timezone behavior with pilot default `Asia/Riyadh`.
- Historical revisions, runs, observations, conclusions, participant events, transitions, and domain events are append-only.
- Do not add a second Evidence store, generic activity platform, authentication system, database, microservice, notebook runner, repository executor, or MLflow replacement.
- Do not build the final frontend. Implement only the verification route described in Task 12.
- Use Fast Controlled Execution: one specification-compliance review and one security/integrity review for migration, source retrieval, privacy, AI, authorization, audit, and immutability; remediate only confirmed P0/P1 findings and re-review only corrected findings.
- Do not require live Google, live GitHub App installation, private repository credentials, paid source access, or a live AI provider for deterministic acceptance.

---

## File and ownership map

| Area               | Files                                                                                                            | Responsibility                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Contracts          | `packages/contracts/src/research-experiments.ts`                                                                 | Versioned public command/result schemas; no provider or persistence logic      |
| Domain             | `packages/research-experiments/src/*`                                                                            | Research/Experiment rules, source review, persistence services, public readers |
| Persistence        | `packages/database/prisma/schema.prisma`, migration `0027_research_experiments`                                  | Owned rows, constraints, indexes, append-only protection                       |
| Existing owners    | `packages/projects`, `packages/work-items`, `packages/documents`, `packages/updates-evidence`                    | Narrow public readers/commands only; no Research table access                  |
| API composition    | `apps/api/src/research-experiments/*`                                                                            | OIDC guard, adapters, AI Router composition, controllers                       |
| Timeline/Fact View | `packages/updates-evidence`, `packages/evaluation-preparation`, API modules                                      | Compose authorized Research facts through the public Research readers          |
| Verification web   | `apps/web/src/platform/research-experiments-*`, `apps/web/src/app/api/research`, localized Research route        | Minimal link-to-decision journey and recovery proof                            |
| Acceptance         | `scripts/seed-research-experiments-acceptance.ts`, `tests/e2e/research-experiments.spec.ts`, acceptance document | Deterministic real-database journey and screenshots                            |

---

### Task 1: Add versioned Research & Experiments contracts and package boundary

**Files:**

- Create: `packages/contracts/src/research-experiments.ts`
- Create: `packages/contracts/src/research-experiments.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/research-experiments/package.json`
- Create: `packages/research-experiments/tsconfig.json`
- Create: `packages/research-experiments/src/index.ts`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

**Interfaces:**

- Consumes: `AppError`, existing UUID/UTC conventions, `ExecutionModeSchema`, and Evidence/Fact View source-reference conventions.
- Produces: the schemas and types all later tasks import; the package exports remain empty except for those types until the relevant task implements them.

- [ ] **Step 1: Write failing schema tests**

Create tests that require the exact lifecycle enums, strict inputs, URL limits, Project-required scope, nullable Workstream/Work Item, one-or-more citations for a completed review, normalized Experiment measures, and prohibited-field rejection:

```ts
expect(() =>
  ResearchSourceReviewOutputSchema.parse({
    schemaVersion: "research-source-review-output.v1",
    summary: "Useful retrieval approach.",
    relevance: "May reduce retrieval latency for this Project.",
    citations: [],
    benefits: [],
    risks: [],
    mismatches: [],
    uncertainties: [],
    disposition: "DRAFT_EXPERIMENT",
    proposals: [],
    suggestedRating: 5,
  }),
).toThrow();
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
pnpm exec vitest run --root . packages/contracts/src/research-experiments.test.ts
```

Expected: FAIL because `research-experiments.ts` does not exist.

- [ ] **Step 3: Implement the strict public schemas**

Define and export these exact roots and types:

```ts
export const ResearchStateSchema = z.enum([
  "DRAFT",
  "ACTIVE",
  "CONCLUDED",
  "CANCELLED",
  "SUPERSEDED",
]);
export const ExperimentStateSchema = z.enum([
  "DRAFT",
  "READY",
  "RUNNING",
  "RESULT_RECORDED",
  "CONCLUDED",
  "ABANDONED",
  "SUPERSEDED",
]);
export const ResearchSourceReviewStateSchema = z.enum([
  "PENDING_RETRIEVAL",
  "READY_FOR_REVIEW",
  "PARTIAL",
  "BLOCKED",
  "CONFIRMED",
  "DISMISSED",
  "STALE",
]);
export const ResearchScopeSchema = z
  .object({
    projectId: z.string().uuid(),
    workstreamId: z.string().uuid().nullable(),
    workItemId: z.string().uuid().nullable(),
  })
  .strict();
```

Also export strict schemas for `CreateResearchSourceReviewInput`, `ResearchSourceReviewOutput`, `ResearchSourceReviewProposal`, `ResearchSourceReviewDetail`, `ConfirmResearchSourceDispositionInput`, `CreateResearchInput`, `ReviseResearchInput`, `TransitionResearchInput`, `TransferResearchOwnerInput`, `CreateExperimentInput`, `ReviseExperimentMethodInput`, `RecordExperimentRunInput`, `ConcludeExperimentInput`, `ConcludeResearchInput`, `CreateAppliedLearningInput`, `LinkResearchEvidenceInput`, `ResearchDetail`, and `ExperimentDetail`. `CreateResearchSourceReviewInput.source` is a strict union of `{ kind: "URL"; url }`, `{ kind: "CONNECTED_CONTEXT"; sourceItemId }`, and `{ kind: "DOCUMENT_VERSION"; documentVersionId }`; every path still requires `ResearchScopeSchema`. Use `.strict()` at every object boundary and exclude every rating/rank/productivity/progress-volume field. The `Research` prefix prevents collision with the existing Updates & Evidence `SourceReviewStateSchema` export.

- [ ] **Step 4: Add the workspace package without new third-party dependencies**

Use this manifest shape:

```json
{
  "name": "@evaluation/research-experiments",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@evaluation/ai-routing": "workspace:*",
    "@evaluation/contracts": "workspace:*",
    "@evaluation/database": "workspace:*",
    "zod": "4.4.3"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint src",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --root ../.. packages/research-experiments/src --exclude '**/*.integration.test.ts'",
    "test:integration": "vitest run --root ../.. packages/research-experiments/src --include '**/*.integration.test.ts'"
  }
}
```

Add the workspace dependency to root, API, and web manifests, then run `pnpm install --lockfile-only` so `pnpm-lock.yaml` records only the new workspace links.

- [ ] **Step 5: Verify GREEN and package boundaries**

Run:

```bash
pnpm exec vitest run --root . packages/contracts/src/research-experiments.test.ts
pnpm --filter @evaluation/contracts typecheck
pnpm --filter @evaluation/research-experiments typecheck
pnpm scan:ai-boundary
```

Expected: all pass; the new package contains no provider SDK import.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml apps/api/package.json apps/web/package.json packages/contracts packages/research-experiments
git commit -m "feat: define research experiment contracts"
```

---

### Task 2: Add the forward-only Research & Experiments schema

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0027_research_experiments/migration.sql`
- Create: `packages/database/src/research-experiments-schema.integration.test.ts`
- Modify: `scripts/run-integration-tests.mjs`

**Interfaces:**

- Consumes: `User`, `Project`, `Workstream`, `WorkItem`, `EvidenceRecord`, `DocumentVersion`, `AiRun`, and audit-safe UUID/UTC patterns.
- Produces: Prisma models used by every persistence service from Task 6 onward.

- [ ] **Step 1: Write the failing migration verification**

Assert that all owned tables exist, required scope is non-null, optional scope is nullable, normalized method children exist, uniqueness is enforced, and prohibited performance/progress-volume columns do not exist:

```ts
expect(new Set(tableNames)).toEqual(
  new Set([
    "ResearchRecord",
    "ResearchRevision",
    "ResearchParticipantEvent",
    "ResearchTransition",
    "ResearchSourceReview",
    "ResearchSourceReviewRevision",
    "ResearchSourceReference",
    "ResearchProposal",
    "ResearchProposalTransition",
    "Experiment",
    "ExperimentMethodRevision",
    "ExperimentMeasure",
    "ExperimentTestCase",
    "ExperimentControl",
    "ExperimentRun",
    "ExperimentObservation",
    "ExperimentConclusion",
    "ResearchConclusion",
    "AppliedLearning",
    "ResearchEvidenceLink",
  ]),
);
expect(forbiddenColumns).toEqual([]);
```

- [ ] **Step 2: Run the database test and verify RED**

Run:

```bash
pnpm db:generate
pnpm exec vitest run --root . packages/database/src/research-experiments-schema.integration.test.ts
```

Expected: FAIL because migration `0027` and models do not exist.

- [ ] **Step 3: Add exact lifecycle enums and roots**

Add Prisma enums matching Task 1 and these mutable roots:

```prisma
model ResearchRecord {
  id            String        @id @default(uuid()) @db.Uuid
  projectId     String        @db.Uuid
  workstreamId  String?       @db.Uuid
  workItemId    String?       @db.Uuid
  ownerId       String        @db.Uuid
  state         ResearchState @default(DRAFT)
  revision      Int           @default(1)
  version       Int           @default(1)
  createdAt     DateTime      @default(now()) @db.Timestamptz(6)
  transitionedAt DateTime     @default(now()) @db.Timestamptz(6)
  // Restrict relations and indexes are defined explicitly in the final model.
}

model Experiment {
  id              String          @id @default(uuid()) @db.Uuid
  researchId      String          @db.Uuid
  workstreamId    String?         @db.Uuid
  workItemId      String?         @db.Uuid
  state           ExperimentState @default(DRAFT)
  methodRevision  Int             @default(1)
  version         Int             @default(1)
  createdAt       DateTime        @default(now()) @db.Timestamptz(6)
  transitionedAt  DateTime        @default(now()) @db.Timestamptz(6)
}
```

Every foreign key uses `onDelete: Restrict`. Add indexes for `(projectId, state, createdAt)`, `(ownerId, state, createdAt)`, `(researchId, state, createdAt)`, `(workstreamId, createdAt)`, and `(workItemId, createdAt)`.

- [ ] **Step 4: Add immutable revisions, methods, runs, conclusions, and history**

Create the remaining exact models listed in Step 1. Enforce:

```sql
CREATE UNIQUE INDEX "ResearchRevision_researchId_revision_key"
  ON "ResearchRevision" ("researchId", revision);
CREATE UNIQUE INDEX "ExperimentMethodRevision_experimentId_revision_key"
  ON "ExperimentMethodRevision" ("experimentId", revision);
CREATE UNIQUE INDEX "ExperimentRun_experimentId_sequence_key"
  ON "ExperimentRun" ("experimentId", sequence);
CREATE UNIQUE INDEX "ResearchSourceReview_owner_project_idempotency_key"
  ON "ResearchSourceReview" ("ownerId", "projectId", "idempotencyKey");
```

Use normalized `ExperimentMeasure`, `ExperimentTestCase`, and `ExperimentControl` rows. JSON is permitted only for bounded versioned lists/route traces/source references and source-review output fragments; it must not replace method records or observations.

- [ ] **Step 5: Add append-only database protection**

Apply the existing append-only trigger function to `ResearchRevision`, `ResearchParticipantEvent`, `ResearchTransition`, `ResearchSourceReviewRevision`, `ResearchProposalTransition`, `ExperimentMethodRevision`, `ExperimentMeasure`, `ExperimentTestCase`, `ExperimentControl`, `ExperimentRun`, `ExperimentObservation`, `ExperimentConclusion`, `ResearchConclusion`, `AppliedLearning`, and `ResearchEvidenceLink`. The roots and proposal current-state rows remain optimistic-versioned mutable state.

- [ ] **Step 6: Verify empty and previous-snapshot migration paths**

Run:

```bash
pnpm db:generate
pnpm db:verify
pnpm exec vitest run --root . packages/database/src/research-experiments-schema.integration.test.ts
```

Expected: migration succeeds from empty and previous `main`; drift/rebuild equivalence passes; append-only UPDATE/DELETE attempts fail.

- [ ] **Step 7: Commit**

```bash
git add packages/database scripts/run-integration-tests.mjs
git commit -m "feat: add research experiment persistence"
```

---

### Task 3: Add public owner-domain readers for authorized Project context

**Files:**

- Create: `packages/projects/src/research-project-context-reader.ts`
- Create: `packages/projects/src/research-project-context-reader.integration.test.ts`
- Modify: `packages/projects/src/index.ts`
- Create: `packages/work-items/src/research-work-item-reader.ts`
- Create: `packages/work-items/src/research-work-item-reader.integration.test.ts`
- Modify: `packages/work-items/src/index.ts`
- Create: `packages/documents/src/research-document-source-reader.ts`
- Create: `packages/documents/src/research-document-source-reader.integration.test.ts`
- Modify: `packages/documents/src/index.ts`
- Create: `packages/updates-evidence/src/research-support-reader.ts`
- Create: `packages/updates-evidence/src/research-support-reader.integration.test.ts`
- Modify: `packages/updates-evidence/src/index.ts`
- Create: `packages/connected-work-context/src/research-source-intake-reader.ts`
- Create: `packages/connected-work-context/src/research-source-intake-reader.integration.test.ts`
- Modify: `packages/connected-work-context/src/index.ts`
- Create: `packages/criteria/src/research-criterion-proposal-reader.ts`
- Create: `packages/criteria/src/research-criterion-proposal-reader.integration.test.ts`
- Modify: `packages/criteria/src/index.ts`
- Create: `packages/research-experiments/src/project-context.ts`
- Create: `packages/research-experiments/src/project-context.test.ts`

**Interfaces:**

- Consumes: existing Project membership/responsibility, Work Item authorization, approved Document versions, confirmed Update/Evidence data, and active Progress Contract readers.
- Produces: `ResearchScopeAuthorizer`, `ResearchScopeAuthorization`, `ResearchProjectContextSnapshot`, `ResearchWorkItemReference`, `ResearchDocumentSource`, private owner-only `ResearchConnectedSourceIntake`, `ConfirmedResearchEvidenceReader`, `ConfirmedResearchEvidenceReference`, `ConfirmedTaskCreator`, and authorized prospective criterion/progress proposal references without cross-module table reads from Research services.

- [ ] **Step 1: Write authorization and information-isolation tests**

Cover owner, current contributor, workstream contributor, assigned manager, unrelated manager, System Administrator, inactive user, cross-Project Work Item, and private/unconfirmed Evidence. Assert that only authorized source fields appear and no rating/readiness/private narrative field is returned.

```ts
await expect(
  reader.readAuthorizedContext({ actor: unrelatedManager, projectId, at }),
).rejects.toMatchObject({ code: "RESEARCH_SCOPE_FORBIDDEN" });
expect(JSON.stringify(context)).not.toMatch(/rating|readinessPercent|privateNarrative/i);
```

- [ ] **Step 2: Run focused reader tests and verify RED**

```bash
pnpm exec vitest run --root . \
  packages/projects/src/research-project-context-reader.integration.test.ts \
  packages/work-items/src/research-work-item-reader.integration.test.ts \
  packages/documents/src/research-document-source-reader.integration.test.ts \
  packages/updates-evidence/src/research-support-reader.integration.test.ts \
  packages/connected-work-context/src/research-source-intake-reader.integration.test.ts \
  packages/criteria/src/research-criterion-proposal-reader.integration.test.ts
```

- [ ] **Step 3: Implement owner-domain public readers**

Expose these structural methods:

```ts
authorize(input: {
  actor: { userId: string; active: boolean };
  scope: ResearchScope;
  at: Date;
}): Promise<ResearchScopeAuthorization>;

readAuthorizedContext(input: {
  actor: { userId: string; active: boolean };
  projectId: string;
  at: Date;
}): Promise<ResearchProjectContext>;

listAuthorizedProjectItems(input: {
  actor: { userId: string; active: boolean };
  projectId: string;
  at: Date;
}): Promise<readonly ResearchWorkItemReference[]>;

readApprovedVersion(input: {
  actor: { userId: string; active: boolean };
  documentVersionId: string;
  projectId: string;
}): Promise<ResearchDocumentSource>;

getConfirmedEvidence(input: {
  actor: { userId: string; active: boolean };
  evidenceId: string;
  projectId: string;
}): Promise<ConfirmedResearchEvidenceReference>;

readPrivateSourceIntake(input: {
  actor: { userId: string; active: boolean };
  sourceItemId: string;
}): Promise<ResearchConnectedSourceIntake>;

getProspectiveCriterionProposal(input: {
  actor: { userId: string; active: boolean };
  proposalId: string;
  projectId: string;
}): Promise<ResearchProspectiveProposalReference>;

createConfirmedTask(transaction: DatabaseTransaction, input: {
  actor: { userId: string; active: boolean };
  correlationId: string;
  workItemId: string;
  input: import("@evaluation/contracts").CreateWorkItemInput;
  reason: string;
}): Promise<ResearchWorkItemReference>;
```

`ResearchScopeAuthorizer.authorize()` validates the actor against the current Project, optional Workstream, and optional Work Item at the requested UTC instant and returns stable authorization facts without content. Projects returns objective/description, current authorized Workstreams, active contract identity/components/rules, responsibility windows, stable source references, and authorized prospective Progress Contract proposals. Work Items returns relevant current items and exposes `ConfirmedTaskCreator` as a transaction-aware adapter over the existing Work Item command service. Documents returns approved immutable version identity and safe extracted text/reference. Connected Work Context returns only the requesting employee's private captured URL/title/summary and never broadens it to Project scope. Updates & Evidence exports `ConfirmedResearchEvidenceReader` and returns only confirmed shared Updates/Evidence. Criteria validates prospective criterion proposals without exposing contributor responses or evaluation content.

- [ ] **Step 4: Compose and hash the version-pinned Project Context Snapshot**

`composeProjectContextSnapshot()` sorts every input deterministically and returns:

```ts
type ResearchProjectContextSnapshot = Readonly<{
  schemaVersion: "research-project-context.v1";
  projectId: string;
  generatedAt: string;
  fingerprintSha256: string;
  sourceReferences: readonly string[];
  objective: string;
  constraints: readonly string[];
  deliverables: readonly string[];
  operationalKpis: readonly string[];
  workstreams: readonly NamedReference[];
  workItems: readonly ResearchWorkItemReference[];
  decisions: readonly string[];
}>;
```

The fingerprint excludes `generatedAt` and changes only when cited content/version identity changes.

- [ ] **Step 5: Verify GREEN and domain boundaries**

```bash
pnpm exec vitest run --root . packages/projects/src/research-project-context-reader.integration.test.ts packages/work-items/src/research-work-item-reader.integration.test.ts packages/documents/src/research-document-source-reader.integration.test.ts packages/connected-work-context/src/research-source-intake-reader.integration.test.ts packages/updates-evidence/src/research-support-reader.integration.test.ts packages/criteria/src/research-criterion-proposal-reader.integration.test.ts packages/research-experiments/src/project-context.test.ts
pnpm scan:ai-boundary
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add packages/projects packages/work-items packages/documents packages/connected-work-context packages/updates-evidence packages/criteria packages/research-experiments
git commit -m "feat: expose authorized research context readers"
```

---

### Task 4: Implement fail-closed explicit source retrieval

**Files:**

- Create: `packages/research-experiments/src/source-retrieval.ts`
- Create: `packages/research-experiments/src/source-retrieval.test.ts`
- Create: `packages/research-experiments/src/source-adapters.ts`
- Create: `packages/research-experiments/src/source-adapters.test.ts`
- Create: `packages/research-experiments/src/source-config.ts`
- Create: `packages/research-experiments/src/source-config.test.ts`
- Modify: `.env.example`
- Modify: `turbo.json`

**Interfaces:**

- Consumes: an explicit employee URL only; no ambient browser session, Project credential, provider key, or arbitrary connector token.
- Produces: `SourceRetriever.retrieve(input): Promise<RetrievedResearchSource>` and deterministic fake adapters for tests.

- [ ] **Step 1: Write RED security tests before networking code**

Test rejection of `file:`, `ftp:`, URL userinfo, loopback IPv4/IPv6, RFC1918, link-local, multicast, unspecified, IPv4-mapped private IPv6, DNS answers containing any non-global address, redirects to blocked addresses, more than three redirects, responses over 2,000,000 bytes, unsupported MIME, decompression overflow, and timeout. Also prove that no headers contain cookies, authorization, or provider credentials.

```ts
await expect(
  retriever.retrieve({ url: "http://169.254.169.254/latest/meta-data", ...base }),
).rejects.toMatchObject({ code: "RESEARCH_SOURCE_BLOCKED" });
expect(requests[0]?.headers).not.toHaveProperty("authorization");
expect(requests[0]?.headers).not.toHaveProperty("cookie");
```

- [ ] **Step 2: Run the security test and verify RED**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/source-retrieval.test.ts packages/research-experiments/src/source-adapters.test.ts
```

- [ ] **Step 3: Implement exact bounded policy**

Parse these environment values with fail-closed defaults:

```ts
export const DEFAULT_RESEARCH_SOURCE_POLICY = {
  timeoutMs: 10_000,
  maxBytes: 2_000_000,
  maxTextChars: 120_000,
  maxRedirects: 3,
  allowedMimeTypes: [
    "text/plain",
    "text/markdown",
    "text/html",
    "application/json",
    "application/pdf",
  ],
} as const;
```

Use Node `dns.promises.lookup({ all: true, verbatim: true })` and `node:http`/`node:https` with a pinned validated lookup callback for each redirect hop. Revalidate protocol, hostname, port, resolved addresses, status, MIME, declared/content byte length, and timeout at every hop. Do not render HTML or execute active content. Convert bounded HTML to visible text with a small internal tag/whitespace normalizer; do not add a browser or scraping dependency.

- [ ] **Step 4: Add provider-specific bounded interpretation**

GitHub accepts explicit public repository/file URLs and labels only retrieved README, license, manifest, and selected explicit file references; it does not clone or enumerate the repository. DOI/paper/document URLs record citation metadata and available abstract/text; inaccessible PDFs return `PARTIAL` or `BLOCKED` with upload/manual citation recovery. Generic supported URLs remain one-page explicit retrieval only.

- [ ] **Step 5: Verify deterministic security and recovery**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/source-config.test.ts packages/research-experiments/src/source-retrieval.test.ts packages/research-experiments/src/source-adapters.test.ts
pnpm scan:secrets
```

- [ ] **Step 6: Commit**

```bash
git add .env.example turbo.json packages/research-experiments/src/source-*
git commit -m "feat: add safe research source retrieval"
```

---

### Task 5: Add the five governed AI routes and evaluation fixtures

**Files:**

- Create: `packages/research-experiments/src/prompts.ts`
- Create: `packages/research-experiments/src/prompts.test.ts`
- Create: `packages/research-experiments/src/ai-assistant.ts`
- Create: `packages/research-experiments/src/ai-assistant.test.ts`
- Create: `tests/ai/research-experiments.eval.test.ts`
- Create: `tests/ai-evals/fixtures/research-experiments.json`
- Create: `scripts/register-research-experiments-ai-routes.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: safe retrieved source, authorized Project Context Snapshot, existing AI Router, prompt artifact reader, and succeeded-run trace reader.
- Produces: five validated draft-only outputs with exact citations and route trace.

- [ ] **Step 1: Write failing prompt/schema tests**

Require exact constants:

```ts
export const RESEARCH_SOURCE_REVIEW_ROUTE = "research.source-review.v1";
export const RESEARCH_FRAME_ROUTE = "research.frame.v1";
export const RESEARCH_SYNTHESIZE_ROUTE = "research.synthesize.v1";
export const EXPERIMENT_METHOD_REVIEW_ROUTE = "experiment.method-review.v1";
export const EXPERIMENT_INTERPRET_ROUTE = "experiment.interpret.v1";
```

Test source-reference subset validation, inaccessible-content honesty, one-question-at-a-time framing, method completeness without automatic validity, run-bound interpretation, prompt injection resistance, and strict rejection of `rating`, `score`, `rank`, `progressPercent`, or unsupported claims.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/prompts.test.ts packages/research-experiments/src/ai-assistant.test.ts tests/ai/research-experiments.eval.test.ts
```

- [ ] **Step 3: Implement versioned prompts and semantic validators**

Use prompt/output versions ending in `.v1`. Every request marks retrieved/user content as untrusted data and supplies an exact allowed-reference list. Add validators with this shape:

```ts
export function assertCitationsAllowed(
  outputReferences: readonly string[],
  allowedReferences: readonly string[],
): void {
  const allowed = new Set(allowedReferences);
  if (outputReferences.length === 0 || outputReferences.some((ref) => !allowed.has(ref))) {
    throw new AppError("RESEARCH_AI_OUTPUT_INVALID", "errors.research.aiOutputInvalid", 409);
  }
}
```

- [ ] **Step 4: Implement the AI Router adapter**

`ResearchAiAssistant` calls only `AiRouter.run()` with `requiresHumanApproval: true`, classification `confidential`, timeout `60_000`, exact route/prompt/output versions, source references, correlation ID, and output reference. A failed or invalid route returns a typed recoverable error; raw employee input remains outside the failed AI transaction.

- [ ] **Step 5: Add multilingual deterministic evaluations**

Fixtures must include English, Fusha, Gulf, Levantine, and mixed Arabic/English model/repository text; a malicious README/paper instruction; missing license; blocked content; unsupported conclusion; failed Experiment; and prohibited rating request. Expected outputs remain drafts and preserve uncertainty.

- [ ] **Step 6: Verify GREEN and boundary scans**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/prompts.test.ts packages/research-experiments/src/ai-assistant.test.ts
pnpm test:ai -- tests/ai/research-experiments.eval.test.ts
pnpm scan:ai-boundary
pnpm scan:secrets
```

- [ ] **Step 7: Commit**

```bash
git add package.json packages/research-experiments scripts/register-research-experiments-ai-routes.ts tests/ai tests/ai-evals/fixtures/research-experiments.json
git commit -m "feat: add governed research AI routes"
```

---

### Task 6: Implement private source-review and proposal workflow

**Files:**

- Create: `packages/research-experiments/src/source-review-service.ts`
- Create: `packages/research-experiments/src/source-review-service.test.ts`
- Create: `packages/research-experiments/src/source-review-service.integration.test.ts`
- Create: `packages/research-experiments/src/source-review-persistence.ts`
- Create: `packages/research-experiments/src/source-review-persistence.integration.test.ts`

**Interfaces:**

- Consumes: Tasks 2–5, `PrivateResearchOutputProtector`, `ResearchScopeAuthorizer`, and `ResearchAiAssistant.reviewSource()`.
- Produces: idempotent `start`, `getPrivate`, `reanalyze`, `confirmDisposition`, and `dismiss` commands; confirmed proposals are later consumed by Tasks 7–9.

- [ ] **Step 1: Write RED service tests for the complete state machine**

Cover:

```text
PENDING_RETRIEVAL → READY_FOR_REVIEW | PARTIAL | BLOCKED
READY_FOR_REVIEW | PARTIAL → CONFIRMED | DISMISSED | STALE
STALE → READY_FOR_REVIEW | PARTIAL | BLOCKED
```

Assert idempotent replay, optimistic conflict, owner-only draft read, inaccessible-source truthfulness, Project reauthorization before decrypt, encrypted retrieved text/output at rest, stale fingerprint behavior, rejected proposal preservation, and zero Work Items before confirmation.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/source-review-service.test.ts packages/research-experiments/src/source-review-service.integration.test.ts packages/research-experiments/src/source-review-persistence.integration.test.ts
```

- [ ] **Step 3: Implement start and retrieval persistence**

Use this command boundary:

```ts
start(input: {
  actor: { userId: string; active: true };
  scope: ResearchScope;
  idempotencyKey: string;
  source:
    | { kind: "URL"; url: string }
    | { kind: "CONNECTED_CONTEXT"; sourceItemId: string }
    | { kind: "DOCUMENT_VERSION"; documentVersionId: string };
  correlationId: string;
}): Promise<ResearchSourceReviewDetail>;
```

Authorize Project/optional Workstream/Work Item before retrieval. For `CONNECTED_CONTEXT`, first reauthorize owner-only access and extract only the private URL/title/summary through Task 3; for `DOCUMENT_VERSION`, use the approved immutable Document reader and skip network retrieval. Store a source fingerprint for idempotency; seal the original URL/private context, bounded retrieved content, and AI output with the existing private-context protector. Persist only sanitized canonical display URL, retrieval metadata, content fingerprint, citation identities, schema/prompt versions, and route trace in queryable fields.

- [ ] **Step 4: Implement review, proposals, and explicit confirmation**

Persist versioned editable proposals of kinds `RESEARCH`, `EXPERIMENT`, and `WORK_ITEM`. `confirmDisposition()` validates expected version, reauthorizes Project scope, records the employee reason, and confirms only named proposal IDs. It does not create official objects yet; it makes the proposals eligible for the appropriate domain command in Tasks 7–9.

- [ ] **Step 5: Implement re-analysis and recovery**

Re-analysis pins the new retrieved fingerprint and Project Context Snapshot fingerprint in a new immutable review revision. Earlier revisions remain readable to the owner. `BLOCKED` and `PARTIAL` return structured recovery choices `UPLOAD_DOCUMENT`, `ADD_MANUAL_CITATION`, or `TRY_AGAIN`; no synthesized claim is persisted without retrieved/manual source content.

- [ ] **Step 6: Verify GREEN, privacy, and transaction behavior**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/source-review-service.test.ts packages/research-experiments/src/source-review-service.integration.test.ts packages/research-experiments/src/source-review-persistence.integration.test.ts
pnpm scan:secrets
```

- [ ] **Step 7: Commit**

```bash
git add packages/research-experiments/src/source-review-*
git commit -m "feat: add private research source review"
```

---

### Task 7: Implement Research lifecycle, revisions, participants, and ownership transfer

**Files:**

- Create: `packages/research-experiments/src/research-invariants.ts`
- Create: `packages/research-experiments/src/research-invariants.test.ts`
- Create: `packages/research-experiments/src/research-service.ts`
- Create: `packages/research-experiments/src/research-service.integration.test.ts`
- Create: `packages/research-experiments/src/research-query-service.ts`
- Create: `packages/research-experiments/src/research-query-service.integration.test.ts`

**Interfaces:**

- Consumes: confirmed `RESEARCH` proposal or employee input, Research scope authorizer, database, audit writer, and clock.
- Produces: `ResearchService.create/revise/prepareFrame/prepareSynthesis/addSource/retractSource/transition/transferOwner/changeContributor` and authorized list/detail queries.

- [ ] **Step 1: Write failing invariant and integration tests**

Assert allowed transitions only, Project required, Workstream/Work Item same Project, `DRAFT` owner-only, active shared visibility, no Project change after activation, immutable revisions, one active owner, append-only participant events, transactional transfer, stale-version rejection, successor requirement for `SUPERSEDED`, reason requirement for cancel/supersede, inactive-user denial, preserved deactivated-user history, manual/confirmed source references, and append-only source retraction/supersession.

```ts
expect(() => assertResearchTransition("CONCLUDED", "ACTIVE")).toThrow();
await expect(service.transferOwner(staleCommand)).rejects.toMatchObject({
  code: "RESEARCH_VERSION_CONFLICT",
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/research-invariants.test.ts packages/research-experiments/src/research-service.integration.test.ts packages/research-experiments/src/research-query-service.integration.test.ts
```

- [ ] **Step 3: Implement create/revise/activate**

`create()` writes root, revision 1, owner-start participant event, transition event, and audit in one serializable transaction. `revise()` appends a revision and increments optimistic version. `prepareFrame()` and `prepareSynthesis()` call the Task 5 AI assistant and persist draft revisions with trace/source references; they never activate the record. `addSource()` accepts a confirmed source-review reference, approved Document Version, or manually entered citation; `retractSource()` appends a reasoned source-state event instead of deleting the source. Only employee-authored or employee-confirmed AI revisions can become current/active.

- [ ] **Step 4: Implement transfer and participant history**

`transferOwner()` locks the Research root, reauthorizes both employees for the current Project, appends owner-ended and owner-started participant events at the same UTC instant, changes current owner/version, and appends one audit event in the same transaction. Contributor add/remove uses paired append-only events; no-response never creates acknowledgment.

- [ ] **Step 5: Implement lifecycle transitions and authorized queries**

`ACTIVE → CONCLUDED` is unavailable until Task 9 supplies a confirmed Research conclusion. Cancel and supersede retain all data. Query projection hides DRAFT from every non-owner and checks current Project scope for shared records; System Administrator has no content access by label alone.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/research-invariants.test.ts packages/research-experiments/src/research-service.integration.test.ts packages/research-experiments/src/research-query-service.integration.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add packages/research-experiments/src/research-*
git commit -m "feat: add governed research lifecycle"
```

---

### Task 8: Implement reproducible Experiment methods, runs, observations, and conclusions

**Files:**

- Create: `packages/research-experiments/src/experiment-invariants.ts`
- Create: `packages/research-experiments/src/experiment-invariants.test.ts`
- Create: `packages/research-experiments/src/experiment-service.ts`
- Create: `packages/research-experiments/src/experiment-service.integration.test.ts`
- Create: `packages/research-experiments/src/experiment-query-service.ts`
- Create: `packages/research-experiments/src/experiment-query-service.integration.test.ts`

**Interfaces:**

- Consumes: active authorized Research, optional confirmed `EXPERIMENT` proposal, normalized method input, database, audit writer, and AI draft trace.
- Produces: immutable methods/runs/observations, AI method/result drafts, human-confirmed conclusion, and authorized Experiment detail.

- [ ] **Step 1: Write RED completeness and history tests**

Require baseline, at least one measure, test/sample definition, conditions, reproducibility instructions, and an interpretation rule for every numeric/qualitative measure before `READY`. Assert that one Research can contain two Experiments; a run pins one method revision; completed/failed/invalid/stopped results are retained; observations reference declared measures/test cases; correction creates a superseding observation or new run; AI cannot confirm conclusion; and `NOT_SUPPORTED`/`INCONCLUSIVE` are valid outcomes.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/experiment-invariants.test.ts packages/research-experiments/src/experiment-service.integration.test.ts packages/research-experiments/src/experiment-query-service.integration.test.ts
```

- [ ] **Step 3: Implement method revision and READY gate**

Persist method root fields plus normalized child rows in one transaction. Use:

```ts
assertMethodReady({
  baseline,
  measures,
  testCases,
  controls,
  conditions,
  reproducibilityInstructions,
});
```

An explicitly qualitative method still requires a structured qualitative measure and interpretation rule. `DRAFT → READY` appends a transition/audit event and never marks the scientific method “valid.”

- [ ] **Step 4: Implement run and observation recording**

`reviewMethod()` calls `experiment.method-review.v1`, persists a draft completeness review, and asks one clarification without changing state. `recordRun()` pins `methodRevisionId`, assigns a per-Experiment sequence under lock, stores executor/environment/input/model versions excluding secrets, and appends observations. It accepts `COMPLETED`, `FAILED`, `INVALID`, or `STOPPED`; no result is erased. `interpretRun()` calls `experiment.interpret.v1` and persists a cited draft interpretation without concluding the Experiment.

- [ ] **Step 5: Implement human-confirmed Experiment conclusion**

Require named run/measure references, limitations, human-described confidence text, decision relevance, and next experiment/stop reason. The output enum is `SUPPORTED`, `NOT_SUPPORTED`, `INCONCLUSIVE`, `INVALID`, or `ABANDONED`. Persist the employee confirmation and transition atomically; an AI draft trace may be cited but cannot supply the confirmer.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/experiment-invariants.test.ts packages/research-experiments/src/experiment-service.integration.test.ts packages/research-experiments/src/experiment-query-service.integration.test.ts
pnpm scan:performance-inputs
```

- [ ] **Step 7: Commit**

```bash
git add packages/research-experiments/src/experiment-*
git commit -m "feat: add reproducible experiment lifecycle"
```

---

### Task 9: Implement Research conclusions, Applied Learning, Evidence links, and confirmed Task creation

**Files:**

- Create: `packages/research-experiments/src/decision-service.ts`
- Create: `packages/research-experiments/src/decision-service.integration.test.ts`
- Create: `packages/research-experiments/src/applied-learning-service.ts`
- Create: `packages/research-experiments/src/applied-learning-service.integration.test.ts`
- Create: `packages/research-experiments/src/evidence-link-service.ts`
- Create: `packages/research-experiments/src/evidence-link-service.integration.test.ts`
- Create: `packages/research-experiments/src/proposal-confirmation-service.ts`
- Create: `packages/research-experiments/src/proposal-confirmation-service.integration.test.ts`

**Interfaces:**

- Consumes: confirmed Experiment conclusions, confirmed source proposals, `ConfirmedResearchEvidenceReader`, `ConfirmedTaskCreator`, Document Version reader, and Research scope authorizer.
- Produces: human-confirmed Research decisions, Applied Learning records, Research/Evidence links, and employee-confirmed Work Items through the existing Work Items service.

- [ ] **Step 1: Write RED cross-domain and human-gate tests**

Assert that Research conclusion references named sources/Experiments; unresolved/failed Experiments may support `REFINE` or `RUN_ANOTHER_EXPERIMENT`; Applied Learning requires a confirmed real target; Evidence must be confirmed and in the same Project; Work Item proposals create no Task before confirmation; replay returns the same Task; cross-Project targets fail atomically; and all history/audit remains after failure.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/decision-service.integration.test.ts packages/research-experiments/src/applied-learning-service.integration.test.ts packages/research-experiments/src/evidence-link-service.integration.test.ts packages/research-experiments/src/proposal-confirmation-service.integration.test.ts
```

- [ ] **Step 3: Implement Research conclusion and decision**

Use decision enum `ADOPT`, `REJECT`, `DEFER`, `REFINE`, `RUN_ANOTHER_EXPERIMENT`, or `NO_DECISION`. Persist synthesis, answer, remaining uncertainty, rationale, next action, human confirmer, cited sources/runs, transition, and audit in one serializable transaction.

- [ ] **Step 4: Implement Applied Learning and Evidence links**

Applied targets are exactly `WORK_ITEM`, `UPDATE`, `DOCUMENT_VERSION`, `PROGRESS_CONTRACT_PROPOSAL`, `CRITERION_PROPOSAL`, `RESEARCH`, `EXPERIMENT`, or `KNOWLEDGE_TRANSFER`. Validate each target through its owner-domain public reader; `KNOWLEDGE_TRANSFER` requires an approved Document Version classified by the employee as the transfer artifact. Evidence links store supported claim, scope, optional run/conclusion, confirmer, and confirmed Evidence revision identity; do not copy the Evidence content.

- [ ] **Step 5: Implement employee-confirmed official Task creation**

`confirmWorkItemProposal()` locks the proposal, reauthorizes current Project scope, validates the edited title/description/assignee/workstream/acceptance conditions, then calls:

```ts
confirmedTaskCreator.createConfirmedTask(transaction, {
  actor,
  correlationId,
  workItemId: proposal.targetId,
  input: editedTask,
  reason,
});
```

Append proposal confirmation and Applied Learning only after the Work Item command succeeds in the same transaction.

- [ ] **Step 6: Verify GREEN and protected prohibitions**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/decision-service.integration.test.ts packages/research-experiments/src/applied-learning-service.integration.test.ts packages/research-experiments/src/evidence-link-service.integration.test.ts packages/research-experiments/src/proposal-confirmation-service.integration.test.ts
pnpm scan:performance-inputs
pnpm scan:ai-boundary
```

- [ ] **Step 7: Commit**

```bash
git add packages/research-experiments/src/*service* packages/research-experiments/src/index.ts
git commit -m "feat: connect research decisions to applied work"
```

---

### Task 10: Expose protected API composition without leaking internal identifiers

**Files:**

- Create: `apps/api/src/research-experiments/research-experiments.module.ts`
- Create: `apps/api/src/research-experiments/research-experiments-policy.guard.ts`
- Create: `apps/api/src/research-experiments/research-experiments-policy.guard.test.ts`
- Create: `apps/api/src/research-experiments/source-reviews.controller.ts`
- Create: `apps/api/src/research-experiments/source-reviews.controller.test.ts`
- Create: `apps/api/src/research-experiments/research-records.controller.ts`
- Create: `apps/api/src/research-experiments/research-records.controller.test.ts`
- Create: `apps/api/src/research-experiments/experiments.controller.ts`
- Create: `apps/api/src/research-experiments/experiments.controller.test.ts`
- Create: `apps/api/src/research-experiments/research-experiments.e2e.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**

- Consumes: Tasks 3–9, AuthModule, AI Router runtime, database audit writer, and private-context protector.
- Produces: `/api/v1/research/*` endpoints with strict schemas and server-side authorization.

- [ ] **Step 1: Write controller/guard tests first**

Test unauthenticated, inactive, employee/contributor, Project owner, assigned manager, unrelated manager, System Administrator, malformed UUID/body, duplicate key, stale version, blocked source, AI unavailable, and cross-Project inputs. Assert correlation ID propagation and generic safe errors.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --root . apps/api/src/research-experiments
```

- [ ] **Step 3: Implement the exact bounded routes**

Expose:

```text
POST /api/v1/research/source-reviews
GET  /api/v1/research/source-reviews/:id
POST /api/v1/research/source-reviews/:id/reanalyze
POST /api/v1/research/source-reviews/:id/disposition
POST /api/v1/research
GET  /api/v1/research?projectId=&workstreamId=
GET  /api/v1/research/:id
POST /api/v1/research/:id/revisions
POST /api/v1/research/:id/frame-drafts
POST /api/v1/research/:id/synthesis-drafts
POST /api/v1/research/:id/sources
POST /api/v1/research/:id/sources/:sourceId/retract
POST /api/v1/research/:id/transitions
POST /api/v1/research/:id/owner-transfers
POST /api/v1/research/:id/participants
POST /api/v1/research/:id/experiments
POST /api/v1/experiments/:id/method-revisions
POST /api/v1/experiments/:id/method-reviews
POST /api/v1/experiments/:id/transitions
POST /api/v1/experiments/:id/runs
POST /api/v1/experiments/:id/interpretations
POST /api/v1/experiments/:id/conclusions
POST /api/v1/research/:id/conclusions
POST /api/v1/research/:id/applied-learning
POST /api/v1/research/:id/evidence-links
POST /api/v1/research/proposals/:id/confirm-work-item
```

Controllers parse only public Task 1 schemas and delegate. They never query Prisma or authorize via UI state.

- [ ] **Step 4: Compose dependencies through public interfaces**

`ResearchExperimentsModule` creates one database client lifecycle, AI Router, `SafeHttpSourceRetriever`, private protector, owner-domain readers, services, query readers, and guard. Do not import any provider SDK. Add the module once to `AppModule`.

- [ ] **Step 5: Verify API GREEN**

```bash
pnpm exec vitest run --root . apps/api/src/research-experiments
pnpm --filter @evaluation/api lint
pnpm --filter @evaluation/api typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/research-experiments apps/api/src/app.module.ts
git commit -m "feat: expose protected research experiment API"
```

---

### Task 11: Compose Research into Timeline, monthly readiness, and Evaluation Fact View

**Files:**

- Create: `packages/research-experiments/src/timeline-reader.ts`
- Create: `packages/research-experiments/src/timeline-reader.integration.test.ts`
- Create: `packages/research-experiments/src/readiness-reader.ts`
- Create: `packages/research-experiments/src/readiness-reader.integration.test.ts`
- Create: `packages/research-experiments/src/evaluation-fact-reader.ts`
- Create: `packages/research-experiments/src/evaluation-fact-reader.integration.test.ts`
- Modify: `packages/contracts/src/updates-evidence.ts`
- Modify: `packages/contracts/src/evaluation-fact-view.ts`
- Modify: `packages/contracts/src/research-experiments.test.ts`
- Modify: `packages/updates-evidence/src/activity-reader.ts`
- Modify: `packages/updates-evidence/src/timeline-prepare.ts`
- Create: `packages/updates-evidence/src/timeline-composition.test.ts`
- Modify: `packages/evaluation-preparation/src/fact-normalizer.ts`
- Modify: `packages/evaluation-preparation/src/fact-normalizer.test.ts`
- Modify: `apps/api/src/updates-evidence/updates-evidence.module.ts`
- Modify: `apps/api/src/evaluation-preparation/evaluation-preparation.module.ts`
- Modify: `apps/api/src/daily-work/readiness-query.service.ts`
- Modify: `apps/api/src/daily-work/readiness-query.service.integration.test.ts`
- Modify: `apps/api/src/daily-work/daily-work.module.ts`
- Modify: `apps/web/src/platform/updates-evidence-contracts.ts`
- Modify: `apps/web/src/platform/daily-work-api.ts`
- Modify: `apps/web/src/platform/evaluation-fact-view-api.ts`
- Modify: `apps/web/src/platform/evaluation-fact-view-api.test.ts`
- Modify: `apps/web/src/app/[locale]/timeline/timeline-list.tsx`
- Modify: `apps/web/src/app/[locale]/timeline/timeline-list.test.tsx`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/readiness/readiness-view.tsx`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/readiness/readiness-view.test.tsx`
- Modify: `apps/web/src/app/[locale]/evaluations/facts/source-facts-section.tsx`
- Modify: `apps/web/src/app/[locale]/evaluations/facts/evaluation-fact-view.test.tsx`
- Modify: `packages/localization/src/catalogs/en.ts`
- Modify: `packages/localization/src/catalogs/ar.ts`

**Interfaces:**

- Consumes: confirmed Research/Experiment rows only; draft source reviews remain private.
- Produces: typed Research Timeline items, Research gaps composed into the existing non-scoring monthly readiness response, and Evaluation Fact View schema version 2 with `researchFacts`.

- [ ] **Step 1: Write RED composition and neutrality tests**

Require only meaningful events, source labels, cursor-stable merging, no autosaves/AI turns, incomplete-method/conclusion/applied-learning actions without quotas, responsibility-period linkage, source-supported fact versus employee interpretation separation, and absence of rating/readiness/rank/productivity/progress-volume fields.

```ts
expect(view.schemaVersion).toBe(2);
expect(view.researchFacts.map((fact) => fact.factType)).toContain("experiment_conclusion");
expect(JSON.stringify(view)).not.toMatch(/suggestedRating|readinessPercent|productivityScore/i);
```

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/timeline-reader.integration.test.ts packages/research-experiments/src/readiness-reader.integration.test.ts packages/research-experiments/src/evaluation-fact-reader.integration.test.ts packages/updates-evidence/src/timeline-composition.test.ts packages/evaluation-preparation/src/fact-normalizer.test.ts
```

- [ ] **Step 3: Implement public Research readers**

Timeline emits typed items for activation/revision/conclusion/cancel/supersede, Experiment ready/start/run result/conclusion/abandon/supersede, Research decision, and Applied Learning. Readiness emits only action codes such as `RESEARCH_QUESTION_MISSING`, `EXPERIMENT_METHOD_INCOMPLETE`, `RUN_INTERPRETATION_MISSING`, `EXPERIMENT_CONCLUSION_MISSING`, `RESEARCH_DECISION_MISSING`, `APPLIED_LEARNING_UNLINKED`, and `EVIDENCE_ATTRIBUTION_UNRESOLVED`.

Inject this reader into the existing `ReadinessQueryService`; merge its employee Project gaps after the existing silent-scope/evidence gaps. Preserve the existing `clear|attention` state and coarse manager projection. Do not add a percentage, quota, employee comparison, or manager-visible per-employee Research count.

- [ ] **Step 4: Extend Timeline by composition, not Research table reads**

Add `research`, `experiment`, and `applied_learning` to `TimelineItemSchema.kind`. `ActivityReader` accepts a `ResearchTimelineSourceReader`, asks the existing and Research readers for the same cursor/limit, sorts by `(occurredAt, kind, id)` descending, slices once, and encodes the final cursor. Updates & Evidence never queries Research tables. Mirror the new strict enum in `apps/web/src/platform/updates-evidence-contracts.ts`; render localized, source-labelled Research rows in `timeline-list.tsx`, with English/Arabic catalog keys and LTR/RTL tests.

- [ ] **Step 5: Add Fact View schema version 2**

Add `research_revision`, `research_source`, `experiment_method`, `experiment_run`, `experiment_conclusion`, `research_conclusion`, and `applied_learning` to `EvaluationFactSourceReferenceSchema.sourceType`. Add `ResearchEvaluationFactSchema` with `factType` values `research_question`, `source_synthesis`, `experiment_method`, `experiment_run`, `experiment_conclusion`, `research_decision`, and `applied_learning`. It includes Project/Workstream/Work Item, source time/references, human-confirmation state, responsibility windows, summary, limitations/uncertainty, and no numeric performance field. Update the normalizer, `WebEvaluationFactViewSchema`, its API test, `source-facts-section.tsx`, and the Fact View rendering test from schema version 1 to 2. Extend `WebMonthlyReadinessSchema`, `MonthlyReadinessView`, and their tests with the exact Research gap/action enums while retaining the existing generic non-scoring message and employee-only actionable detail.

- [ ] **Step 6: Verify GREEN and neutrality scans**

```bash
pnpm exec vitest run --root . packages/research-experiments/src/timeline-reader.integration.test.ts packages/research-experiments/src/readiness-reader.integration.test.ts packages/research-experiments/src/evaluation-fact-reader.integration.test.ts packages/updates-evidence/src/timeline-composition.test.ts packages/evaluation-preparation/src/fact-normalizer.test.ts apps/api/src/daily-work/readiness-query.service.integration.test.ts apps/web/src/platform/evaluation-fact-view-api.test.ts 'apps/web/src/app/[locale]/timeline/timeline-list.test.tsx' 'apps/web/src/app/[locale]/projects/[projectId]/readiness/readiness-view.test.tsx' 'apps/web/src/app/[locale]/evaluations/facts/evaluation-fact-view.test.tsx'
pnpm scan:performance-inputs
pnpm scan:ai-boundary
```

- [ ] **Step 7: Commit**

```bash
git add packages/research-experiments packages/contracts packages/updates-evidence packages/evaluation-preparation apps/api/src/updates-evidence apps/api/src/evaluation-preparation apps/api/src/daily-work apps/web/src/platform apps/web/src/app/'[locale]'/timeline apps/web/src/app/'[locale]'/projects/'[projectId]'/readiness apps/web/src/app/'[locale]'/evaluations/facts packages/localization
git commit -m "feat: compose research facts and readiness"
```

---

### Task 12: Add the minimal bilingual verification journey

**Files:**

- Create: `apps/web/src/platform/research-experiments-contracts.ts`
- Create: `apps/web/src/platform/research-experiments-api.ts`
- Create: `apps/web/src/app/api/research/[...path]/route.ts`
- Create: `apps/web/src/app/api/research/[...path]/route.test.ts`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/research/page.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/research/research-workspace.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/research/research-workspace.test.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/research/source-review-sheet.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/research/experiment-sheet.tsx`
- Modify: `apps/web/src/app/[locale]/projects/[projectId]/page.tsx`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalogs/ar.json`

**Interfaces:**

- Consumes: strict Task 1 API contracts through a same-origin token-free gateway.
- Produces: one provisional Project Research route proving the journey; it is not final UX acceptance.

- [ ] **Step 1: Write failing gateway and component tests**

Test the whitelist, strict response projection, no browser bearer token, no raw route trace/internal IDs, source URL/review recovery, one-question-at-a-time AI draft, editable proposals, zero official Task before confirmation, two Experiments, failed-result retention, human conclusion, Evidence link, Arabic RTL 390 px, English LTR, keyboard focus, visible sheet/dialog, reduced motion, and mixed repository/model/URL direction.

- [ ] **Step 2: Verify RED**

```bash
pnpm exec vitest run --root . apps/web/src/app/api/research/'[...path]'/route.test.ts apps/web/src/app/'[locale]'/projects/'[projectId]'/research/research-workspace.test.tsx
```

- [ ] **Step 3: Implement the strict same-origin gateway**

Allow only the routes listed in Task 10, map internal IDs used by browser mutations to the existing encrypted/opaque handle pattern, parse upstream responses with strict schemas, and return localized safe error codes. Reject duplicated query keys, extra path segments, unsupported methods, and unexpected upstream fields.

- [ ] **Step 4: Implement the compact verification surface**

The route begins with one URL/question field and Project context. Show a compact cited card with `Why it may help`, `Mismatch`, `Risks`, `Uncertainty`, and `Next actions`; proposals open in a drawer/bottom sheet and remain editable. Progressively disclose Research method details and Experiments. Keep the main route free of large metric cards, internal IDs, route traces, schema names, and score-like visualization.

- [ ] **Step 5: Add complete Arabic/English copy**

Add every user-visible string to both catalogs. Arabic is RTL and uses clear product language; model names, repository paths, measures, citations, and URLs retain correct inline direction. This does not release Arabic evaluation rubric content.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm exec vitest run --root . apps/web/src/app/api/research/'[...path]'/route.test.ts apps/web/src/app/'[locale]'/projects/'[projectId]'/research/research-workspace.test.tsx
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web packages/localization
git commit -m "feat: add research engine verification journey"
```

---

### Task 13: Prove the deterministic end-to-end journey and publish the E3 checkpoint

**Files:**

- Create: `scripts/seed-research-experiments-acceptance.ts`
- Create: `tests/e2e/research-experiments.spec.ts`
- Create: `docs/acceptance/RESEARCH_EXPERIMENTS_ENGINE.md`
- Create: `docs/product/screenshots/engine/research-experiments/*`
- Modify: `package.json`
- Modify: `docs/product/ENGINE_FEATURE_REGISTER.md`
- Modify: `docs/product/ENGINE_CAPABILITY_MATRIX.md`
- Modify: `docs/product/ENGINE_FRONTEND_HANDOFF_SCHEMA.md`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html`

**Interfaces:**

- Consumes: Tasks 1–12.
- Produces: reproducible acceptance data, screenshots, verification evidence, and accurate CAP-025–027 status.

- [ ] **Step 1: Write the deterministic acceptance test before the seed**

The Playwright journey must assert:

```text
explicit GitHub/paper link → cited Project relevance review
→ one unsuitable proposal rejected
→ Research confirmed
→ two Experiments created
→ first concludes NOT_SUPPORTED and remains visible
→ second pins baseline/measures/test cases/run/limitations
→ employee confirms decision
→ confirmed Evidence linked
→ Applied Learning links a real Work Item or Document Version
→ Timeline and Fact View show neutral source-labelled facts
```

Add negative browser/API checks for another employee, unrelated manager, System Administrator, stale version, AI unavailable, blocked URL, and no official Task before confirmation.

- [ ] **Step 2: Implement the rerunnable real-database seed**

Seed one Project, one optional Workstream, one Project document version, two existing Work Items, one confirmed Evidence item, deterministic source-review fixture, one active Research record, and two Experiment paths. Use stable pilot keys and idempotent upserts only for mutable roots; do not rewrite append-only history on rerun. Seed no rating, rank, productivity, readiness percentage, source-volume metric, or Project progress change.

- [ ] **Step 3: Run focused acceptance and capture screenshots**

Run:

```bash
pnpm research:seed
pnpm exec playwright test tests/e2e/research-experiments.spec.ts
```

Capture English desktop, cited source review, proposal sheet, failed Experiment, confirmed decision/Applied Learning, Arabic RTL desktop, and Arabic RTL 390 px under the declared screenshot directory.

- [ ] **Step 4: Run the two bounded critical reviews**

Perform one specification-compliance review and one security/integrity review covering source retrieval/SSRF, privacy, authorization, migration, transaction/audit atomicity, append-only history, AI Router boundary, citations, and prohibited performance/progress fields. Fix only confirmed P0/P1 findings in one bounded cycle and re-review only those findings. Record non-blocking P2/P3 items in one backlog issue.

- [ ] **Step 5: Run the complete E3 verification checkpoint**

Use the repository-pinned Node.js 24.18.0 and pnpm 11.13.0:

```bash
pnpm verify
pnpm test:integration
pnpm test:ai
pnpm db:verify
pnpm test:e2e
git diff --check
```

Expected: all required suites pass; intentional skips are enumerated; no secret is printed or committed; no unresolved P0/P1 remains.

- [ ] **Step 6: Update capability evidence truthfully**

Move CAP-025–027 from `PLANNED` only when the migration, domain, authorization, AI, Timeline/readiness/Fact View readers, recovery, and deterministic browser journey all pass. Keep live private-repository/paper access as an external gate where applicable. Mark E3 complete technically, not UX accepted.

- [ ] **Step 7: Commit, push, and open/update the E3 Pull Request**

```bash
git add docs scripts tests package.json TASKS.md project-state packages apps
git commit -m "docs: verify research experiments engine"
git push
```

Require hosted `integrity`, `quality`, `build`, and `integration` checks on the exact head before merge. Do not begin E4 or the final frontend until E3 is merged and merged `main` is green.

---

## Self-review coverage map

| Approved design requirement                                                | Implemented by                  |
| -------------------------------------------------------------------------- | ------------------------------- |
| Safe explicit GitHub/paper/document link review                            | Tasks 4–6, 10, 12–13            |
| Version-pinned authorized Project Context Snapshot                         | Task 3                          |
| Editable Research/Experiment/Work Item proposals and employee confirmation | Tasks 1, 6, 9–10, 12            |
| Research question, source synthesis, participants, ownership periods       | Tasks 2, 5, 7                   |
| Multiple reproducible Experiments per Research                             | Tasks 2, 8                      |
| Failed/inconclusive result retention                                       | Tasks 8, 11–13                  |
| Human-confirmed conclusions, decisions, and Applied Learning               | Tasks 8–9                       |
| Existing Evidence lifecycle reuse                                          | Tasks 3, 9                      |
| AI Router-only, versioned outputs, citations, multilingual evals           | Task 5                          |
| Authorization, privacy, audit, concurrency, append-only history            | Tasks 2–3, 6–10, 13             |
| Timeline, non-scoring readiness, neutral Fact View                         | Task 11                         |
| Minimal bilingual/mobile verification journey                              | Tasks 12–13                     |
| No final frontend or protected-rule change                                 | Global Constraints, Tasks 12–13 |
