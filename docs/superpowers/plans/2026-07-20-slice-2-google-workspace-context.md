# Slice 2 — Google Workspace Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for bounded implementation. Use one specification/privacy reviewer and one security/code-quality reviewer for OAuth, private context, and the migration. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an employee connect the company's Google Workspace account, see private Gmail and Calendar summaries, exclude unwanted sources, and manually link useful context to a Project.

**Architecture:** Add one bounded `connected-work-context` package with provider-neutral ports. Persist minimal normalized summaries and opaque source references in PostgreSQL. Keep originals in Google, credentials behind a vault interface, and all context private until explicit employee confirmation creates a shared object.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, NestJS, Google Workspace REST APIs, existing OIDC/audit infrastructure, Vitest, Playwright.

## Global Constraints

- Never store Gmail bodies or attachment contents by default.
- Store only fields required for the daily experience: source ID, timestamp, participants reduced to approved identifiers, title, short summary, meeting status, source URL, and sync metadata.
- Manager, Project owner, and administrator APIs must not return an employee's private source summaries.
- A source link is reversible and audited; a confirmed shared Task/Update/Evidence item has its own governed retention.
- Use the narrowest organization-approved scopes. Gmail restricted-scope and server-side storage obligations are a blocking security review item.
- Live OAuth cannot begin without administrator-approved credentials, redirect URIs, scopes, retention, deletion, and consent text.

---

### Task 1: Define private connected-context persistence

**Files:**

- Create: `packages/connected-work-context/package.json`
- Create: `packages/connected-work-context/tsconfig.json`
- Create: `packages/connected-work-context/src/index.ts`
- Create: `packages/contracts/src/connected-work-context.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/connected-work-context.test.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/0018_connected_work_context/migration.sql`
- Create: `packages/database/src/connected-work-context-schema.integration.test.ts`
- Modify: `pnpm-workspace.yaml`

**Core models:**

```ts
type ConnectedSourceItem = {
  id: string;
  employeeId: string;
  provider: "GOOGLE_GMAIL" | "GOOGLE_CALENDAR";
  providerSourceId: string;
  occurredAt: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  privacy: "PRIVATE";
  excluded: boolean;
};
```

The type above is the authorized runtime view. Sensitive title and summary values are stored as protected ciphertext with a key version, not as searchable plaintext.

- [ ] Write failing contract and schema tests for employee ownership, provider/source idempotency, cursor storage, exclusions, and reversible Project links.
- [ ] Add `ConnectedWorkAccount`, `ConnectedSourceItem`, `ConnectedSourceExclusion`, `SourceProjectLink`, and `ConnectorSyncCursor`.
- [ ] Store sensitive derived title/summary fields as ciphertext plus key version; retain only non-sensitive routing fields in plaintext.
- [ ] Persist an opaque `credentialRef`; do not add plaintext access or refresh token columns.
- [ ] Add retention timestamps and indexes for employee/time/review-state queries.
- [ ] Run focused contract/schema tests and `pnpm db:verify`.
- [ ] Commit as `feat(context): add private connected work schema`.

### Task 2: Implement provider-neutral connection and sync services

**Files:**

- Create: `packages/connected-work-context/src/credential-vault.ts`
- Create: `packages/connected-work-context/src/source-adapter.ts`
- Create: `packages/connected-work-context/src/connection-service.ts`
- Create: `packages/connected-work-context/src/sync-service.ts`
- Create: `packages/connected-work-context/src/query-service.ts`
- Create: `packages/connected-work-context/src/fake-google-workspace-adapter.ts`
- Create: `packages/connected-work-context/src/connection-service.integration.test.ts`
- Create: `packages/connected-work-context/src/sync-service.integration.test.ts`
- Create: `packages/connected-work-context/src/query-service.integration.test.ts`

**Ports:**

```ts
export interface CredentialVault {
  put(input: SealedCredentialInput): Promise<{ credentialRef: string }>;
  use<T>(credentialRef: string, fn: (credential: OAuthCredential) => Promise<T>): Promise<T>;
  revoke(credentialRef: string): Promise<void>;
}

export interface PrivateContextProtector {
  seal(value: string): Promise<{ ciphertext: string; keyVersion: string }>;
  open(input: { ciphertext: string; keyVersion: string }): Promise<string>;
}

export interface ConnectedSourceAdapter {
  pull(input: PullSourceInput): Promise<SourceDeltaPage>;
}
```

- [ ] Write privacy tests proving only the owning employee can query summaries or change exclusions.
- [ ] Write idempotency tests for repeated events and sync pages.
- [ ] Write cursor-expiry recovery tests that reset provider sync without duplicating normalized items.
- [ ] Implement the services against the fake adapter first.
- [ ] Require a production cryptographic key provider for live mode; deterministic local protection must be visibly development-only.
- [ ] Emit audit events for connect, disconnect, exclusion change, manual link, unlink, and credential revocation without recording private content.
- [ ] Run `pnpm --filter @evaluation/connected-work-context test`.
- [ ] Commit as `feat(context): add governed connection and sync services`.

### Task 3: Add protected APIs and deterministic review data

**Files:**

