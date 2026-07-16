# T011 Implementer Report

## Status

DONE — implementation, independent-review remediation, and repository-wide verification complete.

## Scope

- Task: T011 — Implement AI Router
- Base: `cfc4f8428a5c937b716547b83e9ba676a65250aa`
- Required commit subject: `feat: implement provider-neutral ai router`
- Review remediation commit subject: `fix: harden ai router security boundaries`
- Fresh re-review remediation commit subject: `fix: close ai router governance gaps`
- Final review remediation commit subject: `fix: complete ai router safety boundaries`
- Fourth review remediation commit subject: `fix: enforce ai router invariants`
- Fifth review remediation commit subject: `fix: fail closed on ai router boundaries`
- Sixth review remediation commit subject: `fix: close ai router review gaps`
- Seventh review remediation commit subject: `fix: close final ai router review gaps`
- Push: prohibited and not attempted

## Seventh review remediation

The seventh review at `.superpowers/sdd/task-11-seventh-review.md` identified two critical issues. Each behavior was reproduced before implementation changed.

### Seventh review RED evidence

1. Fully normalized ranking and order concepts
   - AI-routing package: 167 tests executed; 7 failed and 160 passed.
   - The failures reproduced schema and recursive-runtime acceptance of `staffpriorityrank`, `STAFFPRIORITYRANK`, `candidateranking`, `CANDIDATERANKING`, `candidateRanking2`, `staffdisplayorder`, and `employeeleaderboardtitle`.

2. Lexical generator provenance
   - Provider-boundary suite: 2 tests executed; the prohibited-fixture case failed while the allowed same-name local control passed.
   - The missing findings reproduced an opaque function-parameter shadow, an uninitialized block shadow, `??=` / `||=` writes, and a `for-of` write inheriting or retaining unrelated name-based trust.

### Seventh review changes

- Apply the exact 11 normalized neutral ranking/order fields before a fail-closed search of the fully normalized field for `rank`, `ranked`, `ranking`, `leaderboard`, or `order`. Casing, separators, concatenation, plurals, and suffixes no longer bypass the shared schema/runtime decision.
- Replace name-based local-generator trust with Babel lexical `Binding` identity from the existing exact-pinned `@babel/core@8.0.1` traversal API. Same-name bindings in distinct scopes are independent.
- Treat parameters, catch bindings, non-`=` assignments, updates, `for-of` / `for-in` writes, and unknown constant violations as opaque. Preserve only reviewed direct local generators, exact local aliases, transparent wrappers, and top-level object-rest assignment flows.
- No package or lockfile dependency changed. The authorized `@babel/traverse@8.0.1` version does not exist in the registry, and the existing Babel core API already provides the required lexical traversal.

### Seventh review GREEN evidence

1. Focused remediation verification
   - AI-routing package: 167/167 tests passed.
   - Provider-boundary suite: 2/2 tests passed.

2. Combined T011 verification
   - Router, adapter, governance, route audit, run trace, protected audit, workspace/import, and provider-boundary run: 11 files and 250/250 tests passed.

3. Migration verification
   - `pnpm db:verify`: all six migrations passed from an empty database and the previous 0005 snapshot, with no drift and equivalent rebuilt schemas; database integration passed 12/12.
   - No migration or schema delta was required.

4. Full integration verification
   - `pnpm test:integration`: 15 files and 120/120 tests passed against the isolated PostgreSQL, Redis, MinIO, and Keycloak stack.

5. Full forced repository verification
   - `TURBO_FORCE=true pnpm verify` exited 0.
   - Task graph 77; secret scan 259 files; performance scan 95 files; format; forced lint 14/14; boundaries 124 source files; forced typecheck 14/14; unit coverage 28 files and 311/311 tests; forced build 14/14.
   - `git diff --check` passed, and no approved product, rubric, implementation-plan, task, or agent-governance document changed.

## Sixth review remediation

The sixth review at `.superpowers/sdd/task-11-sixth-review.md` identified three critical and one important issue. Each behavior was reproduced before implementation changes.

