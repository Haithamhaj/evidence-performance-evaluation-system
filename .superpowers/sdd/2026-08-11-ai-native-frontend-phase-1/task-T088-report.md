# T088 implementation report

## Outcome

T088 adds a bounded, owner-filtered Work Signal delivery runtime and a separate Experience Workflow
Event receipt store. The `P1-WHAT-CHANGED` projection returns delivered or acknowledged receipts only;
queued receipts and unrelated users receive no projection items.

Work Signals, Experience Workflow Events, and Product Telemetry remain separate closed schemas and
import zones. Product telemetry collection remains disabled and cannot import either protected event
contract zone. No browser business command, AI decision, generic activity platform, score, rank,
readiness percentage, or progress calculation was added.

## Runtime and recovery

- Authorized signals persist in PostgreSQL before a content-free BullMQ wake-up is attempted.
- The receipt ID is the queue job ID, so retries are idempotent.
- A queued or failed receipt is safely re-enqueued on an identical retry.
- Concurrent inserts recover by reading the winning receipt and comparing the payload hash.
- The worker transitions queued/error receipts once and treats delivered/acknowledged replay as a no-op.
- Private Inbox capture writes its owner-scoped signal receipt atomically inside the owning Work Items
  transaction. The post-commit queue wake-up cannot turn a successful capture into an HTTP failure;
  queued/error receipts are recovered when the owner opens What Changed.

## Database changes

Migration `0040_experience_event_runtime` adds:

- `ExperienceDeliveryState` (`queued`, `delivered`, `acknowledged`, `error`);
- `WorkSignalReceipt`, including idempotency, recipient, delivery cursor/state, acknowledgement, and
  replay fields;
- `ExperienceWorkflowEventReceipt`, a separate idempotent owner-scoped decision receipt;
- closed-taxonomy checks, indexes, and restrictive user foreign keys.

Migration verification passed from an empty database and the previous snapshot, with no drift and
rebuild equivalence.

## Deterministic demo evidence

The focused PostgreSQL integration test creates one private Inbox item, sends one already-authorized
`user.capture_submitted` signal, completes its delivery transition, and proves:

- the owner sees exactly one `P1-WHAT-CHANGED` item;
- an unrelated active user sees zero items.

The parent controller owns the in-app browser screenshots required by the plan.

## Verification

- Focused unit and repository boundary tests: **12 files, 31 tests passed**.
- Focused PostgreSQL integration: **2 files, 2 tests passed**.
- API, worker, contracts, and database typechecks: **passed**.
- API, worker, and contracts scoped lint: **passed**.
- Migration verification: **passed** (empty, previous snapshot, drift, rebuild equivalence).
- Event taxonomy validator: **passed** (`14` Work Signals, `6` Experience Workflow Events,
  `7` telemetry-eligible keys; collection disabled).
- Frontend/import boundary validator: **passed** (`1125` files).
- Secret scan: **passed** (`1724` files).

## Security and privacy impact

- Recipient authorization runs before signal persistence.
- Projection and acknowledgement are filtered by the authenticated actor ID on the server.
- Private Inbox ownership and current Work Item participation/assignment/creation are the only T088
  recipient policies connected; other entity types fail closed until their owning public authorizer is
  integrated.
- Queue jobs contain receipt and correlation IDs only, never domain content.
- No telemetry feeds orchestration, progress, evidence, evaluation, manager decisions, or commands.

## Remaining bounded risk

T088 connects only the approved private-capture signal. Other domain signal types remain fail-closed
until their owning modules expose equivalent atomic public receipt boundaries. Product telemetry
collection remains disabled. The parent controller recorded task completion after review and browser
evidence.

## Bounded remediation cycle

Confirmed P1 findings were corrected in one bounded cycle:

- Private capture now appends its Work Signal receipt inside the owning Work Items serializable
  transaction. Queue wake-up runs after commit and cannot turn a successful capture into an HTTP
  failure. Opening What Changed retries only the requesting owner's queued/error receipts.
- Operations now consumes the narrow Work Items-owned recipient authorizer public port; it no longer
  reads Private Inbox, Work Item, or participant tables directly.
- Worker delivery failures persist only the safe `delivery_failed` code, retry through BullMQ, and
  revive failed/completed stable-ID jobs without duplicate delivery effects.
- Acknowledgement now accepts delivered receipts only and is idempotent once acknowledged.
- The product shell now opens the real owner-filtered What Changed projection through the same-origin
  gateway, with localized loading, empty, recovery, and private-capture states.
- The event-taxonomy status is `phase_1_runtime_active`; telemetry collection remains disabled.
- The seven formatting failures reported by GitHub Actions run `31582477225` were corrected exactly.

Remediation verification:

- Focused unit/API/worker/web/repository: **11 files, 66 tests passed**.
- Focused PostgreSQL capture and owner-projection integration: **2 files, 4 tests passed**.
- Work Items, API, and worker typechecks: **passed**.
- Work Items, API, worker, and web lint: **passed**.
- Seven CI-reported files: **Prettier check passed**.
- Web typecheck retains the unchanged repository Vitest browser/jest-dom matcher declaration
  collision; no new application-source type error was identified in the bounded checks.

## Authenticated product acceptance — 2026-08-12

The production Phase 1 shell was exercised in Arabic using the documented synthetic employee account
and the real local OIDC, API, PostgreSQL, Redis, worker, and web application. The employee captured and
confirmed a new private note. The same transaction created one owner-scoped Work Signal receipt; the
dedicated experience worker moved it to `delivered`; What Changed then displayed exactly one localized
operational item. The item contains no captured body, rating, progress, readiness value, or telemetry.

For recovery evidence, the API was temporarily stopped while the web shell remained available. What
Changed preserved the last delivered item and displayed a localized retryable warning. After the API
returned, reopening the dialog cleared the warning and showed the same single item without duplication.

Screenshots:

- `docs/product/screenshots/ai-native-phase-1/t088-authorized-refresh.png`
- `docs/product/screenshots/ai-native-phase-1/t088-recovery-state.png`

Final authenticated acceptance: **passed**.
