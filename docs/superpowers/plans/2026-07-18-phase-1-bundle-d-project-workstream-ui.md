# Phase 1 Bundle D Project and Workstream UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` only for Tasks 1–2 because they touch protected authorization/session boundaries. Use `superpowers:executing-plans` for Tasks 3–5. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver T029 as a simple Arabic-first, bilingual, responsive workspace for project and workstream lists, status, current people, documents, readiness, criteria review, contributor acknowledgment/objection, manager resolution, and prospective activation.

**Architecture:** Keep PostgreSQL and the existing domain services authoritative. Add only the missing resource-scoped read models required by the UI, then expose them through the existing protected API modules. The Next.js application uses a strict same-origin workspace gateway: the encrypted OIDC cookie and bearer token remain server-only, GET routes map only approved paths, and criteria mutations use validated Server Actions. UI pages consume localized view models and never query a database or provider directly.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 7, NestJS 11, Zod 4, Prisma/PostgreSQL, Vitest, Playwright, existing `@evaluation/localization` and `@evaluation/ui`.

## Global Constraints

- Scope is exactly T029. Exclude T030+ activity/evidence/check-in work, evaluation scoring, T016 Arabic-rubric activation, provider SDK calls, and protected-rule changes.
- Arabic is the default route and every new screen works in RTL; English uses the same stable view-model fields and actions.
- No hardcoded user-visible feature copy in `apps/web`; all copy is present in both localization catalogs.
- Mixed IDs, URLs, source hashes, file names, and technical references use `BidiText` or equivalent isolation.
- The manager receives only operational readiness state. Detailed missing items and correction guidance never enter a manager response.
- UI visibility is not authorization. Every protected upstream API route retains server-side authorization.
- The access token, encrypted session, signed document URLs, and credentials never reach Client Component props, browser JSON, logs, or error messages.
- Criteria output contains no rating, ranking, productivity score, readiness percentage, or automatic average.
- No live or paid AI call is made. UI tests use deterministic fixtures and existing API contracts.
- Use logical CSS properties, DOM-order keyboard navigation, visible focus, responsive single-column fallback, and semantic headings/forms.
- Store timestamps in UTC; render dates with the active locale and `Asia/Riyadh`.
- Run focused tests after each task, related integration at bundle completion, and the full repository suite only at the final Phase 1 checkpoint.

---

## File Map

### Protected resource read models

- `packages/contracts/src/workspace.ts`: strict bilingual-neutral response schemas for people, project/workstream workspace views, criteria workflow state, and allowed UI actions.
- `packages/contracts/src/workspace.test.ts`: prohibited-field, count, strictness, and manager-readiness projection tests.
- `packages/projects/src/project-service.ts`: current project people and child-workstream read model using the existing authorized project scope.
- `packages/projects/src/workstream-service.ts`: current workstream people read model using the existing authorized workstream scope.
- `packages/documents/src/document-service.ts`: authorized document lookup by exact resource identity.
- `packages/criteria/src/workspace-query-service.ts`: latest proposal/active set, frozen response counts, viewer response, and server-computed allowed actions.
- Existing API controllers/tests: add resource-scoped GET routes without direct table access.

### Server-only web boundary

- `apps/web/src/auth/oidc.ts`: expose one narrow access-token reader for a valid encrypted session.
- `apps/web/src/platform/workspace-api.ts`: server-only upstream fetch, allowlisted path builder, correlation, safe errors, and response-schema validation.
- `apps/web/src/app/api/workspace/[...path]/route.ts`: GET-only same-origin gateway for three approved workspace views.
- `apps/web/src/app/[locale]/projects/actions.ts`: strict Server Actions for criteria generation/review/respond/resolve/activate.
- `apps/api/src/main.ts`, `.env.example`: separate configurable API port and internal API base URL for local composition.

### Presentation