### Sixth review RED evidence

1. Exact neutral ranking and order shapes
   - AI-routing package: 160 tests executed; 7 failed and 153 passed.
   - The seven failures reproduced schema-registration and recursive-runtime acceptance of `staffPriorityRank`, `employeeLeaderboardTitle`, `peopleRiskLeaderboard`, `candidateRelevanceRank`, `applicantOrder`, `directReportOrder`, and `associateOrder` on a non-performance route.

2. Invalidatable generator provenance and transparent local controls
   - Provider-boundary suite: 2 tests executed; both failed.
   - The forbidden case missed a proven-local alias after opaque reassignment plus defaulted/nested destructuring, while the allowed case rejected later local assignment, local object-rest declaration/assignment, and transparent local parenthesized, sequence-last, and TypeScript wrappers.

### Sixth review changes

- Replaced token-presence neutral ranking exceptions and people-subject synonym checks with an exact normalized allowlist for `searchRanking`, `priorityRanking`, `riskRanking`, `relevanceRanking`, `leaderboardTitle`, `leaderboardLabel`, `leaderboardDescription`, `displayOrder`, `criterionOrder`, `sortOrder`, and `resultOrder`. Every other field containing a `rank`, `ranked`, `ranking`, `leaderboard`, or `order` token fails closed through the shared schema/runtime predicate.
- Reworked local-generator provenance around all binding writes. A binding is trusted only when every declaration or assignment resolves to a direct local generator or another finally trusted binding, so any opaque reassignment invalidates trust globally and conservatively.
- Propagated proven local provenance through later assignment and top-level object-rest declaration/assignment. Transparent parenthesized, sequence-last, TypeScript assertion/non-null/satisfies, instantiation, and equivalent Babel wrappers are unwrapped; opaque wrapped expressions remain rejected.
- Made `generate` extraction inspection recursive through defaulted `AssignmentPattern`, nested `ObjectPattern`, and `RestElement` shapes for declarations, assignments, and function parameters.

### Sixth review GREEN evidence

1. Focused remediation verification
   - AI-routing package: 160/160 tests passed.
   - Provider-boundary suite: 2/2 tests passed.

2. Full integration verification
   - `pnpm test:integration`: 15 files and 120/120 tests passed against the documented isolated PostgreSQL, Redis, MinIO, and Keycloak stack.

3. Migration verification
   - `pnpm db:verify`: all six migrations passed from an empty database and the previous 0005 snapshot, with no drift and equivalent rebuilt schemas; the included database integration set passed 12/12.
   - No migration or schema delta was required.

4. Full forced repository verification
   - `TURBO_FORCE=true pnpm verify` exited 0.
   - Task graph 77; secret scan 255 files; performance scan 95 files; format; forced lint 14/14; boundaries 124 source files; forced typecheck 14/14; unit coverage 28 files and 304/304 tests; forced build 14/14.

## Fifth review remediation

The fifth review at `.superpowers/sdd/task-11-fifth-review.md` identified one critical and three important issues. Each behavior was reproduced before implementation changes.

### Fifth review RED evidence

1. Global ranking and neutral order semantics
   - AI-routing package: 142 tests executed; 12 failed and 130 passed.
   - Schema and recursive runtime validation accepted talent/candidate/subordinate/succession rank variants outside evaluation routes, while `displayOrder`, `criterionOrder`, `sortOrder`, and `resultOrder` were incorrectly rejected on evaluation routes.

2. Opaque generator-member access
   - Provider-boundary suite: 2 tests executed; 1 failed and 1 passed.
   - Optional `generate` access, bind/call extraction, Reflect access, later assignment, destructuring assignment, and destructured function parameters bypassed the call-shape-oriented detector.

3. Exact AI-routing workspace trust
   - Provider-boundary suite: 2 tests executed; 1 failed and 1 passed.
   - `apps/api/src/packages/ai-routing/escape.ts` was incorrectly trusted because the prior check accepted a `packages/ai-routing` substring anywhere in the repository-relative path.

### Fifth review changes

