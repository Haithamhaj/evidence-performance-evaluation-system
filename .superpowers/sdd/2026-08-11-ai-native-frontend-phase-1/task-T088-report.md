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
- Existing domain command success is not coupled to this new transport. T088's deterministic demo uses
  the internal Operations runtime with an already-authorized private Inbox receipt; production domain
  publication remains disabled until an atomic domain outbox/public receipt boundary is available.

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

Production domain publication is intentionally not wired in T088. Wiring a post-commit callback would
make an existing successful command appear failed and invite duplicate business mutation. The later
integration must use an atomic owning-domain outbox/public receipt boundary. This is an explicit safe
boundary, not an incomplete hidden hook.

No project-state update was made: the current goal and architecture direction are unchanged, and the
parent controller will record task completion after review and browser evidence.
