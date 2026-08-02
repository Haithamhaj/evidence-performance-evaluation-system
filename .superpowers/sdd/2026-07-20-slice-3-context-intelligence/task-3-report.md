# Slice 3 Task 3 Report — Routed Context Summaries and Task Drafts

## Status

Complete.

- Task ID: `P2R-S3 / S3-T3`
- Feature commit: `ad8dc30c1d5ac1962432fae8fc8a9c95bc99945d`
- Commit message: `feat(context-ai): add routed summaries and task drafts`
- Branch: `codex/phase-2-updates-evidence-readiness`
- Worktree: `.worktrees/phase-2-updates-evidence-readiness`
- Push: not performed

## RED evidence

Tests and AI evaluations were written before production implementation. The first RED command used
the repository-pinned Node.js `24.18.0` and pnpm `11.13.0`:

```text
pnpm exec vitest run \
  packages/context-intelligence/src/prompts.test.ts \
  packages/context-intelligence/src/analysis-service.integration.test.ts \
  packages/context-intelligence/src/task-draft-service.integration.test.ts \
  apps/api/src/ai-routing/system-ai-scope.test.ts \
  tests/ai/context-intelligence.eval.test.ts

Test Files  5 failed (5)
```

Four suites failed because the required prompt, analysis, and Task-draft production modules did not
exist. The system-scope suite loaded and its new test failed because
`resolveContextIntelligenceSystemAiScopes` did not exist; its three pre-existing tests passed. This
was the expected missing-behavior failure rather than a baseline failure.

A later hardening RED added two regressions before their implementation:

```text
pnpm exec vitest run packages/context-intelligence/src/prompts.test.ts

Test Files  1 failed (1)
Tests       2 failed | 3 passed (5)
```

Those tests proved that a derived Context Analysis was not yet re-delimited before Task drafting and
that the AI Task output schema still accepted an empty description. Both now fail closed.

## What changed

- Added one versioned route manifest with the exact governed routes:
  - `context.summarize.v1`
  - `context.project-match.v1`
  - `task.draft.v1`
- Added independent input-schema, output-schema, and prompt-template versions for every route.
- Added strict structured-output schemas and trusted prompts that keep output source-labelled,
  grounded, uncertain when context is missing, and free of rating, ranking, productivity,
  activity-volume, readiness-conversion, and employee-quality judgments.
- Added bounded input builders for email, event, document, code, and comment sources. Untrusted
  content is normalized, control characters and spoofed boundaries are escaped, and each source is
  strongly delimited. Approved Project document context and derived Context Analysis are also
  delimited before model reuse.
- Added `ContextAnalysisService`, which obtains only registered prompt artifacts, sends summary and
  Project-explanation requests through the existing `AiRouter`, validates source grounding and the
  succeeded immutable run trace, encrypts the structured summary output, and appends the governed
  Context Analysis.
- Combined the Task 2 deterministic Project decision with an AI explanation while leaving the
  deterministic decision authoritative. The AI output contains no decision field and cannot turn
  `REVIEW` or `NO_MATCH` into `AUTO_LINK`.
- Added `TaskDraftService`, which runs only `task.draft.v1`, rejects a model-supplied Project that
  conflicts with the deterministic decision, validates grounding and route lineage, encrypts the
  full structured draft, and appends only a pending employee-reviewable Task-draft record.
- Added exact system-scope resolution for the three Context Intelligence routes and no others.
- Added the required AI-evaluation workspace pattern so `tests/ai/context-intelligence.eval.test.ts`
  runs under the existing `ai-evals` project.

No provider SDK, direct provider endpoint, official Task creation, Project mutation, or live Google
integration was added. No paid live-model call was required for this task; the executable tests use
deterministic governed-router fixtures.

## Files changed

- `apps/api/package.json`
- `apps/api/src/ai-routing/system-ai-scope.ts`
- `apps/api/src/ai-routing/system-ai-scope.test.ts`
- `packages/context-intelligence/package.json`
- `packages/context-intelligence/src/index.ts`
- `packages/context-intelligence/src/project-link-suggestion-service.ts`
- `packages/context-intelligence/src/prompts.ts`
- `packages/context-intelligence/src/prompts.test.ts`
- `packages/context-intelligence/src/analysis-service.ts`
- `packages/context-intelligence/src/analysis-service.integration.test.ts`
- `packages/context-intelligence/src/task-draft-service.ts`
- `packages/context-intelligence/src/task-draft-service.integration.test.ts`
- `tests/ai/context-intelligence.eval.test.ts`
- `vitest.workspace.ts`
- `pnpm-lock.yaml`