- Globally reject `rank`, `ranked`, `ranking`, and `leaderboard` outputs unless the key is demonstrably neutral search, priority, risk, relevance, or precise leaderboard metadata. `order` is now separate: it is prohibited only when paired with an explicit people subject, so ordinary display, criterion, sort, and result ordering remains valid. The same predicate governs schema registration, schema execution, and recursive runtime validation.
- Reject opaque `generate` member access/extraction itself outside AI-routing, rather than enumerating invocation shapes. This covers optional access, bind/call, Reflect extraction, declaration and later assignment aliases, destructuring declarations/assignments, and opaque destructured parameters.
- Preserve only statically proven local object/class generator members and their proven aliases/destructuring; regression controls cover optional, bind/call, Reflect, assignment, destructuring, and comments.
- Calculate trusted workspace paths relative to the actual scan root. Production trusts only exact `packages/ai-routing/**`; `--root` establishes a virtual fixture repository root without weakening production path checks.

### Fifth review GREEN evidence

1. Focused remediation verification
   - AI-routing package: 142/142 tests passed.
   - Provider-boundary suite: 2/2 tests passed; production boundary validation inspected 124 source files.
   - Combined router, governance, audit, trace, protected API, and boundary run: 10 files and 193/193 tests passed.

2. Full integration verification
   - `pnpm test:integration`: 15 files and 120/120 tests passed.

3. Migration verification
   - `pnpm db:verify`: empty database, previous 0005 snapshot upgrade, drift detection, and rebuild equivalence all passed; the included database integration set passed 12/12.
   - No migration or schema delta was required.

4. Full forced repository verification
   - `TURBO_FORCE=true pnpm verify` exited 0.
   - Task graph 77; secret scan 247 files; performance scan 95 files; format; forced lint 14/14; boundaries 124 source files; forced typecheck 14/14; unit coverage 28 files and 286/286 tests; forced build 14/14.

## Fourth review remediation

The fourth review at `.superpowers/sdd/task-11-fourth-review.md` identified one critical and four important issues. Each behavior was reproduced before its implementation changed.

### Fourth review RED evidence

1. Open-ended employee-ranking concepts
   - First AI-routing run: 119 tests executed; 10 failed and 109 passed for schema and recursive-runtime `personnelRanking`, `workforceRank`, `colleagueRanking`, `peerLeaderboard`, and `coworkerOrder` cases.
   - The broader conceptual run: 127 tests executed; 7 failed and 120 passed. Six failures reproduced `talentRanking`, `subordinateRank`, and `candidateRanking` at schema and runtime, beyond the explicit people-noun set; one reproduced protected schema descriptor divergence.

2. Governance schema registration
   - Live governance integration: 13 tests executed; 3 failed and 10 passed.
   - Protected rating, people-ranking, and evaluation activity-count schemas were persisted and audited instead of being rejected; this demonstrated that descriptor/registration and router validation had diverged.

3. Provider provenance
   - Provider-boundary suite: 2 tests executed; 1 failed and 1 passed.
   - `client.generate`, an aliased `gateway.generate`, and destructured `gateway.generate` calls were missed because detection depended on provider-like variable names.

4. Normalized governance imports
   - Provider-boundary suite: 2 tests executed; 1 failed and 1 passed.
   - Normalized relative imports using `./` and `internal/../` bypassed the raw-specifier governance check.

5. Non-success trace deadlines
   - AI-routing package: 130 tests executed; 3 failed and 127 passed.
   - Never-settling trace persistence for adapter-missing failure, fallback-policy denial, and invalid-output quarantine exceeded a 120ms test guard despite a 20ms whole-run deadline.

### Fourth review changes

