# E5B Coaching & Development Bundle Report

## Delivered behavior

- Coaching facts are qualified before AI use. Activity volume, approved leave, and isolated negative incidents are excluded; one qualifying source is forced to `LIMITED` and employee review.
- The governed `coaching.insight` request carries the exact trusted prompt-artifact descriptor separately from delimited untrusted facts. Runtime output is schema-validated and then semantically rejected for ratings, ranks, scores, promotion, discipline, leave penalties, evidence quotas, and related unsafe conclusions.
- An audited registrar can persist the exact prompt v2 and portable output schema v2 artifacts and bind the route to approved provider configuration. Runtime drafting rereads and hashes the exact prompt artifact before calling the AI Router.
- Employee insight reads include the current revision, ordered sources, and private decisions. Managers receive only an explicit shared-action allowlist and participants receive an explicit formal-plan projection.
- Manager access requires an active user, an eligible current evaluation assignment, and the current cycle time window. Historical assignment existence does not grant access.
- Formal plans support revise-with-agreement-invalidation, withdraw-with-reason, completion only after non-empty confirmed Evidence Records, and close. Decision, action, and plan retries resolve by idempotency key before mutable-state checks.
- Forward migration `0032_coaching_development_integrity` adds append-only database triggers, current-revision ownership, source/AI-run/evidence references, and per-root resulting-version uniqueness. Persistence uses compare-and-swap writes; manager support is serialized and reauthorized inside its transaction.
- Decision, privacy, support, agreement, completion, and protected-read audits contain safe metadata without private reasons, notes, or support content.
- Cross-employee insight/action/evaluation/evidence references are rejected. The deterministic seed now creates real confirmed employee evidence and reruns without updating append-only history.

## Verification evidence

- `pnpm db:verify`: passed empty database, upgrade from the 31-migration snapshot, schema drift, and rebuild equivalence across 32 migrations; its database suite passed 77 tests.
- Focused coaching/contracts/AI tests: 27 passed across 7 files, including the real prompt-aware adapter through the AI Router and prohibited-semantic cases.
- Focused PostgreSQL/Nest integration: 9 passed across 3 files, covering history mutation/deletion, orphan references, current pointers, duplicate versions, concurrent compare-and-swap, current manager authorization, actor-safe projections, audit safety, idempotent retries, formal-plan lifecycle, confirmed evidence, and seed rerun.
- Coaching, database, and API type checks: passed.
- Coaching, database, API, and affected script/integration lint: passed.
- AI boundary scan: 927 source files valid.
- Performance-input scan: 748 files valid.
- Secret scan: 1,367 files valid.
- Exact route-registration dry run: passed for prompt `coaching-insight.v2` and output schema `coaching-insight-output.v2`.

## Security and privacy impact

No rating, score, rank, prediction, productivity judgment, promotion, discipline, leave penalty, evidence quota, employee ranking, or automatic evaluation mutation was introduced. Private decisions, reasons, notes, and private action content remain outside manager projections. Formal-plan completion requires real employee-owned confirmed evidence and does not alter evaluation history.

## Remaining risk

- The route registrar was verified in dry-run mode only. Production registration still requires an authorized actor, audit reason, system scope, approved provider configuration, and credentials.
- This environment provided Node.js 22 while the repository declares Node.js 24.18.0. All listed checks passed, but the supported Node 24 hosted run remains the authoritative toolchain confirmation.
- Production OIDC/session configuration and the later everyday product UI remain deployment and UX follow-ons. This checkpoint is technical verification, not final product acceptance.
