# E3 Task 3 Report — Authorized Project Context Readers

## Status

Complete. Public owner-domain readers now expose authorized, source-pinned Project context to Research without Research services reading owner-module tables directly.

## What changed

- Projects now exports `ResearchScopeAuthorizer` and `ResearchProjectContextReader`.
  - Authorizes current Project owners, Project contributors, Workstream contributors, and assigned department managers at an exact UTC instant.
  - Denies unrelated managers, System Administrators without an authorized operational role, inactive users, invalid scopes, and cross-Project Work Items.
  - Returns safe Project/Workstream references, current responsibility windows, the active Progress Contract and governed GitHub rules, and only the requesting owner's ready prospective Progress Contract proposals.
  - Workstream-only readers see only their authorized Workstreams.
- Work Items now exports `ResearchWorkItemReader`, `ConfirmedTaskCreator`, and `ConfirmedTaskCreatorAdapter`.
  - Returns non-cancelled current Work Items within the actor's authorized Project or Workstream scope.
  - Preserves the caller-owned database transaction when a human-confirmed Research task is delegated to the existing Work Item command.
- Documents now exports `ResearchDocumentSourceReader` for the exact approved immutable version and its safe extracted untrusted text/reference.
- Updates & Evidence now exports `ConfirmedResearchEvidenceReader` and returns confirmed shared evidence only, without private contribution narrative.
- Connected Work Context now exports `ResearchSourceIntakeReader`, which reuses owner authorization and decrypts URL/title/summary only for the requesting employee.
- Criteria now exports `ResearchCriterionProposalReader` for approved prospective proposal identity only, without contributor responses or evaluation content.
- Research Experiments now exports deterministic `composeProjectContextSnapshot()` and `ResearchProjectContextSnapshot`.
  - Every collection is normalized and sorted.
  - Duplicate Workstream or Work Item identities and cross-Project items are rejected.
  - SHA-256 excludes `generatedAt` and changes with cited content or pinned version identity.
- Added the package-local Node type declaration dependency required for `node:crypto` hashing.

## Files changed

- `packages/projects/src/research-project-context-reader.ts`
- `packages/projects/src/research-project-context-reader.integration.test.ts`
- `packages/projects/src/index.ts`
- `packages/work-items/src/research-work-item-reader.ts`
- `packages/work-items/src/research-work-item-reader.integration.test.ts`
- `packages/work-items/src/index.ts`
- `packages/documents/src/research-document-source-reader.ts`
- `packages/documents/src/research-document-source-reader.integration.test.ts`
- `packages/documents/src/index.ts`
- `packages/updates-evidence/src/research-support-reader.ts`
- `packages/updates-evidence/src/research-support-reader.integration.test.ts`
- `packages/updates-evidence/src/index.ts`
- `packages/connected-work-context/src/research-source-intake-reader.ts`
- `packages/connected-work-context/src/research-source-intake-reader.integration.test.ts`
- `packages/connected-work-context/src/index.ts`
- `packages/criteria/src/research-criterion-proposal-reader.ts`
- `packages/criteria/src/research-criterion-proposal-reader.integration.test.ts`
- `packages/criteria/src/index.ts`
- `packages/research-experiments/src/project-context.ts`
- `packages/research-experiments/src/project-context.test.ts`
- `packages/research-experiments/src/index.ts`
- `packages/research-experiments/package.json`
- `packages/research-experiments/tsconfig.json`
- `pnpm-lock.yaml`
- `.superpowers/sdd/2026-08-05-research-experiments-engine/task-3-report.md`

## Database changes

None. No schema or migration changed.

## TDD evidence

- Initial RED: all seven focused test files failed because the new modules did not exist.
- Behavioral RED after minimal throwing stubs: 11 non-database assertions failed on the intentionally unimplemented behavior. Database-backed suites initially lacked the test environment and were not counted as behavioral RED evidence.
- Review-fix RED: four tests failed for Workstream-only context/item access, exact Progress Contract rule fields, and duplicate snapshot identities.
- Final focused GREEN: 7 test files passed, 33 tests passed.

## Verification

Executed with Node `v24.18.0` from `/opt/homebrew/opt/node@24/bin`:

- Focused owner-reader and snapshot tests: 7 files passed, 33 tests passed.
- Typecheck and lint for each touched package (`projects`, `work-items`, `documents`, `updates-evidence`, `connected-work-context`, `criteria`, `research-experiments`): passed.
- Root `pnpm typecheck`: 25/25 package tasks passed.
- Root `pnpm lint`: passed, including boundary and user-visible-copy checks.
- `pnpm scan:ai-boundary`: passed; 738 source files validated.
- `pnpm scan:performance-inputs`: passed; 603 files inspected.
- `pnpm scan:secrets`: passed; 1,172 files checked.
- `pnpm install --frozen-lockfile`: passed.
- Prettier check for all touched source/config files: passed.
- `git diff --check`: passed.
- Independent review: the three Important findings were corrected; re-review found no remaining Critical or Important issue.

## Security and privacy impact