- `apps/web/src/app/[locale]/workspace-shell.tsx`: shared header, navigation, locale switch, and identified-pilot notice.
- `apps/web/src/app/[locale]/projects/page.tsx`: project list shell.
- `apps/web/src/app/[locale]/projects/[projectId]/page.tsx`: project detail shell.
- `apps/web/src/app/[locale]/projects/[projectId]/workstreams/[workstreamId]/page.tsx`: workstream detail shell.
- `apps/web/src/app/[locale]/projects/workspace-client.tsx`: loading/error/data state and approved GET calls.
- `apps/web/src/app/[locale]/projects/workspace-views.tsx`: pure semantic list/detail cards.
- `apps/web/src/app/[locale]/projects/criteria-actions.tsx`: progressive criteria forms using `useActionState`.
- `apps/web/src/app/globals.css`: responsive workspace layout using logical properties.
- Localization catalogs/tests and Playwright fixtures/specs: Arabic/English copy, RTL, mobile, focus, safe readiness, and role-scoped flows.

---

### Task 1: Add Resource-Scoped Workspace Read Models

**Risk class:** Critical because the new reads cross authorization, manager-readiness privacy, frozen responses, and historical criteria.

**Files:**

- Create: `packages/contracts/src/workspace.ts`
- Create: `packages/contracts/src/workspace.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/projects/src/project-service.ts`
- Modify: `packages/projects/src/project-service.integration.test.ts`
- Modify: `packages/projects/src/workstream-service.ts`
- Modify: `packages/projects/src/workstream-service.integration.test.ts`
- Modify: `packages/documents/src/document-service.ts`
- Modify: `packages/documents/src/document-service.integration.test.ts`
- Create: `packages/criteria/src/workspace-query-service.ts`
- Create: `packages/criteria/src/workspace-query-service.integration.test.ts`
- Modify: `packages/criteria/src/index.ts`
- Modify: `apps/api/src/projects/projects.controller.ts`
- Modify: `apps/api/src/projects/projects.controller.test.ts`
- Modify: `apps/api/src/projects/workstreams.controller.ts`
- Modify: `apps/api/src/projects/workstreams.controller.test.ts`
- Modify: `apps/api/src/documents/documents.controller.ts`
- Modify: `apps/api/src/documents/documents.controller.test.ts`
- Modify: `apps/api/src/analysis-criteria/criteria.controller.ts`
- Modify: `apps/api/src/analysis-criteria/criteria.controller.test.ts`
- Modify: `apps/api/src/analysis-criteria/analysis-criteria.module.ts`

**Interfaces:**

- Produces:

```ts
type WorkspacePerson = {
  id: string;
  displayName: string;
};

type WorkspacePersonPeriod = {
  person: WorkspacePerson;
  responsibilityType: "original" | "acting" | "permanent" | "contributor";
  startsAt: string;
  endsAt: string | null;
};

type ProjectWorkspace = {
  project: Project;
  people: WorkspacePersonPeriod[];
  workstreams: Workstream[];
};

type WorkstreamWorkspace = {
  workstream: Workstream;
  people: WorkspacePersonPeriod[];
};

type CriteriaWorkspaceAction =
  "generate" | "owner_review" | "publish" | "respond" | "manager_resolve" | "activate";

type CriteriaWorkspace = {
  proposal: null | {
    id: string;
    kind: "project" | "workstream";
    state:
      | "owner_review"
      | "contributor_review"
      | "manager_resolution"
      | "approved"
      | "rejected"
      | "superseded"
      | "activated";
    version: number;
    sourceDocumentVersionId: string;
    items: Array<CriterionProposalItem & { id: string; position: number }>;
    requiredResponses: number;
    completedResponses: number;
    objectionCount: number;
    viewerResponse: null | { action: "acknowledge" | "object"; reason: string | null };
    managerResolution: null | {
      decision: "request_revision" | "accept_with_objections";
      reason: string;
    };
  };
  activeSet: null | {
    id: string;
    proposalId: string;
    version: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    items: Array<CriterionProposalItem & { id: string; position: number }>;
  };
  replacementRequest: null | {
    replacesProposalId: string;
    ownerFeedback: string;
  };
  allowedActions: CriteriaWorkspaceAction[];
};
```

