# SDD ledger — plan: docs/superpowers/plans/2026-08-11-ai-native-frontend-master-plan.md

## Phase 3

- P3-11: complete at `b743064`.
- P3-12: complete at `8570a5f` plus the committed browser-evidence checkpoint. The real local Codex
  contributor journey shows the scoped ownership projection without exposing manager transfer
  authority; ended access and manager/acting-owner paths remain covered by focused server and UI
  tests.
- P3-13: complete. No current action satisfies the full compensation and durable-recovery gate, so
  Auto + Undo remains intentionally disabled and no generic runtime was created.
- P3-14: technically complete. Accepted contract data renders a circular measure, milestone/KPI
  context, source, and accessible table. An active contract without an approved measurement now
  renders its exact waiting state without a percentage or chart. The live browser comparison is
  deferred because the current sandbox cannot access the local container runtime.
- P3-15: technically complete. CAP-006–CAP-012 and H-010–H-014 reconcile to the Project workspace,
  retained protected action routes, role projections, meaningful timeline, and focused tests. The
  closure matrix is recorded in `task-P3-15-report.md`.

## Phase 4

- P4-01: technically complete. The unified `Share anything` dialog now submits text, URL, code,
  image, and file sources through one protected, Project-scoped Update preparation path.
- P4-02: technically complete. The existing governed record/upload/transcribe/edit/retry/cancel
  lifecycle now runs inside the unified dialog, and only an employee-confirmed transcript becomes an
  Update source.
- P4-03: technically complete. Capture loads the employee-authorized Project list, selects a single
  Project automatically, and asks one Project question only when more than one is available.
- P4-04: technically complete. Review exposes user-facing source lineage, private-draft visibility,
  freshness, and provider/direct-source status without internal IDs.
- P4-05: technically complete. Evidence preparation preserves URL, uploaded file/image, pasted code,
  written text, or employee-confirmed voice transcript provenance and defaults unselected.
- P4-06: technically complete. The employee edits/revises, confirms, or explicitly dismisses an
  Evidence suggestion; independent command outcomes preserve truthful partial recovery.
- P4-07: technically complete. The owner-scoped Project Evidence workspace groups confirmed, pending,
  attribution issues, verification gaps, and append-only history without exposing raw source bodies.
- P4-08: technically complete. Source-backed deterministic detection covers completed work without an
  Update, source without a Work Item relation, and current Evidence gaps.
- P4-09: technically complete. Each detection prepares one editable Update, Evidence candidate, or
  relationship suggestion; all remain review-only and require employee confirmation.
- P4-10: technically complete by verified reuse. Raw Capture input and voice sessions survive
  AI/transcription failure with explicit retry and Save privately.
- P4-11: technically complete by verified reuse. Private uploads and connected sources remain
  owner-scoped; disconnected or revoked context fails closed.
- P4-12: technically complete by verified reuse. Only accepted Update and Evidence events feed the
  Evaluation Fact View source reader.
- P4-13: technically complete. Project Assistant prompt v2 explains authorized Evidence sources,
  discusses missing Evidence, and helps revise a pending draft without creating a command.
- P4-14: technically complete. Gate G4 is satisfied by focused tests and affected type/lint/build
  checks; production connector/storage gates and live visual acceptance remain external.

## Phase 5

- P5-01–P5-03: technically complete. An employee can frame a Project-linked Research question with
  relevance, assumptions, constraints, and uncertainty; review a cited source with licensing/privacy
  boundaries; and inspect an assistant-prepared synthesis that keeps claims, contradictions,
  confidence boundaries, and unanswered questions separate.
- P5-04–P5-05: technically complete. Experiment drafts preserve the hypothesis, baseline, measures,
  cases, controls, pinned versions, and reproducibility method. Completed, failed, invalid, and
  stopped results remain visible; failure is retained rather than erased.
- P5-06–P5-07: technically complete. The employee reviews and explicitly confirms the decision and
  its source, then the existing Research domain records the human decision and linked Applied
  Learning. An interrupted Applied Learning write can resume without repeating the confirmed
  decision.
- P5-08–P5-10: technically complete in the bounded form. The Research assistant uses only the
  authorized source review, Research questions, retained results, and decisions to explain the next
  logical step, unknowns, experiment candidate, or decision draft. It prepares and explains; it
  cannot run, confirm, publish, create official work, or change Project progress.
- P5-11–P5-12: technically complete. The page shows a meaningful Question → Source → Result →
  Decision → Applied Learning trail and a closure check, not raw source or experiment volume. Gate G5
  passes focused product, API, and real PostgreSQL lifecycle verification; live authenticated visual
  acceptance remains the normal product checkpoint.
