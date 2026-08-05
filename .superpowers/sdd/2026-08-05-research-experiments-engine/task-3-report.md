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