- Made employee-ranking protection contextual instead of synonym-by-synonym. Evaluation/performance routes reject ranking/order/leaderboard output by default, except demonstrably neutral search, priority, risk, relevance, and leaderboard-metadata fields. Explicit people-ranking concepts remain prohibited across routes. Schema inspection and recursive runtime validation use the same predicate.
- Made `outputSchemaDescriptor` the authoritative portability and protected-schema gate. Router execution and governance registration now consume that same invariant, so a schema rejected at execution cannot enter the authoritative registry.
- Replaced generator variable-name heuristics with conservative AST provenance. Outside AI-routing, opaque or imported generator receivers are rejected because their neutrality cannot be proven; local object/class implementations and their local aliases/destructuring are accepted. This prevents neutral alias names from hiding provider execution without blocking demonstrated local report/document generators.
- Canonicalized relative module paths before governance-boundary comparison, including `.`/`..` resolution and JavaScript/TypeScript extension normalization. Only the exact protected API composition file may import the admin composition.
- Raced every awaited non-success trace append against the same monotonic whole-run deadline. Sanitized trace operations may finish late on a best-effort basis, but their settlement is absorbed; established application errors return on time and no feature-success behavior is permitted after timeout.

### Fourth review GREEN evidence

1. Focused remediation verification
   - AI-routing package: 130/130 tests passed.
   - Governance integration: 13/13 tests passed, including no artifact and no audit for protected schema attempts.
   - Provider-boundary suite: 2/2 tests passed; repository boundary validation inspected 124 source files.
   - Combined router, governance, audit, trace, protected API, and boundary run: 10 files and 181/181 tests passed.

2. Full integration verification
   - `pnpm test:integration`: 15 files and 120/120 tests passed.

3. Migration verification
   - `pnpm db:verify`: empty database, previous 0005 snapshot upgrade, drift detection, and rebuild equivalence all passed; the included database integration set passed 12/12.
   - No migration or schema delta was required by this remediation.

4. Full forced repository verification
   - `TURBO_FORCE=true pnpm verify` exited 0 after applying the repository formatter to the AST scanner.
   - Task graph 77; secret scan 237 files; performance scan 95 files; format; forced lint 14/14; boundaries 124 source files; forced typecheck 14/14; unit coverage 28 files and 274/274 tests; forced build 14/14.

## Final review remediation

The final review at `.superpowers/sdd/task-11-final-review.md` identified one critical and four important issues. Each behavioral gap was reproduced before implementation changes.

### Final review RED evidence

1. Protected output aliases
   - AI-routing package: 104 tests executed; 6 failed and 98 passed.
   - The failures reproduced static and recursive `suggestedPerformanceLevel`, `staffRanking`, and `contributorRank` bypasses while retaining neutral-field controls.

2. Governance mutation reachability and audit ownership
   - Governance integration: 10 tests executed; 1 failed and 9 passed.
   - A malicious fourth argument could replace the durable audit writer and execute caller-controlled logic.
   - Repository-boundary tests both failed while reproducing relative imports of the raw governance composition/configuration modules and scanner false positives for unrelated generators.

3. Whole-run deadline
   - AI-routing package: 105 tests executed; 1 failed and 104 passed because a slow persistence callback returned success after the deadline.
   - Live database verification: 1 test failed because a callback could write feature state, wait beyond the deadline, and still commit with a succeeded run trace.

4. Route-bound schema identity
   - AI-routing package: 106 tests executed; 1 failed and 105 passed because a repository could return an artifact owned by a different route and provider execution still began.
   - Live database verification: 1 test failed because an `AiRun` could bind one route to another route's otherwise valid schema artifact.

5. AST provider boundary precision
   - The prohibited-fixture case failed because destructured provider `generate` calls were missed, while the allowed-fixture case failed because unrelated `.generate()` calls and provider-like comments were treated as production calls.
   - A final focused RED case confirmed that a commented-out provider import was also incorrectly treated as a real import.

### Final review changes