The lockfile was regenerated with pnpm `11.13.0`; its final diff is nine additions and no removals,
covering only the API workspace link and the package's direct AI Router and Zod dependencies.

## Database changes

None. Task 1 already supplied the append-only encrypted Context Analysis, Project-link suggestion,
Task-draft, correction, and immutable AI-run persistence contracts. This task adds domain services
and narrow persistence ports but no migration or schema change.

## Verification

All final commands used Node.js `24.18.0` and pnpm `11.13.0`.

| Check                                                 | Result                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| Focused Task 3 suite                                  | 5 files, 29 tests passed                                    |
| `pnpm --filter @evaluation/context-intelligence test` | 7 files, 34 tests passed                                    |
| `pnpm test:ai -- context-intelligence`                | 6 files, 163 passed and 1 skipped                           |
| API system-scope suite                                | 1 file, 4 tests passed                                      |
| `pnpm scan:ai-boundary`                               | 580 source files valid                                      |
| `pnpm lint`                                           | 22/22 packages passed; boundary and user-copy checks passed |
| `pnpm typecheck`                                      | 22/22 packages passed                                       |
| `pnpm test`                                           | task graph 14/14; 127 files and 873 tests passed            |
| `pnpm scan:performance-inputs`                        | 476 files valid                                             |
| `pnpm scan:secrets`                                   | 950 files valid                                             |
| `pnpm format:check`                                   | passed                                                      |
| `git diff --check`                                    | passed                                                      |
| Lockfile diff check                                   | 9 additions, 0 removals                                     |

## Security and privacy impact

- All model execution stays behind the existing governed AI Router; the AI boundary scanner found
  no direct-provider path.
- The services accept only registered prompt artifacts whose route, version, trusted body, and
  SHA-256 hash exactly match the compiled manifest.
- Every persisted result must match a succeeded immutable AI-run trace, exact route, output-schema
  version, prompt-template version, output reference, and governed source-reference set.
- Provider credentials, access tokens, model keys, provider names, usage, and cost are not copied
  into Context Intelligence persistence.
- Connected-source content is classified `confidential`. Derived summary and Task-draft payloads are
  sealed before append, and the persistence ports receive the ciphertext and key version required
  by Task 1's encrypted-at-rest schema alongside the validated domain record.
- Source references are opaque governed identifiers. Invented or out-of-scope references are
  rejected before feature persistence.
- Prompt-injection fixtures cover email, event, document, code, and comment content, including
  spoofed boundaries. Arabic and mixed Arabic/English technical text remain intact.
- AI failure does not alter or delete raw source input, and the services expose no official Task
  creation capability.
- Employee review remains mandatory: all AI runs request human approval and every new governed
  record starts in `PENDING` with `AI` revision origin.

## Protected-rule confirmation

- AI does not assign, predict, or recommend a rating, employee rank, productivity score, readiness
  conversion, activity-count performance inference, or employee quality judgment.
- Documentation Readiness does not become a performance score.
- Deterministic Project matching remains authoritative; model confidence is not an anchor and AI
  cannot upgrade `REVIEW` or `NO_MATCH`.
- AI output remains a source-labelled draft interpretation rather than a source fact.
- No official Task is created or assigned automatically.
- No raw activity count becomes a metric and no Project/evaluation weighting or rating behavior is
  introduced.
- No historical row is overwritten and no protected evaluation, feedback-visibility, privacy,
  Arabic-release, or retention rule changes.

## Remaining risk and follow-up boundary

The existing `AiRouter.commitSucceededRun` contract creates the immutable `AiRun` only after its
validated-output callback returns. Task 1's Context Intelligence rows have a foreign key to that
`AiRun`, so this task must append the feature row after the router transaction completes. If the
post-run encryption or append fails, the raw/manual workflow remains available and no invalid
feature row is written, but a succeeded `AiRun` can remain without its corresponding Context
Intelligence row. Resolving that narrow atomicity gap requires an approved AI Router transaction
extension or a reconciler; changing the shared router contract was outside Task 3 scope.