- Authorization is enforced server-side against current persisted user/scope state; actor claims alone do not grant access.
- The System Administrator label does not grant Research content access.
- Cross-Project Work Items are rejected.
- Private connected-source intake remains employee-owner-only and is decrypted only after owner authorization.
- Evidence must be confirmed and shared before the Research reader returns it.
- Outputs omit ratings, Documentation Readiness values, private narrative, ranking, and productivity scoring.
- No networking, AI invocation, lifecycle persistence, API, or UI behavior was added.

## Remaining risk

Low. These are internal public module boundaries; orchestration and lifecycle wiring remain for later E3 tasks. Exact access behavior is covered by positive and negative authorization tests, including Workstream-only filtering.

## Project-state update

Not updated. This task implements the already-approved E3 architecture and does not change the current goal, protected decisions, active risks, or recommended next action.

---

## Fix Round 1 — External Review Findings

### Status

Complete. All six Critical/Important review findings were resolved without migrations or changes to protected product rules.

### Changes

- Replaced generic retained-role authorization in `ResearchWorkItemReader` with current persisted Project membership/responsibility, explicit current owner responsibility, assigned department manager, or exact current Workstream membership/responsibility.
- Revalidated persisted `User.active` before returning confirmed Research Evidence.
- Updated the Evidence scope owner boundary to authorize current Project access or the exact current Workstream, while keeping Project-wide Evidence unavailable to Workstream-only contributors.
- Added Project and Workstream version/content identities using deterministic SHA-256 while retaining the safe opaque `kind:UUID` reference and adding `kind-version:SHA256` references.
- Added the same versioned content identity to Work Item references.
- Made current Project contributors Project-wide readers of active/paused Workstreams; Workstream-only readers remain filtered to exact authorized Workstreams.
- Changed the Documents owner boundary to locate and load the exact requested approved immutable `DocumentVersion`, including historical approved versions after the document advances.
- Strengthened snapshot composition into a Project-bound authorized envelope:
  - every Workstream binds to the snapshot Project;
  - every scoped Work Item binds to an included authorized Workstream;
  - Project, Workstream, and Work Item ID/version/content references are recomputed and verified;
  - foreign or unknown context identity references are rejected rather than normalized.

### Files changed

- `packages/work-items/src/research-work-item-reader.ts`
- `packages/work-items/src/research-work-item-reader.integration.test.ts`
- `packages/updates-evidence/src/research-support-reader.ts`
- `packages/updates-evidence/src/research-support-reader.integration.test.ts`
- `packages/updates-evidence/src/scope-readers.ts`
- `packages/projects/src/research-project-context-reader.ts`
- `packages/projects/src/research-project-context-reader.integration.test.ts`
- `packages/documents/src/research-document-source-reader.ts`
- `packages/documents/src/research-document-source-reader.integration.test.ts`
- `packages/documents/src/progress-contract-draft-source-reader.ts`
- `packages/documents/src/progress-contract-draft-source-reader.integration.test.ts`
- `packages/research-experiments/src/project-context.ts`
- `packages/research-experiments/src/project-context.test.ts`
- `.superpowers/sdd/2026-08-05-research-experiments-engine/task-3-report.md`

### Database changes

None. The Document regression uses real persisted owner-domain records but adds no schema or migration.

### TDD RED evidence

- The first Fix Round 1 behavior run produced 11 expected failures across snapshot binding, Project contributor visibility/content identity, stale Work Item contributor access/content identity, persisted-inactive Evidence, Workstream-only Evidence, and historical Document access. The real Document fixture initially hit a test-only state constraint and was corrected before being counted as behavioral evidence.
- With the real persisted Document fixture valid, both approved-version reads failed with `RESEARCH_DOCUMENT_SOURCE_INVALID` because the locator selected only the latest version instead of the exact requested version.
- The existing owner-domain draft-source reader regression independently failed historical-version access with `PROGRESS_CONTRACT_DRAFT_SOURCE_INVALID`.

### GREEN and verification evidence

Executed with Node `v24.18.0` from `/opt/homebrew/opt/node@24/bin`:

- Seven required focused Task 3 suites: 7 files passed, 40 tests passed.
- Historical approved Document owner-boundary suite: 1 file passed, 5 tests passed.
- Combined focused verification: 8 files passed, 45 tests passed.
- Touched-package typecheck and lint (`projects`, `work-items`, `documents`, `updates-evidence`, `research-experiments`): passed.
- Root `pnpm typecheck`: 25/25 package tasks passed.
- Root `pnpm lint`: 25/25 package tasks passed; boundary and user-visible-copy checks passed.
- `pnpm scan:ai-boundary`: passed; 738 source files validated.
- `pnpm scan:performance-inputs`: passed; 603 files inspected.
- `pnpm scan:secrets`: passed; 1,173 files checked.
- `pnpm install --frozen-lockfile`: passed.
- Prettier check for all touched files: passed.
- `git diff --check`: passed.

### Security and privacy impact