- Routes:
  - `GET /api/v1/projects/:projectId/workspace`
  - `GET /api/v1/projects/:projectId/workstreams/:workstreamId/workspace`
  - `GET /api/v1/documents/resource?kind=project|workstream&resourceId=<uuid>`
  - `GET /api/v1/dynamic-criteria/workspace?kind=project|workstream&resourceId=<uuid>`

- An absent document or criteria proposal returns `null` inside an authorized response. An unauthorized resource remains 403 and is never converted to “absent.”

- [x] **Step 1: Write strict contract tests**

Add fixtures that prove:

```ts
expect(ProjectWorkspaceSchema.parse(projectWorkspaceFixture)).toEqual(projectWorkspaceFixture);
expect(CriteriaWorkspaceSchema.parse(criteriaFixture).allowedActions).toEqual(["respond"]);
expect(() =>
  CriteriaWorkspaceSchema.parse({
    ...criteriaFixture,
    readinessPercentage: 93,
  }),
).toThrow();
expect(() =>
  CriteriaWorkspaceSchema.parse({
    ...criteriaFixture,
    proposal: { ...criteriaFixture.proposal, suggestedRating: 5 },
  }),
).toThrow();
```

- [x] **Step 2: Run the contract test RED**

Run:

```bash
pnpm exec vitest run --root . packages/contracts/src/workspace.test.ts
```

Expected: FAIL because `workspace.ts` and its exports do not exist.

- [x] **Step 3: Implement the strict schemas and exports**

Use `.strict()` at every object boundary, ISO UTC datetime schemas for periods, existing `ProjectSchema`, `WorkstreamSchema`, and `CriterionProposalItemSchema`, and a unique sorted `allowedActions` array.

- [x] **Step 4: Add failing project/workstream workspace tests**

Tests create current, ended, and future responsibility windows and assert:

```ts
expect(
  view.people.map(({ person, responsibilityType }) => [person.displayName, responsibilityType]),
).toEqual([
  ["Current Owner", "original"],
  ["Current Contributor", "contributor"],
]);
expect(view.people).not.toContainEqual(
  expect.objectContaining({ person: expect.objectContaining({ displayName: "Former Member" }) }),
);
```

The project view includes only authorized child workstreams. A contributor cannot expand the project view beyond scopes already allowed by the existing list services.

- [x] **Step 5: Implement project/workstream workspace methods**

Add `getWorkspace()` methods that reuse the existing `getProject()`/`getWorkstream()` authorization scope, select current half-open responsibility windows at the service clock, include only `User.id` and `User.displayName`, and serialize through the new contracts. No email, role-assignment row, manager decision, or audit data enters the view.

- [x] **Step 6: Add failing document-by-resource tests**

Cover an authorized participant, cross-department denial, absent document, and completed resource read:

```ts
await expect(
  service.getByResource({ actor, correlationId, kind: "project", resourceId }),
).resolves.toMatchObject({ kind: "project", resourceId });
await expect(
  service.getByResource({ actor: outsider, correlationId, kind: "project", resourceId }),
).rejects.toMatchObject({ code: "AUTHZ_SCOPE_MISMATCH" });
```

- [x] **Step 7: Implement exact document lookup**

Resolve the resource through `DocumentResourceIdentityReader`, authorize `document.read`, query the one unique record, and call existing `loadDetail`. Return `null` only after authorization when no record exists.

- [x] **Step 8: Add failing criteria-workspace tests**

Cover:

- project owner sees `generate`, `owner_review`, `publish`, or `activate` only in legal states;
- frozen contributor sees `respond` only before their immutable response;
- department manager sees `manager_resolve` only for a `manager_resolution` proposal in scope;
- outsider receives forbidden;
- response counts count acknowledgments and objections as completed;
- objections/reasons remain retained;
- active-set items come from the activated proposal;
- manager-facing response contains no readiness detail or percentage;
- superseded/rejected proposals expose no illegal action.

- [x] **Step 9: Implement `CriteriaWorkspaceQueryService`**

Load the latest proposal by `proposalNumber desc`, its ordered items, frozen snapshot, viewer eligibility/response, aggregate counts, manager resolution, and active set with its proposal items. Compute each `allowedAction` through the injected existing criteria policy plus state/eligibility preconditions. Do not mutate or lock history.