- Create: `apps/api/src/connected-work-context/connected-work-context.module.ts`
- Create: `apps/api/src/connected-work-context/connections.controller.ts`
- Create: `apps/api/src/connected-work-context/context-items.controller.ts`
- Create: `apps/api/src/connected-work-context/connected-work-context-policy.guard.ts`
- Create: `apps/api/src/connected-work-context/connected-work-context.e2e.integration.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Endpoints:**

```text
POST   /api/v1/connected-work/google/start
GET    /api/v1/connected-work/google/callback
DELETE /api/v1/connected-work/google
GET    /api/v1/connected-work/items
PATCH  /api/v1/connected-work/items/:id/exclusion
PUT    /api/v1/connected-work/items/:id/project-link
DELETE /api/v1/connected-work/items/:id/project-link
```

- [ ] Test CSRF/state/nonce enforcement, principal/account binding, inactive users, exact redirect allowlists, and cross-user denial.
- [ ] Return a deliberate `EXTERNAL_CONFIGURATION_REQUIRED` result when live OAuth configuration is absent.
- [ ] Add a deterministic local adapter mode explicitly labelled synthetic.
- [ ] Do not log authorization codes, credentials, tokens, item summaries, or source URLs.
- [ ] Run the API integration test and `pnpm scan:secrets`.
- [ ] Commit as `feat(api): expose private connected work context`.

### Task 4: Build employee connection and source review UI

**Files:**

- Create: `apps/web/src/platform/connected-work-context-api.ts`
- Create: `apps/web/src/platform/connected-work-context-api.test.ts`
- Create: `apps/web/src/app/[locale]/settings/connections/page.tsx`
- Create: `apps/web/src/app/[locale]/settings/connections/google-workspace-card.tsx`
- Create: `apps/web/src/app/[locale]/my-work/connected-context.tsx`
- Create: `apps/web/src/app/[locale]/my-work/source-review-sheet.tsx`
- Modify: `apps/web/src/app/[locale]/my-work/my-work-client.tsx`
- Modify: `apps/web/src/app/api/workspace/[...path]/route.ts`
- Modify: `packages/localization/src/catalogs/ar.json`
- Modify: `packages/localization/src/catalogs/en.json`

- [ ] Write component tests for connect/disconnect status, excluded labels/calendars, private labels, manual Project link/unlink, and error recovery.
- [ ] Show email subjects/summaries and upcoming meetings as compact context, never as automatically completed work.
- [ ] Open mobile source review in a visible bottom sheet, not below the list.
- [ ] Explain what is stored, who can see it, and how to disconnect/delete.
- [ ] Keep the employee in control when source-to-Project mapping is uncertain.
- [ ] Show last successful sync, stale-data status, retry/reconnect, and no-duplicate recovery after connector failure.
- [ ] Run focused web/localization tests and typecheck.
- [ ] Commit as `feat(web): add private workspace context review`.

### Task 5: Add live Google adapters behind the external gate

**Files:**

- Create: `packages/connected-work-context/src/google/gmail-rest-adapter.ts`
- Create: `packages/connected-work-context/src/google/calendar-rest-adapter.ts`
- Create: `packages/connected-work-context/src/google/google-oauth-client.ts`
- Create: `packages/connected-work-context/src/google/google-adapters.test.ts`
- Create: `docs/operations/GOOGLE_WORKSPACE_CONNECTION.md`

- [ ] Confirm administrator approval of OAuth client, redirect URIs, scopes, retention/deletion policy, consent copy, and production credential-vault implementation.
- [ ] If any item is missing, stop at `EXTERNAL_CONFIGURATION_REQUIRED`; keep deterministic acceptance available.
- [ ] Add mocked HTTP contract tests for pagination, rate limits, token refresh, revocation, Gmail history gaps, Calendar incremental sync, and Calendar `410` cursor expiry.
- [ ] Request only approved read scopes; document that Gmail restricted-scope use may require verification and security assessment when server-side data handling applies.
- [ ] Keep provider payload parsing inside adapters and normalized contracts outside.
- [ ] Run provider-adapter tests without exposing live credentials.
- [ ] Commit as `feat(context): add gated google workspace adapters`.

### Task 6: Privacy acceptance checkpoint

**Files:**

- Create: `tests/e2e/google-workspace-context.spec.ts`
- Create: `docs/acceptance/AI_FIRST_DAILY_WORKSPACE_SLICE_2.md`
- Create screenshots under: `docs/product/screenshots/ai-first-daily-workspace/slice-2/`

- [ ] Exercise deterministic Gmail/Calendar context: review, exclude, manual Project link, unlink, disconnect.
- [ ] Verify manager and another employee receive no private summaries or source metadata.
- [ ] Verify a shared Task contains only employee-confirmed content and a source reference appropriate to its visibility.
- [ ] Run focused tests, migration verification, affected lint/typechecks, and protected scans.
- [ ] Request the bounded privacy and security reviews; fix only confirmed P0/P1 findings and re-review those findings.
- [ ] Commit as `test: verify connected work privacy boundaries`.
- [ ] Push, update Pull Request #5, publish URLs/screenshots, then stop.

## Product Owner Stop Gate

The Product Owner reviews whether connected email and calendar feel like a quiet assistant rather than a new inbox, whether privacy is obvious, and whether manual Project linking is fast and reversible.

Live Google acceptance remains a separate administrator/credential gate. Official references:

- Gmail OAuth scopes: <https://developers.google.com/workspace/gmail/api/auth/scopes>
- Calendar list and sync tokens: <https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list>
- Google Workspace user data policy: <https://developers.google.com/workspace/workspace-api-user-data-developer-policy>