- Expanded protected output-name detection to token-aware performance-level suggestions and staff/contributor ranking aliases in both schema inspection and recursive runtime validation.
- Removed caller injection of governance audit writers. Protected API operations now construct one fixed database-backed writer, derive the live principal server-side, and expose only `(client, principal, input)` helper signatures.
- Folded raw route/schema mutation logic into the protected governance composition, deleted the separately importable route-config module, and added AST-enforced restrictions on both package and relative imports of governance internals.
- Extended the one whole-run deadline through response validation and the authoritative feature-persistence/success-trace transaction. The repository receives the abort signal and remaining budget, uses a bounded interactive transaction, and checks cancellation before state writes and before returning success.
- Bound every run to an output artifact owned by the same route in both runtime validation and the database composite foreign key.
- Reworked provider enforcement to use parsed imports/calls instead of raw-source import matching. It detects destructured and aliased provider generation while accepting neutral generators and ignoring comments that resemble calls, URLs, or imports.

### Final review GREEN evidence

1. Focused router, governance, and boundary verification
   - AI-routing package: 106/106 tests passed.
   - Final provider-boundary focused run: 2/2 tests passed.
   - Governance, route audit, run trace, protected API composition, and repository boundaries: 10 files and 175/175 tests passed.

2. Full integration verification
   - `pnpm test:integration`: 15 files and 117/117 tests passed.

3. Migration verification
   - `pnpm db:verify`: empty database, previous 0005 snapshot upgrade, drift detection, and rebuild equivalence all passed; the included database integration set passed 12/12.

4. Full forced repository verification
   - `TURBO_FORCE=true pnpm verify` exited 0.
   - Task graph 77; secret scan 229 files; performance scan 95 files; format; forced lint 14/14; boundaries 124 source files; forced typecheck 14/14; unit coverage 28 files and 250/250 tests; forced build 14/14.

## Fresh re-review remediation

The fresh review at `.superpowers/sdd/task-11-rereview.md` identified one critical, seven important, and one minor issue. Each behavioral gap was reproduced before implementation changes.

### Fresh re-review RED evidence

1. Output-policy and portable-schema identity
   - 70 tests executed: 24 failed and 46 passed.
   - Failures reproduced token/morphology aliases that bypassed protected output checks, recursive aliases reaching persistence, runtime-only Zod constructs sharing an authoritative artifact, opposing refinements sharing one hash, and a refined schema reaching the provider.
   - A later focused case reproduced the inverse edge: representable built-in minimum/maximum constraints were initially rejected.

2. Deadline, route identity, and authoritative invocation scope
   - 84 tests executed: 4 failed and 80 passed.
   - Failures reproduced plaintext non-loopback on-premises HTTP, adapter/trust identity mismatch, a reset-per-stage deadline, and a valid UUID with the wrong authoritative scope type.

3. Static provider boundary
   - The prohibited-fixture case failed while the allowed fixture passed.
   - Computed import/require, bracket or aliased `generate`, and provider URLs obtained from environment state bypassed the previous text scanner.

4. Governance persistence and composition
   - 9 integration tests failed before governance composition and persistence existed.
   - Failures covered public mutation exposure, missing active-System-Administrator authorization, missing server provenance and reasons, non-atomic audit behavior, absent immutable local trust/schema registries, and insufficient exact policy/provider identity constraints.

### Fresh re-review changes

- Unified static and recursive protected-field checks around required token pairs, singular/plural morphology, and exact false-positive controls for performance score/grade, employee ranking, and performance-route raw activity quantities.
- Added canonical JSON Schema artifacts as the authoritative schema identity and rejected runtime semantics that cannot be represented exactly, including refinements, transforms, preprocess/default/catch/coercion, pipes, and overwrite checks. Representable built-in constraints remain supported, concurrent identical registration is idempotent, and conflicting semantics cannot share a version.
- Applied one monotonic whole-run deadline before schema lookup, authoritative scope validation, route resolution, credential lookup, provider execution, fallback, and response handling. Every stage receives only remaining time and late settlements are absorbed.
- Added exact authoritative system/project/department UUID-plus-type validation before route lookup or provider side effects; invalid scope input creates no partial run trace.
- Added immutable versioned local trust policies. Runtime adapter matching now binds provider key, adapter key, locality, normalized endpoint, and exact policy ID/version/IP. External routes require HTTPS; local plaintext is limited to loopback, while non-loopback local endpoints require HTTPS.
- Moved all governance mutation composition into the protected API workspace. The AI-routing package retains one public entry point and exposes no route/provider/trust/schema registration mutation. Every mutation requires a live active System Administrator with `system.configure`, derives provenance from the server principal, requires a reason, and commits state plus audit atomically.
- Extended migration 0006 with exact local-trust/provider foreign keys, endpoint identity checks, immutable schema artifacts, expected behavior, evaluation evidence references, human-approval policy metadata, and immutability triggers.
- Replaced regex-only provider enforcement with Babel AST inspection covering computed imports/requires, static string construction, aliased/bracket generation calls, and environment-derived provider HTTP calls.