Task 4 still owns concrete persistence/API adapters, server-side employee/source ownership and
Project authorization enforcement, idempotent employee confirmation, and official Work Item
creation only after that confirmation. Live Google remains outside this task's scope.

## Self-review

- Re-read the exact Task 3 brief, Slice 3 plan, protected product rules, Task 1 contracts, Task 2
  deterministic matcher, and existing AI Router before implementation.
- Confirmed the route strings occur only as the exact three approved keys and that the feature
  package has no Work Items dependency.
- Confirmed prompt/schema changes are versioned and covered by the required AI evaluations,
  including Arabic/mixed text and prompt-injection cases.
- Confirmed the final lockfile contains only the intended importer changes.
- Confirmed the branch-finishing choice is to keep the named branch and its worktree as-is; the
  parent task explicitly prohibited pushing or merging from this subtask.

## Project-state update

None. This bounded Task 3 implementation does not change the current Slice 3 goal, architecture
direction, protected decisions, or external Product Owner gates. The parent Slice 3 checkpoint owns
the meaningful project-state update after the slice boundary is integrated.

---

## Fix Round 1

### Status and commit

Complete.

- Fix commit: `2de9667230dead1077fe658092d14fc1f12340ab`
- Commit message: `fix(context-ai): harden routed AI boundaries`
- Push: not performed

### RED evidence for the seven confirmed findings

The regressions were added before their corresponding production fixes. Commands used the
repository-pinned Node.js `24.18.0` and pnpm `11.13.0`.

The prompt/schema RED run was:

```text
pnpm exec vitest run packages/context-intelligence/src/prompts.test.ts

Test Files  1 failed (1)
Tests       7 failed | 5 passed (12)
```

It covered Findings 1, 4, and 6, and supplied the real-Router precondition for Finding 7:

- **Finding 1 — real Router-representable schemas.** `outputSchemaDescriptor`, the same descriptor
  called by `AiRouter.run`, rejected all three real output schemas with
  `AI_SCHEMA_SEMANTICS_UNREPRESENTABLE`. The schemas embedded trim/refinement behavior that JSON
  Schema could not represent, so a real Router invocation could not reach a provider.
- **Finding 4 — provider-visible governed decision evidence.** The Project-match request did not
  expose the deterministic `AUTO_LINK` anchors or bounded, accessible `REVIEW` candidates and
  reasons to the provider. The RED tests also showed that semantic Project context was not
  correlated to the deterministic Project set.
- **Finding 6 — exact prohibited phrases.** The policy guard did not reject “Award five stars to
  this employee”, “This employee deserves the top score”, or “الموظف يستحق خمس نجوم”. The same RED
  group also caught a supported-claim citation absent from top-level provenance.

The service RED run was:

```text
pnpm exec vitest run \
  packages/context-intelligence/src/analysis-service.integration.test.ts \
  packages/context-intelligence/src/task-draft-service.integration.test.ts \
  packages/context-intelligence/src/project-link-suggestion-service.test.ts

Test Files  3 failed (3)
Tests       6 failed | 10 passed (16)
```

It covered Findings 2 and 3:

- **Finding 2 — exact lineage and ciphertext-only persistence.** Project-link persistence still
  accepted a domain record containing plaintext explanation text; the exact suggestion ID was not
  preallocated through the Router output reference, and AI uncertainty text was not retained in
  the saved explanation.
- **Finding 3 — retry safety after response loss.** A response lost after an append caused duplicate
  Router work on retry. The RED fixtures failed for a committed Context Analysis followed by a lost
  response, a committed Project suggestion followed by a lost response, and the equivalent
  Task-draft case. They also showed that the services relied on locally constructed values instead
  of the persistence port's authoritative return value.

The production-registration RED run was:

```text
pnpm exec vitest run \
  scripts/register-context-intelligence-ai-routes.test.ts \
  scripts/register-context-intelligence-ai-routes.integration.test.ts

Test Files  2 failed (2)
Tests       no tests
Error       register-context-intelligence-ai-routes.js did not exist
```

**Finding 5 — authorized production registration.** There was no production path that registered
the exact three prompt/schema artifacts and authorized system routes. After the module was
introduced, its first database RED also rejected the test-only `databaseUrl` option as an
unrecognized registration argument; the input boundary was corrected without weakening the CLI
schema.