- [x] **Step 10: Add controller route tests RED, then implement routes**

Each controller parses UUID/kind strictly, passes only authenticated actor/resource inputs to its public service, and retains the existing policy guard. No controller accesses Prisma.

- [x] **Step 11: Verify Task 1**

Run:

```bash
pnpm exec vitest run --root . \
  packages/contracts/src/workspace.test.ts \
  packages/projects/src/project-service.integration.test.ts \
  packages/projects/src/workstream-service.integration.test.ts \
  packages/documents/src/document-service.integration.test.ts \
  packages/criteria/src/workspace-query-service.integration.test.ts \
  apps/api/src/projects/projects.controller.test.ts \
  apps/api/src/projects/workstreams.controller.test.ts \
  apps/api/src/documents/documents.controller.test.ts \
  apps/api/src/analysis-criteria/criteria.controller.test.ts
pnpm --filter @evaluation/contracts typecheck
pnpm --filter @evaluation/projects typecheck
pnpm --filter @evaluation/documents typecheck
pnpm --filter @evaluation/criteria typecheck
pnpm --filter @evaluation/api typecheck
node scripts/validate-boundaries.mjs
```

Expected: all focused tests, type checks, and boundary validation pass.

- [x] **Step 12: Run the critical bounded review and commit**

One specification review and one security/code-quality review inspect only these new reads. Fix confirmed P0/P1 findings once and re-review corrected findings only.

```bash
git add packages/contracts packages/projects packages/documents packages/criteria apps/api
git commit -m "feat: expose protected workspace read models"
```

---

### Task 2: Add the Server-Only Web API Boundary

**Risk class:** Critical because it reads the encrypted OIDC session and forwards the bearer token.

**Files:**

- Modify: `apps/web/src/auth/oidc.ts`
- Modify: `apps/web/src/auth/oidc.test.ts`
- Create: `apps/web/src/platform/workspace-api.ts`
- Create: `apps/web/src/platform/workspace-api.test.ts`
- Create: `apps/web/src/app/api/workspace/[...path]/route.ts`
- Create: `apps/web/src/app/api/workspace/[...path]/route.test.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `.env.example`

**Interfaces:**

```ts
export function sessionAccessToken(encryptedSession: string, settings: OidcSettings): string;