### Fresh re-review GREEN evidence

1. Focused router, governance, and boundary verification
   - AI-routing package: 95/95 tests passed.
   - Workspace/import/provider boundaries: 29/29 tests passed.
   - Governance, route audit, run trace, and protected API composition against live PostgreSQL: 37/37 tests passed.
   - Final combined focused rerun: 10 files and 161/161 tests passed.

2. Full integration verification
   - `pnpm test:integration`: 15 files and 114/114 tests passed.

3. Migration verification
   - `pnpm db:verify`: empty database, previous 0005 snapshot upgrade, drift detection, and rebuild equivalence all passed; the included database integration set passed 12/12.

4. Full forced repository verification
   - `TURBO_FORCE=true pnpm verify` exited 0.
   - Task graph 77; secret scan 224 files; performance scan 96 files; format; forced lint 14/14; boundaries 125 source files; forced typecheck 14/14; unit coverage 28 files and 239/239 tests; forced build 14/14.
   - The AI-eval and end-to-end commands currently report no test files in the repository; T012 remains the approved owner of AI evaluation fixtures.

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
- Added immutable local trust policies and output-schema governance metadata; exact policy ID/version/IP and normalized endpoint identity are enforced by application and database constraints.
- Added the protected AI governance and route-management composition inside the API workspace with live server-side authentication and `system.configure` authorization.
- Extended the boundary scanner so provider SDK imports and direct provider HTTP paths are prohibited outside AI-routing adapters.
- Centralized protected schema registration/execution validation, added contextual ranking protection, conservative generator provenance, canonical governance-import enforcement, and bounded non-success trace persistence.
- Added unit, integration, migration, protected-module, and repository-boundary regression tests and fixtures.
- Database migration `0006_ai_routing` adds `AiRoute`, immutable `AiRouteConfig` versions, immutable `AiRun` traces, immutable local trust policies and schema artifacts, supporting enums, exact authoritative-scope and trust-policy foreign keys, constraints, indexes, and immutability triggers.
- Latest remediation commit subject: `fix: close ai router review gaps`.

## Security and privacy impact

- Positive: all feature AI calls have a provider-neutral router boundary; no provider SDK is callable from feature modules.
- Positive: `local_only` inputs cannot use or fall back to external adapters.
- Positive: trace persistence stores references, version identifiers, approved token counts, cost, timing, validation codes, and route decisions; it does not store prompts, credentials, raw input, raw output, or provider error text.
- Positive: schemas and runtime outputs reject rating recommendations, employee ranking, productivity scoring, and performance use of raw activity counts or Documentation Readiness.
- Positive: route overrides require a trimmed 3–500 character reason and create the audit record atomically after server-side authorization.
- No protected product rule, privacy mode, rubric, approved product artifact, or historical record was changed.

## Remaining risks

- Live provider credentials and deployment-specific endpoints are deliberately not configured in this task; the adapter contract and security boundary are tested with controlled HTTP doubles.
- Deployment must register and audit an immutable local trust policy before a local provider can be configured; non-loopback local endpoints still require HTTPS.
- T012 remains responsible for model-quality evaluation fixtures, including Arabic and dialect behavior. T011 enforces structural and protected-output policy, not model quality.
- Independent verification of the sixth remediation commit is still required before merge.

## Project-state effect

No update. This implements the approved AI Router architecture without changing the current goal, protected decisions, architecture direction, active risks, or recommended next action.
