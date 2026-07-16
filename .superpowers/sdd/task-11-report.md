# T011 Implementer Report

## Status

DONE — implementation, independent-review remediation, and repository-wide verification complete.

## Scope

- Task: T011 — Implement AI Router
- Base: `cfc4f8428a5c937b716547b83e9ba676a65250aa`
- Required commit subject: `feat: implement provider-neutral ai router`
- Review remediation commit subject: `fix: harden ai router security boundaries`
- Push: prohibited and not attempted

## Independent-review remediation

The review at `.superpowers/sdd/task-11-review.md` identified one critical, eight important, and one minor issue. All findings were reproduced with failing tests before the implementation was changed.

### Remediation RED evidence

1. AI Router policy, timeout, reference, and fallback suite
   - 47 tests executed: 20 failed and 27 passed.
   - Failures reproduced unsafe local DNS endpoints, unknown-error fallback, a provider operation ignoring cancellation past the deadline, unsafe opaque references, compound prohibited policy terms, and nested-output bypasses.
   - Two later reference-specific tests failed for JWT-like and raw narrative values, confirming the previous slug pattern was too broad.

2. OpenAI-compatible adapter suite
   - 10 tests executed: 7 failed and 3 passed.
   - Failures reproduced uncapped credential lookup, incorrect error categorization, credential failures marked retryable, and serialization failures marked retryable.

3. Provider-boundary suite
   - The prohibited-fixture case failed because CommonJS `require`, direct `.generate`, split route strings, and public adapter exports were not detected.

4. Run-trace and database suite
   - After correcting test-only database isolation and authoritative fixtures, 8 tests executed: 6 failed and 2 passed.
   - Failures reproduced missing immutable provider/schema registries, insufficient exact-version bindings, non-atomic feature persistence, duplicate-correlation rejection, missing invocation scope persistence, and contradictory run metadata.

5. Route-audit suite
   - 15 tests executed: 2 failed and 13 passed.
   - Failures reproduced trusting client-supplied provenance and incomplete audit context.

### Remediation changes

- Added immutable, versioned provider configuration and output-schema artifact registries. Runs now bind through composite foreign keys to the exact route, provider configuration, model/endpoint, output schema version, and SHA-256 schema artifact used.
- Restricted local endpoints to IP literals that are loopback or explicitly injected as approved on-premises addresses. DNS names cannot opt into local trust.
- Made fallback an explicit transient-failure policy. Unknown, credential, serialization, policy, configuration, and validation failures do not fall through to another provider.
- Raced the complete provider operation, including credential lookup, against the deadline and safely absorbed late completion or rejection.
- Made successful feature persistence and successful run tracing one transaction owned by the run-trace repository; any callback or trace failure rolls both back.
- Tightened persisted references to bounded, namespaced opaque identifiers backed by numeric IDs, UUIDs, hashes, or ULIDs. JWTs, URLs, credentials, query strings, and narrative text are rejected in both application and database paths.
- Expanded recursive output-policy checks for rating recommendations, ranking, productivity, readiness, and performance-route activity counts/volumes.
- Persisted project and department invocation scopes with typed foreign keys, while keeping correlation identifiers non-unique.
- Removed adapter exports from the package public API and expanded repository boundary detection to cover import/require variants, direct generation calls, split provider routes, public adapter references, and provider SDK imports.
- Route audit identity, effective subject, and source are now derived from the authenticated server principal. Audit details include prior/next configuration snapshots, affected data type, effective timestamp, administrator identity, and the mandatory reason.

### Remediation GREEN evidence

1. Focused AI Router verification
   - 3 files, 55 tests passed.

2. Focused database and boundary verification
   - 3 files, 28 tests passed.

3. Full integration verification
   - 14 files, 104 tests passed.

4. Migration verification
   - `pnpm db:verify` passed from an empty database and the previous 0005 snapshot, with no drift and equivalent rebuilt schema; its database integration set passed 12/12.

5. Full forced repository verification
   - `TURBO_FORCE=true pnpm verify` exited 0.
   - Task graph 77; secret scan 215 files; performance scan 95 files; format; lint 14/14; boundaries 122 source files; typecheck 14/14; unit coverage 28 files and 199 tests; build 14/14.
   - `git diff --check` passed.

## RED evidence

All behavior tests below were added before product implementation.

1. `source .superpowers/runtime-env.zsh && pnpm --filter @evaluation/ai-routing test`
   - Failed with three missing implementation suites.
   - `resolve-route.test.ts`: `Cannot find module './resolve-route.js'`.
   - `router.test.ts`: initially exposed missing package-local Zod wiring, corrected as test infrastructure before implementation.
   - `openai-compatible.test.ts`: `Cannot find module './openai-compatible.js'`.

2. `source .superpowers/runtime-env.zsh && set -a && source .env.local && set +a && pnpm exec vitest run tests/integration/ai-route-audit.integration.test.ts`
   - Test infrastructure: isolated Docker PostgreSQL started after stopping the pre-existing Homebrew PostgreSQL 16 service; migrations 0001–0005 deployed to the test database.
   - Failed 12/12 tests because `changeAiRouteWithAudit` is absent.
   - Failures cover the transaction-owning composition contract; six invalid trimmed reason cases; successful config plus `ai.route.changed` atomic commit; new-route rollback; next-version rollback; concurrent distinct version creation; immutable history; and missing/wrong authoritative scope UUID rejection.