export async function fetchWorkspaceUpstream<T>(input: {
  route:
    | { kind: "projects" }
    | { kind: "project"; projectId: string }
    | { kind: "workstream"; projectId: string; workstreamId: string };
  schema: { parse(value: unknown): T };
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<T>;
```

The catch-all route accepts only:

- `GET projects`
- `GET projects/<uuid>`
- `GET projects/<uuid>/workstreams/<uuid>`

Any other segment count, verb, non-UUID, URL, dot segment, encoded slash, or query-controlled upstream path returns 404 without calling `fetch`.

- [x] **Step 1: Write RED tests for session extraction**

Seal a valid session and assert only the access token is returned. Expired/tampered/wrong-kind cookies return `AUTH_INVALID_SESSION`. Never return the ID token or entire payload.

- [x] **Step 2: Implement the narrow session reader**

Reuse `openAuthCookie`; keep `SessionCookie` private and validate `accessToken` as a non-empty string.

- [x] **Step 3: Write RED tests for upstream fetch**

Mock `cookies()` and `fetch()` and assert:

```ts
expect(fetch).toHaveBeenCalledWith(
  "http://127.0.0.1:3001/api/v1/projects",
  expect.objectContaining({
    cache: "no-store",
    headers: expect.objectContaining({
      authorization: "Bearer access-token",
      "x-correlation-id": expect.stringMatching(UUID_PATTERN),
    }),
  }),
);
```

Also assert the token is absent from returned bodies and safe errors, 401 deletes no cookie silently, and malformed upstream JSON fails closed with a correlation reference.

- [x] **Step 4: Implement `workspace-api.ts`**

Mark it `server-only`. Require `INTERNAL_API_BASE_URL`, allow only `http://127.0.0.1` or `http://localhost` when `APP_ENV=local`, require HTTPS otherwise, build paths from typed IDs, set `cache: "no-store"`, parse JSON through the supplied schema, and map upstream errors to:

```ts
type SafeWorkspaceError = {
  status: 401 | 403 | 404 | 409 | 500 | 503;
  messageKey:
    | "errors.unauthorized"
    | "errors.forbidden"
    | "errors.notFound"
    | "errors.validation"
    | "errors.internal";
  correlationId: string;
};
```

Do not log headers, cookies, tokens, bodies, signed URLs, or provider responses.

- [x] **Step 5: Write RED route allowlist tests**

Test all three approved GETs and rejection of:

```text
POST /api/workspace/projects
GET /api/workspace/https:%2F%2Fevil.example
GET /api/workspace/projects/not-a-uuid
GET /api/workspace/projects/<uuid>/documents
```

- [x] **Step 6: Implement the same-origin GET gateway**

For project and workstream details, compose only the protected upstream responses needed by the screen:

```ts
{
  (workspace, document, readiness, criteria);
}
```

If `document === null`, readiness is `null`. For readiness, request participant detail first; if and only if upstream returns authorization denial, request the operational-state endpoint and return:

```ts
{ audience: "manager", state: "ready" | "needs_attention" | "missing_critical_information" }
```

Never copy a detailed readiness payload into the manager branch.

- [x] **Step 7: Separate the local API port**

Change API bootstrap to:

```ts
const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("API_PORT must be a valid TCP port");
}
await app.listen(port);
```

Add only non-secret local examples:

```dotenv
API_PORT=3001
INTERNAL_API_BASE_URL=http://127.0.0.1:3001
```

- [x] **Step 8: Verify Task 2**

Run:

```bash
pnpm exec vitest run --root . \
  apps/web/src/auth/oidc.test.ts \
  apps/web/src/platform/workspace-api.test.ts \
  "apps/web/src/app/api/workspace/[...path]/route.test.ts"
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web typecheck
pnpm --filter @evaluation/api typecheck
pnpm scan:secrets
```

- [x] **Step 9: Run the critical bounded review and commit**

One specification review and one security/code-quality review inspect only cookie handling, path allowlisting, error redaction, manager readiness projection, and token containment. Fix confirmed P0/P1 findings once.

```bash
git add .env.example apps/api/src/main.ts apps/web/src/auth apps/web/src/platform \
  "apps/web/src/app/api/workspace/[...path]"
git commit -m "feat: add secure workspace web boundary"
```

---

### Task 3: Build the Localized Project Workspace

**Risk class:** Normal product UI. Use one independent review at task completion; defer P2/P3.

**Files:**

- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`
- Modify: `packages/localization/src/catalog.test.ts`
- Create: `apps/web/src/app/[locale]/workspace-shell.tsx`
- Create: `apps/web/src/app/[locale]/projects/workspace-client.tsx`
- Create: `apps/web/src/app/[locale]/projects/workspace-views.tsx`
- Create: `apps/web/src/app/[locale]/projects/workspace-views.test.tsx`
- Create: `apps/web/src/app/[locale]/projects/page.tsx`
- Create: `apps/web/src/app/[locale]/projects/[projectId]/page.tsx`
- Modify: `apps/web/src/app/[locale]/page.tsx`
- Modify: `apps/web/src/app/globals.css`

**Interfaces:**

- Project list reads `/api/workspace/projects`.
- Project detail reads `/api/workspace/projects/<projectId>`.
- Pure views accept already validated `ProjectWorkspace` and detail composite objects; they never receive session or token fields.

- [x] **Step 1: Add paired catalog keys and compatibility tests**

Add exact Arabic/English keys for:

- Projects, workstreams, overview, current people, document, readiness, criteria.
- All project/workstream statuses.
- All responsibility types.
- Loading, empty, retry, and safe error references.
- Version, effective from, current owner, contributor, source, and history labels.
- Criteria states/actions without rating language.

Catalog compatibility must still reject missing keys or mismatched placeholders.

- [x] **Step 2: Write RED pure-view tests**

Use `renderToStaticMarkup` to verify:

```ts
expect(renderProjectList(arCatalog, fixture)).toContain("مشاريعي ومسارات العمل");
expect(renderProjectDetail(enCatalog, fixture)).toContain("Current people");
expect(markup).not.toContain("readinessPercentage");
expect(markup).not.toMatch(/rating|rank|productivity/iu);
```

Also verify empty state, long Arabic names, technical UUID isolation, and semantic heading order.

- [x] **Step 3: Implement the shared workspace shell**

Use one header with logo/title, “Projects and workstreams,” locale switch preserving the current resource path, and logout. Keep the identified-pilot notice on the home screen; do not duplicate manager-feedback copy inside project criteria screens.

- [x] **Step 4: Implement project list states**

`workspace-client.tsx` is the only client data loader. It uses an abortable GET, renders loading → data/empty/error, provides a retry button, and never renders raw upstream messages. Project cards show name, localized status, owner display name when present, and a link to the detail route.

- [x] **Step 5: Implement project detail**

Render:

1. breadcrumb and project name;
2. localized status badge and description;
3. current people;
4. child workstreams;
5. document/readiness summary;
6. criteria summary.

Use anchor navigation instead of hidden tabs so all sections remain keyboard-accessible and linkable.

- [x] **Step 6: Add responsive logical CSS**

Use CSS grid with `minmax(0, 1fr)`, `margin-inline`, `padding-inline`, `border-inline-start`, and a single-column breakpoint at 48rem. Do not use physical left/right positioning. Ensure touch targets are at least 2.75rem high and focus remains visible.

- [x] **Step 7: Verify and review Task 3**

Run:

```bash
pnpm exec vitest run --root . \
  packages/localization/src/catalog.test.ts \
  "apps/web/src/app/[locale]/projects/workspace-views.test.tsx"
pnpm --filter @evaluation/localization typecheck
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web typecheck
node scripts/check-user-visible-copy.mjs
```

One independent normal-product review reports only P0/P1 blockers. Record P2/P3 without delaying.

- [x] **Step 8: Commit**

```bash
git add packages/localization apps/web/src/app
git commit -m "feat: add bilingual project workspace"
```

---

### Task 4: Add Workstream, Document, and Criteria Actions

**Risk class:** Normal UI consuming protected APIs. No new authorization rule is introduced.

**Files:**

- Create: `apps/web/src/app/[locale]/projects/[projectId]/workstreams/[workstreamId]/page.tsx`
- Create: `apps/web/src/app/[locale]/projects/actions.ts`
- Create: `apps/web/src/app/[locale]/projects/actions.test.ts`
- Create: `apps/web/src/app/[locale]/projects/criteria-actions.tsx`
- Modify: `apps/web/src/app/[locale]/projects/workspace-views.tsx`
- Modify: `apps/web/src/app/[locale]/projects/workspace-views.test.tsx`
- Modify: localization catalogs and `apps/web/src/app/globals.css`

**Interfaces:**

```ts
type CriteriaActionState = {
  status: "idle" | "success" | "error";
  messageKey?: CatalogKey;
  correlationId?: string;
};
```

Server Actions:

- `generateCriteriaAction`
- `ownerReviewCriteriaAction`
- `publishCriteriaAction`
- `respondToCriteriaAction`
- `resolveCriteriaAction`
- `activateCriteriaAction`

Every action parses `FormData` through existing contract schemas plus UUID/kind/resource schemas, obtains the server-only session, calls an exact upstream path, uses `revalidatePath`, and returns only a catalog key/correlation ID for expected errors.

- [x] **Step 1: Write RED action-parser tests**

Cover valid inputs and rejection of:

- injected actor/user IDs;
- arbitrary route/path fields;
- criterion item edits;
- rating/ranking/productivity fields;
- missing objection/review/resolution reasons;
- invalid effective date/version;
- mismatched project/workstream kind.

- [x] **Step 2: Implement minimal Server Actions**

Follow Next.js 16 guidance: keep `'use server'` at the action module boundary, validate before calling upstream, call `revalidatePath` after success, and keep `redirect` outside catch blocks. Never return an access token or upstream body.

- [x] **Step 3: Add workstream detail view**

Reuse the project detail visual system. Show current people, immutable document versions/sources, safe readiness state, proposal items, response progress, retained objection count, manager resolution, active version, and effective dates.

For upload sources, show file name/type/size/hash only; signed URLs are fetched only through the existing protected access flow and are not persisted in page state.

- [x] **Step 4: Add role-scoped criteria forms**

Render a form only when its exact action appears in `allowedActions`:

- `generate`: current document version and idempotency key, plus the exact hidden
  `replacesProposalId` and `ownerFeedback` from `replacementRequest` when present;
- `owner_review`: reject/correction/alternative/wording action plus reason/feedback;
- `publish`: approval reason;
- `respond`: acknowledge or object with required reason;
- `manager_resolve`: accept with objections or request revision with reason;
- `activate`: prospective effective time, expected proposal version, reason.

The UI never lets a manager edit criterion text. Objections remain visible after acceptance.

- [x] **Step 5: Add pending/success/error accessibility**

Use `useActionState`, disable only the submitted form while pending, announce status through `aria-live="polite"`, move no focus automatically on validation failure, and display the safe correlation reference.

- [x] **Step 6: Verify Task 4**

Run:

```bash
pnpm exec vitest run --root . \
  "apps/web/src/app/[locale]/projects/actions.test.ts" \
  "apps/web/src/app/[locale]/projects/workspace-views.test.tsx"
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web typecheck
node scripts/check-user-visible-copy.mjs
```

- [x] **Step 7: Self-review and commit**

Because the implementation is UI over already protected APIs, self-review for raw secret leakage, manager readiness detail, illegal action visibility, RTL, and prohibited scoring language. Escalate only a concrete P0/P1.

```bash
git add packages/localization apps/web
git commit -m "feat: add governed workstream criteria workspace"
```

---

### Task 5: Verify T029 End to End and Close Phase 1

**Risk class:** Integration checkpoint.

**Files:**

- Create: `tests/e2e/fixtures/workspace.ts`
- Create: `tests/e2e/fixtures/workspace-api-server.mjs`
- Create: `tests/e2e/project-workspace.spec.ts`
- Create: `tests/e2e/workstream-criteria.spec.ts`
- Modify: `tests/e2e/rtl-focus.spec.ts`
- Modify: `tests/e2e/mixed-direction.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `TASKS.md`
- Modify: `project-state/PROJECT_STATE.md`
- Modify: `project-state/SYSTEM_MAP.html`
- Modify: `MANIFEST.json`

- [x] **Step 1: Add a deterministic local upstream fixture**

Run a dependency-free HTTP fixture on `127.0.0.1:3101` beside the Next.js Playwright server. It accepts only the exact bearer token `e2e-access-token`, implements only the approved Phase 1 GET and criteria-mutation paths, and returns Arabic/English-safe project, workstream, document, participant readiness, manager operational readiness, proposal, response, objection, and active-set fixtures. Unknown paths and missing/wrong tokens return 404/401. Fixtures contain no rating, rank, productivity, provider call, or readiness percentage.

Configure Playwright with two `webServer` entries:

```ts
[
  {
    command: "node tests/e2e/fixtures/workspace-api-server.mjs",
    url: "http://127.0.0.1:3101/health",
  },
  {
    command:
      "pnpm --filter @evaluation/web build && pnpm --filter @evaluation/web start --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/ar",
    env: {
      APP_ENV: "local",
      INTERNAL_API_BASE_URL: "http://127.0.0.1:3101",
      OIDC_SESSION_SECRET: "e2e-session-secret-with-at-least-32-characters",
      OIDC_ISSUER: "http://127.0.0.1:8081/realms/evaluation",
      OIDC_AUDIENCE: "evaluation-api",
      OIDC_CLIENT_ID: "evaluation-web",
      APP_BASE_URL: "http://127.0.0.1:3000",
    },
  },
];
```

Before protected navigation, tests create an encrypted `evaluation_session` cookie with `sealAuthCookie`, `accessToken: "e2e-access-token"`, and a future expiry. The encrypted cookie stays in the browser/server boundary and is never asserted through page content.

- [x] **Step 2: Add the core project/workstream E2E flow**

Verify:

1. `/` redirects to `/ar`;
2. project list renders in RTL;
3. project detail shows status, current people, workstreams, document, and criteria;
4. workstream detail shows two-to-three proposal items;
5. contributor acknowledgment and objection paths are covered through the real Server Action surface, while the browser flow proves one frozen response removes both actions and rejects a duplicate;
6. manager operational readiness never displays detailed missing items;
7. English switch preserves the resource route and renders LTR;
8. 390px viewport produces no horizontal page overflow;
9. keyboard focus follows DOM order;
10. technical UUID/hash/URL content remains LTR-isolated.

- [x] **Step 3: Run focused browser and package gates**

```bash
pnpm test:e2e
pnpm --filter @evaluation/web test
pnpm --filter @evaluation/web lint
pnpm --filter @evaluation/web typecheck
pnpm --filter @evaluation/web build
pnpm --filter @evaluation/localization test
node scripts/check-user-visible-copy.mjs
node scripts/validate-boundaries.mjs
pnpm scan:secrets
```

- [x] **Step 4: Run related Phase 1 integration**

Start the pinned local infrastructure with `.env.example`, deploy migrations to the isolated test database, then run:

```bash
pnpm test:integration
pnpm test:ai
pnpm db:verify
```

Expected: all related integration and migration paths pass; the intentional live AI test remains skipped.

- [x] **Step 5: Perform visual and accessibility QA**

Inspect Arabic desktop/mobile and English desktop screenshots. Confirm no clipping, overlap, physical-direction CSS, low-contrast focus, hidden objections, manager readiness leakage, or architectural jargon. This is low-risk UI, so self-review is sufficient unless a protected boundary changed.

- [x] **Step 6: Close T029 and Phase 1 state**

- Mark only T029 complete in `TASKS.md`.
- Keep `PROJECT_STATE.md` operational: Phase 1 complete, no protected-rule change, T016 Arabic rubric still inactive, deterministic UI/API verification, and Phase 2 planning next.
- Update `SYSTEM_MAP.html` with browser → same-origin gateway → protected API → domain reads/actions and the Arabic/RTL screen flow.
- Refresh only manifest entries for changed authoritative files, then verify every entry byte count and SHA-256.

- [x] **Step 7: Run the final Phase 1 repository gate**

```bash
pnpm verify
pnpm test:integration
pnpm test:ai
pnpm test:e2e
pnpm db:verify
INFRA_ENV_FILE=.env.example pnpm infra:verify
```

Expected: every command exits 0.

- [x] **Step 8: Commit, push, and update Pull Request #3**

```bash
git add TASKS.md project-state MANIFEST.json tests/e2e
git commit -m "feat: complete Phase 1 project workspaces"
git push origin codex/phase-1-projects-workstreams-documents
```

Update the draft PR with T029 results, completed master tasks T018–T029, remaining protected T016 human gate, verification evidence, and any deferred P2/P3 backlog items. Mark it ready only after the final Phase 1 review policy is satisfied.

---

## Plan Self-Review

- **Spec coverage:** T029 list/detail, people, documents, readiness, criteria, acknowledgment, objection, manager resolution, status, Arabic/English, RTL, mixed direction, responsive behavior, role-scoped actions, and core E2E are mapped to Tasks 1–5.
- **Protected-rule coverage:** Manager readiness uses an explicit operational-only branch; no rating/ranking/readiness percentage/productivity/automatic-average field exists; criteria remain human-reviewed and prospective.
- **Scope check:** No T030+ activity/evidence/check-in, no evaluation scoring, no Arabic rubric activation, no provider call, no new database migration, and no product-rule change.
- **Boundary check:** Domain reads stay in their owning packages; the web gateway calls public APIs only; Client Components receive no token/session.
- **Type consistency:** Project/workstream/document/criteria view schemas are defined in Task 1 and consumed unchanged by Tasks 2–5.
- **Placeholder scan:** No TBD, TODO, “implement later,” or undefined neighboring interface remains.
- **Review policy:** Critical authorization/session work gets exactly one spec and one security review with one bounded remediation. Normal UI gets one review or self-review as specified, without open-ended reviewer loops.