**Finding 7 — actual Router-backed AI evaluations.** This was a test-boundary defect in addition to
the real-schema failure above. The pre-fix AI evaluation constructed outputs and called Zod schemas
directly; it never invoked `AiRouter` or a provider adapter. The three descriptor failures are the
executable RED evidence that replacing that shortcut with the real Router would fail before
provider execution. The evaluation was then rewritten to use the existing `AiRouter` and
deterministic `FakeAiProviderAdapter`; it now exercises route resolution, governed schema-artifact
matching, provider invocation, Router parsing, quarantine traces, validated persistence callbacks,
and the explicit post-parse semantic guards.

### What changed

1. **Representable Router schemas and explicit semantics.** The three persisted output schemas now
   contain only JSON-Schema-representable structural constraints. Grounding, prohibited-judgment
   policy, claim/top-level citation correlation, and deterministic Task/Project correlation remain
   explicit post-parse service guards rather than hidden Zod refinements.
2. **Exact suggestion lineage and protected persistence.** The suggestion ID is stable and
   preallocated before the match run; the exact Router output reference is
   `project-link-suggestion:<suggestion-id>`. Match uncertainties are retained in the explanation.
   The initial persistence port accepts a record with no `explanation` property plus sealed
   ciphertext and key version, so its contract cannot persist plaintext explanation content.
3. **Response-loss retry safety.** Context Analysis, Project suggestion, and Task draft use stable
   operation IDs, read an already-committed initial record before invoking the Router, and return
   the authoritative persistence result after validating its identity and revision. Retrying after
   a committed append and lost response therefore skips duplicate AI work and duplicate initial
   rows.
4. **Provider-visible governed decision evidence.** `AUTO_LINK` prompts include the bounded
   deterministic anchors. `REVIEW` prompts include only accessible candidates, their bounded
   anchors/current state, and deterministic reasons. Inaccessible Projects and model-confidence
   values are omitted. Approved Project semantic context is rejected unless its Project belongs to
   the deterministic visible Project set.
5. **Authorized production registration.** A new production registrar registers the exact three
   versioned output-schema artifacts, prompt artifacts, and system routes through the existing
   authorized governance functions. It reuses the ordered provider selection already configured
   on the governed system `update.structure` route. It does not register a provider, import a
   provider SDK, read credentials, or return provider/endpoint/token data in its dry-run plan.
6. **Confirmed phrase rejection.** The post-parse policy normalization now rejects the exact English
   five-star and top-score forms and the Arabic `خمس نجوم` form, in addition to the existing rating,
   ranking, productivity, readiness-conversion, activity-volume, and employee-quality forms.
7. **Real Router AI evaluations.** Context Intelligence AI evaluations now run deterministic
   responses through the existing Router adapter fixture. Strict extra fields are quarantined
   before persistence; safe outputs generate succeeded traces; grounding and judgment policy run
   explicitly after the Router's structural parse, matching the production service sequence.

### Files changed in Fix Round 1

- `packages/context-intelligence/src/prompts.ts`
- `packages/context-intelligence/src/prompts.test.ts`
- `packages/context-intelligence/src/analysis-service.ts`
- `packages/context-intelligence/src/analysis-service.integration.test.ts`
- `packages/context-intelligence/src/project-link-suggestion-service.ts`
- `packages/context-intelligence/src/project-link-suggestion-service.test.ts`
- `packages/context-intelligence/src/task-draft-service.ts`
- `packages/context-intelligence/src/task-draft-service.integration.test.ts`
- `scripts/register-context-intelligence-ai-routes.ts`
- `scripts/register-context-intelligence-ai-routes.test.ts`
- `scripts/register-context-intelligence-ai-routes.integration.test.ts`
- `tests/ai/context-intelligence.eval.test.ts`
- `vitest.workspace.ts`

### Database changes

None. The database-backed registration test writes only governed fixture/configuration rows to the
existing test schema. No migration, model, constraint, index, or production seed changed.

### Verification