- Ended contributors no longer retain Research Work Item access through stale role assignments.
- Actor activity claims are insufficient for Evidence access; persisted user state is authoritative.
- Workstream-only Evidence access is exact-scope and does not broaden to Project-wide Evidence.
- Snapshot composition rejects cross-Project Workstreams, absent/unauthorized Workstream links, foreign Project references, and mismatched identity hashes.
- Historical Document retrieval remains authorization-checked and requires an approved lifecycle state for the exact immutable version.
- No ratings, Documentation Readiness values, ranking, productivity scoring, or private narrative were added.

### Self-review

- Confirmed every review finding has a mutation-sensitive regression: removing current-time checks, persisted-active checks, Workstream filtering, content-hash recomputation, historical-version selection, or Project binding makes at least one focused test fail.
- Confirmed the Research package still composes only public owner-domain values and does not read owner-module persistence directly.
- Confirmed safe references continue to use the approved UUID or 64-character hexadecimal payload grammar.
- Confirmed the diff adds no API, networking, AI, lifecycle service, UI, migration, or unrelated refactor.

### Remaining risk and project state

Remaining risk is low and limited to later orchestration wiring. Project state was not updated because the approved architecture, protected decisions, and recommended next action did not change.

---

## Fix Round 2 — Historical Approval and Reference-Case Guard

### Status

Complete. The two external review findings were resolved without migrations or changes to protected product rules.

### Changes

- Historical `DocumentVersion` reads now accept a final persisted `stale: true` readiness record whose lifecycle proves that exact version previously reached `criteria_approved`, even when its latest transition is `superseded`.
- Current-version reads remain strict: the readiness record must not be stale and its latest lifecycle transition must be `criteria_approved`.
- Exact versions that never reached `criteria_approved`, future versions, and mismatched Project or Workstream sources remain rejected.
- Context identity detection is now case-insensitive for all six guarded kinds (`project`, `project-version`, `workstream`, `workstream-version`, `work-item`, and `work-item-version`), so uppercase or mixed-case aliases cannot bypass the canonical-reference authorization envelope.

### Files changed

- `packages/documents/src/progress-contract-draft-source-reader.ts`
- `packages/documents/src/research-document-source-reader.integration.test.ts`
- `packages/research-experiments/src/project-context.ts`
- `packages/research-experiments/src/project-context.test.ts`
- `.superpowers/sdd/2026-08-05-research-experiments-engine/task-3-report.md`

### Database changes

None. The Document regression uses real persisted readiness and lifecycle records but adds no schema or migration.

### TDD RED evidence

- With a valid persisted final-state fixture, one of three Document source-reader tests failed with `RESEARCH_DOCUMENT_SOURCE_INVALID`: the historical version had previously reached approval but was now stale and superseded. An initial attempt to mutate readiness after creation correctly hit the immutable-history database trigger, so the fixture was corrected before this behavioral RED was counted.
- Six parameterized context-composition cases failed because uppercase or mixed-case identity kinds bypassed the case-sensitive guard: Project, Project version, Workstream, Workstream version, Work Item, and Work Item version. The Project case used a foreign UUID.
- Total expected behavioral RED: seven failures.

### GREEN and verification evidence

Executed with Node `v24.18.0` from `/opt/homebrew/opt/node@24/bin`:

- Affected suites first: 2 files passed, 16 tests passed.
- All eight related Task 3 suites: 8 files passed, 51 tests passed.
- Touched-package typecheck and lint (`documents`, `research-experiments`): passed.
- Root `pnpm typecheck`: 25/25 package tasks passed.
- Root `pnpm lint`: 25/25 package tasks passed; boundary and user-visible-copy checks passed.
- `pnpm scan:ai-boundary`: passed; 738 source files validated.
- `pnpm scan:performance-inputs`: passed; 603 files inspected.
- `pnpm scan:secrets`: passed; 1,173 files checked.
- `pnpm install --frozen-lockfile`: passed.
- Prettier check for all touched files: passed.
- `git diff --check`: passed.

### Security and privacy impact

- Historical access remains authorization-checked and requires persisted proof that the exact immutable version previously reached approval.
- Current and never-approved versions fail closed under the existing approval rules.
- Noncanonical casing can no longer disguise context identity references from the authorization guard; foreign or unauthorized identities remain rejected.
- No API, networking, AI, lifecycle service, UI, migration, rating, readiness exposure, ranking, productivity scoring, or private narrative behavior was added.

### Self-review

- Confirmed the historical exception is limited to versions lower than the document's current version and cannot relax current-version approval semantics.
- Confirmed the approval-history relation is applied to the exact requested version in both locator and loader paths.
- Confirmed each of the six identity-reference kinds has a mutation-sensitive mixed-case regression, including a foreign Project identity.
- Confirmed the source-reference grammar remains unchanged; only guarded identity-kind detection became case-insensitive.
- Confirmed the diff contains no scope expansion or unrelated refactor.

### Remaining risk and project state

Remaining risk is low and limited to later orchestration wiring. Project state was not updated because the approved architecture, protected decisions, and recommended next action did not change.