3. `source .superpowers/runtime-env.zsh && set -a && source .env.local && set +a && pnpm exec vitest run tests/integration/ai-run-trace.integration.test.ts`
   - Failed 3/3 tests.
   - `PrismaAiRoutingRepository` and `AiRouter` are absent.
   - Durable exact-version success trace and durable sanitized quarantine trace both fail because route configuration/router persistence is absent.

4. `source .superpowers/runtime-env.zsh && pnpm exec vitest run tests/repository/ai-provider-boundaries.test.ts`
   - Failed the prohibited fixture because the existing validator returned exit code 0.
   - The allowed adapter fixture already remained accepted.
   - This proves provider SDK and direct `/chat/completions` enforcement is absent.

5. `source .superpowers/runtime-env.zsh && set -a && source .env.local && set +a && pnpm exec vitest run tests/integration/ai-routing-module.integration.test.ts`
   - Failed because the protected API module did not yet exist.

6. First full integration regression after introducing the module
   - 12 suites and 86 tests passed, while `auth.integration.test.ts` failed during application startup.
   - The reproduced root cause was Nest attempting to construct `AuthGuard` inside the feature-module context without its four authentication dependencies.
   - The regression test was strengthened to create the real `AppModule`; the feature module now injects the exported application guard through a small delegation guard, preserving one authentication implementation.

7. Additional hardening RED cases
   - An unknown provider usage field named `secretMetric` was initially retained; the trace sanitizer was changed to an explicit token-count allowlist.
   - A schema-valid nested dynamic record containing `recommendedRating` initially reached the persistence callback; recursive runtime inspection now quarantines prohibited keys even when Zod record keys are not statically enumerable.
   - A compound static field named `managerRatingRecommendation` initially reached provider execution; token-aware schema inspection now rejects compound rating/ranking/productivity names and performance-route raw-count/readiness fields without misclassifying ordinary words such as `operating`.

The tests also cover project > department > system precedence, no lower-scope bypass of an applicable override, local-only external denial, allowed fallback order and error categories, invalid-output quarantine without a feature persistence callback, no rating/ranking/productivity/raw-count performance schema, non-scoring readiness allowance, adapter timeout abort, external HTTPS, and credential-free adapter URLs.

## GREEN evidence

1. AI routing package tests
   - `pnpm --filter @evaluation/ai-routing test`
   - 3 files, 26 tests passed.

2. Database integration and protected module tests
   - Full `pnpm test:integration`: 14 files, 94 tests passed.
   - Includes atomic route-change/audit behavior, rollback, concurrency, immutable history, exact run traces, sanitized quarantine traces, protected module application startup, authentication, authorization, and existing repository workflows.

3. Repository boundary tests
   - Provider-boundary, performance-input, and import-boundary focused set: 8 tests passed.
   - Repository validation inspected 118 source files for architectural/provider boundaries and 94 files for prohibited performance inputs.

4. Migration verification
   - `pnpm db:verify`
   - Passed migration 0006 from an empty database and from the previous 0005 release snapshot, with no drift and equivalent rebuilt schema.

5. Full repository verification
   - `TURBO_FORCE=true pnpm verify`
   - Task graph, secret scan, formatting, lint, boundaries, type checks, 168 unit/coverage tests, and all 14 production build targets passed.
   - `git diff --check` passed.

## Files and database changes

- Added provider-neutral routing contracts, deterministic project > department > system resolution, policy-limited fallback, timeout/cancellation, output-schema safety checks, invalid-output quarantine, and sanitized durable traces in `packages/ai-routing`.
- Added a fake adapter and an OpenAI-compatible HTTP adapter that receives credentials through an injected provider and rejects non-HTTPS, credential-bearing, query-bearing, or fragment-bearing external endpoints.
- Added immutable route/config/run persistence and a transaction-owning route-change operation that writes its audit event in the same serializable transaction.
- Added the protected AI route-management API module with server-side authentication and `system.configure` authorization.
- Extended the boundary scanner so provider SDK imports and direct provider HTTP paths are prohibited outside AI-routing adapters.
- Added unit, integration, migration, protected-module, and repository-boundary regression tests and fixtures.
- Database migration `0006_ai_routing` adds `AiRoute`, immutable `AiRouteConfig` versions, immutable `AiRun` traces, supporting enums, authoritative-scope foreign keys, constraints, indexes, and immutability triggers.
- Commit subject: `feat: implement provider-neutral ai router` (this task commit).

## Security and privacy impact

- Positive: all feature AI calls have a provider-neutral router boundary; no provider SDK is callable from feature modules.
- Positive: `local_only` inputs cannot use or fall back to external adapters.
- Positive: trace persistence stores references, version identifiers, approved token counts, cost, timing, validation codes, and route decisions; it does not store prompts, credentials, raw input, raw output, or provider error text.
- Positive: schemas and runtime outputs reject rating recommendations, employee ranking, productivity scoring, and performance use of raw activity counts or Documentation Readiness.
- Positive: route overrides require a trimmed 3–500 character reason and create the audit record atomically after server-side authorization.
- No protected product rule, privacy mode, rubric, approved product artifact, or historical record was changed.

## Remaining risks

- Live provider credentials and deployment-specific endpoints are deliberately not configured in this task; the adapter contract and security boundary are tested with controlled HTTP doubles.
- Deployment must provide the explicit on-premises IP allowlist before a non-loopback local provider can be registered.
- T012 remains responsible for model-quality evaluation fixtures, including Arabic and dialect behavior. T011 enforces structural and protected-output policy, not model quality.
- Independent re-review of the remediation is still required before merge.

## Project-state effect

No update. This implements the approved AI Router architecture without changing the current goal, protected decisions, architecture direction, active risks, or recommended next action.