| Check                                                        | Result                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| Focused prompt, service, registrar-unit, and Router-eval run | 6 files, 46 tests passed                               |
| Production registrar database integration                    | 1 file, 1 test passed                                  |
| Context Intelligence package typecheck                       | passed                                                 |
| Repository typecheck                                         | 22/22 packages passed                                  |
| Repository lint                                              | 22/22 packages; boundaries and user-copy checks passed |
| AI evaluations                                               | 6 files; 166 passed, 1 skipped                         |
| AI boundary scan                                             | 580 source files valid                                 |
| Secret scan                                                  | 954 files valid                                        |
| Performance-input scan                                       | 476 files valid                                        |
| Format check                                                 | passed                                                 |
| Registrar dry-run through `tsx`                              | passed                                                 |
| `git diff --check`                                           | passed                                                 |

One non-focused full parallel unit run ended with `127` files passed, `1` file failed, and `862`
tests passed before bail. The single failure was the repository test named “excludes generated
output from source-boundary validation”. Its boundary subprocess observed transient
`.boundary-forbidden-fixture-*` directories created by other concurrently running negative-fixture
tests; the failure did not identify a changed Context Intelligence file. No transient fixture or
background Vitest process remained afterward, and the Git worktree was clean.

The affected repository test was then rerun alone from that clean worktree:

```text
pnpm exec vitest run --project unit tests/repository/workspace.test.ts \
  -t 'excludes generated output from source-boundary validation'

Test Files  1 passed (1)
Tests       1 passed | 23 skipped (24)
```

The focused 46-test run and the independent `pnpm scan:ai-boundary` run were also green after the
boundary-safe explicit ciphertext-record construction. This records the full-suite result as a
transient concurrent test-fixture collision, not as a passing full unit suite.

### Security and privacy impact

- No direct provider SDK, provider endpoint, credential, access token, or live paid-model call was
  introduced. All production model execution remains behind the governed AI Router.
- Provider input includes only deterministic, bounded, accessible Project evidence. Inaccessible
  candidates and model confidence are not disclosed.
- Project-link explanation persistence is now ciphertext-only by contract; Context Analysis and
  Task draft continue to be sealed before append.
- Stable operation IDs prevent retries after a lost response from creating duplicate AI outputs or
  initial feature records.
- Exact route, prompt, schema, source, and output-reference lineage remains validated. AI outputs
  remain source-labelled drafts pending human review and cannot create an official Task.
- The added policy forms strengthen the prohibition on ratings, ranking, productivity scoring, and
  employee-quality judgment in English and Arabic.

### Remaining risk and deferred P2

The previously recorded narrow post-`AiRun` atomicity gap remains: the Router can commit a succeeded
immutable run before later semantic checking, encryption, or feature-row append fails. This can
leave an orphan succeeded run but cannot persist an invalid feature row or alter the source/manual
workflow. Fixing it requires a shared Router transaction extension or reconciler and remains the
explicitly deferred P2; it was not expanded into this bounded fix round.

The mechanical P2 of deeper citation-to-claim and semantic-Project correlation is partially
strengthened here: each supported-claim citation must appear in top-level provenance, and semantic
Project contexts must belong to the deterministic visible Project set. More granular semantic
entailment remains outside this task.

### Project-state update

None. Fix Round 1 restores the already-approved Task 3 behavior and does not change a protected
product rule, architecture direction, current goal, active risk, or next recommended Slice action.

---

## Fix Round 2

### Status and commit

Complete.

- Production fix commit: `e9a03c440b836a9fa35441b735fd5233602d1281`
- Commit message: `fix(context-ai): validate project match recovery`
- Scope: the two remaining original P1 findings only
- Push: not performed

### Root cause

1. The Project-link service encrypted `suggestion.explanation`, which was a formatted display string
   combining the deterministic reason, AI label, AI explanation, and uncertainty prose. Although
   encrypted, it was not the exact Router-validated four-field Project-match output, so decryption
   could not recover that structured object or its exact citations and uncertainty arrays.
2. Both idempotent lookup paths returned `findOwnedSuggestion` results directly. The persistence
   query accepted an employee and suggestion ID, but the service did not independently parse the
   returned value with the Task 1 `ProjectLinkSuggestionSchema` or bind it to the stable operation's
   source item, analysis, revision, route, schema, prompt, decision, Project, anchors, and governed
   provenance.

### RED evidence

The regression tests were written and observed failing before the production change:

```text
pnpm exec vitest run \
  packages/context-intelligence/src/project-link-suggestion-service.test.ts \
  packages/context-intelligence/src/analysis-service.integration.test.ts

Test Files  2 failed (2)
Tests       10 failed | 10 passed (20)
```

