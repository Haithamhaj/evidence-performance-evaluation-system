# Notifications, Reporting & Administration Engine — Technical Acceptance

## Outcome

E6B now provides one bounded operations layer for actionable notifications, reproducible private exports, and safe System Administrator health/configuration composition. Source domains remain authoritative: Notifications stores delivery intent, Reporting pins source snapshots and creates artifacts, and Administration delegates mutations to the owning domain instead of copying configuration.

This is an engine checkpoint and a bilingual technical verification surface. It is not the final employee-facing frontend.

## Verified journeys

### Actionable notifications

- Versioned `CHECK_IN_DUE`, `REASSIGNMENT_REQUIRED`, `EXPORT_READY`, and `SYSTEM_HEALTH_ACTION_REQUIRED` events map to minimal notification intents.
- Recipient/category/dedupe identity prevents duplicate intents.
- A BullMQ job carries only the intent ID and correlation ID; it carries no rating, score, readiness value, private source content, or provider credential.
- The in-app action becomes available before email delivery.
- Transient email failure retains the in-app action and creates a bounded retry state.
- Permanent or unavailable-provider failure retains the in-app recovery path.
- Opening an intent verifies the current recipient and reauthorizes the target before marking it read.
- Security and reassignment email requirements cannot be muted by optional preference settings.

### Reproducible protected exports

- The API pins the exact source snapshot before placing a request-only job on the reporting queue.
- The reporting worker renders from the pinned source and stores a deterministic HTML or PDF artifact through private encrypted object storage.
- The approved registry includes employee evaluation, department evaluation, and identified upward-manager projections with exact audience pairs. Unsupported type/audience combinations fail closed.
- English evaluation exports are available. Arabic evaluation exports remain blocked by the protected T016 semantic-approval gate. Bilingual non-evaluation rendering and bidi-safe technical text remain supported.
- Failed generation stores only the bounded `GENERATION` category; raw provider/storage errors are not persisted or returned by the worker contract.
- Every artifact open checks current ownership, expiry, and revocation, then records an access event before issuing a 60-second signed descriptor.
- Revocation and expiry preserve the immutable manifest and source pins.

### Safe administration and health

- Only an active system-scoped System Administrator reaches the administration routes.
- The representative `AI_ROUTES_MANAGE` command delegates to the existing AI Routing owner, validates the expected version in the owner's serializable transaction, and records the owner audit before returning an operations receipt.
- The command idempotency key is also the owner-audit correlation, so a retry cannot create a second route version after an interrupted receipt write.
- Manager evaluation, Project reassignment, active-cycle visibility changes, and unapproved Arabic rubric activation are not administration capabilities.
- Health composes API, worker, database, queue, object storage, OIDC, AI route, connector, email, and backup state into a bounded next action. It excludes URLs, credentials, tokens, raw logs, prompts, connected content, and evaluation comments.
- Capability IDs without a real owner adapter remain explicitly unavailable; Administration never becomes a second configuration database.

## Runnable acceptance checkpoint

1. Start the standard local infrastructure.
2. Apply the forward-only migrations through `0035_operations_delivery_reporting`.
3. Run `pnpm operations:seed`. The command is safe to rerun.
4. Open `/{locale}/notifications` for the notification/export checkpoint and `/{locale}/admin/operations` as the System Administrator for the safe health checkpoint.

The real PostgreSQL seed creates a closed E4 employee evaluation, one deduplicated Thursday check-in intent, one transient email retry, one critical reassignment intent, one encrypted English PDF export, one artifact revocation, and one degraded connector with a safe next action. Two consecutive runs return the same intent, request, manifest, and artifact IDs without duplicating protected history.

## Verification evidence

- Migration `0035` verifies clean install, upgrade from `0034`, schema rebuild, indexes, foreign keys, append-only attempt/access/revocation controls, and no drift.
- Contract/unit tests cover strict event/job payloads, forbidden scoring/signed-URL fields, approved audience registry, queue validation/discard behavior, renderers, health redaction, role separation, and admin capability denial.
- PostgreSQL integration tests cover intent dedupe, preference policy, retry/permanent failure, source-event production, report pinning/reproducibility/failure state, cross-employee denial, expiry/revocation, access audit, real AI-route owner delegation, optimistic conflict, and rerunnable acceptance data.
- Real Redis integration moves request-only jobs through both reporting and notification BullMQ runtimes.
- The focused Playwright checkpoint covers English/Arabic routes, RTL/LTR direction, 390 px layout, and the no-scoring boundary.
- Protected scans verify the AI Router boundary, provider-key hygiene, performance-input exclusions, and secret scanning.

## External gates and bounded limitations

- `EXTERNAL_GATE`: production email provider selection, credential vaulting, sender/domain verification, and provider-console approval. No credential is required or read by this checkpoint. Without a configured provider, in-app delivery remains authoritative and email records a bounded failure.
- Production object-storage, Redis, OIDC, telemetry destination, and backup configuration remain deployment configuration. Their absence is shown as `ACTION_REQUIRED`; it is not hidden as healthy.
- Full final product interaction design remains the post-engine frontend program.
- Arabic employee evaluation export remains blocked until the protected T016 semantic review and approval.

## Protected-rule result

No AI rating or recommendation, employee ranking, productivity score, activity-volume metric, Project-count weighting, or manager-facing individual readiness value was added. Final employee rating remains a human manager decision, and identified upward feedback remains truthful to the frozen pilot mode.