The failures were the intended behaviors:

- Two structured-payload regressions failed because parsing the project-match sealer input raised
  `SyntaxError`; the protected value began with the formatted deterministic explanation instead of
  canonical JSON.
- Seven table-driven retry regressions resolved instead of rejecting a returned suggestion with a
  wrong ID, employee, source item, revision, analysis lineage, route lineage, or source provenance.
- The response-loss lookup regression also resolved a source-mismatched suggestion instead of
  rejecting it through the public `findRecordedDecision` path.
- The pre-existing valid-reuse test passed in RED, confirming the new negative cases isolated the
  missing validation rather than breaking the intended idempotent behavior.

### What changed

- The Project-link service reconstructs the exact four-field structured output from the validated
  Router result, validates that shape with `ContextProjectMatchAiOutputSchema`, serializes it in one
  explicit deterministic field order, and passes only that canonical JSON to the protector.
- Parsing the captured sealer input now recovers an object deeply equal to `matchRun.output`,
  including `interpretationLabel`, `explanation`, `sourceReferences`, and `uncertainties`.
- The persistence port remains ciphertext plus key version. Its separately governed record still
  excludes plaintext explanation content and retains only the approved lineage, decision, anchors,
  and opaque provenance fields.
- A shared initial-suggestion gate now validates every idempotent/recovery lookup with the Task 1
  schema and the stable operation binding before reuse. It requires exact ID, employee, source item,
  revision `1`, analysis ID, schema/prompt versions, initial review/origin state, deterministic
  decision/Project/anchors, governed sources, and route lineage.
- The append-return path uses the same gate. The direct response-loss lookup requires sources to
  remain within the current governed set and requires every deterministic anchor reference.
- Any malformed or mismatched reused value fails with the single sanitized message
  `Persisted Project link suggestion does not match the stable operation`; schema details or row
  contents are not exposed.
- `ContextAnalysisService` now computes the bounded Project-match provenance before the retry lookup
  and supplies the exact expected analysis, source, route, version, decision, and authorized source
  context to that gate. No additional Router call or provider path was introduced.

### Files changed

- `packages/context-intelligence/src/project-link-suggestion-service.ts`
- `packages/context-intelligence/src/project-link-suggestion-service.test.ts`
- `packages/context-intelligence/src/analysis-service.ts`
- `packages/context-intelligence/src/analysis-service.integration.test.ts`

### Database changes

None. No schema, migration, index, constraint, seed, or persistence-provider implementation changed.

### GREEN verification

All commands used the repository-pinned Node.js `24.18.0` and pnpm `11.13.0`.

| Check                                            | Result                   |
| ------------------------------------------------ | ------------------------ |
| Exact RED pair after implementation              | 2 files, 20 tests passed |
| Full Context Intelligence package tests          | 7 files, 54 tests passed |
| Context Intelligence Router-backed AI evaluation | 1 file, 16 tests passed  |
| Context Intelligence package typecheck           | passed                   |
| Context Intelligence package lint                | passed                   |
| Affected-file ESLint                             | passed                   |
| AI boundary scan                                 | 580 source files valid   |
| Affected-file Prettier check                     | passed                   |
| `git diff --check`                               | passed                   |

### Security and privacy impact

- The sealed payload is now recoverable as the exact validated structured Project-match output;
  citations and uncertainty are no longer flattened into display prose.
- Plaintext protected model output remains absent from the persistence record and port contract.
- Retry recovery now fails closed if persistence returns a malformed, cross-employee, cross-source,
  wrong-revision, wrong-analysis, wrong-route, wrong-decision, wrong-Project, wrong-anchor, or
  out-of-scope provenance value.
- Failure is sanitized and does not disclose the rejected row or Task 1 schema diagnostics.
- No provider SDK, endpoint, credential, new AI route, permission change, or live-model call was
  added. The AI boundary scan remained green.

### Remaining risk and concerns

No new P1 concern remains within this fix-round scope. The previously documented P2 post-`AiRun`
atomicity gap remains unchanged: a succeeded immutable AI run can exist if later semantic checking,
encryption, or feature append fails. The deeper semantic-entailment P2 also remains outside this
bounded round.

### Project-state update

None. Fix Round 2 repairs protected recovery and retry validation without changing product rules,
architecture direction, active decisions, current goal, or the recommended next Slice action.
