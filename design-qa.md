# Command Brief Foundation and Stable Shell — Design QA

## Review target

- Source of truth: `/Users/haitham/.codex/generated_images/019f659b-889b-7873-9927-4ae4802ea123/exec-3fae8387-569b-7873-9927-4ae4802ea123.png`
- Implementation: `apps/web/src/product-ui/foundation/foundation.stories.tsx`
- Stable shell implementation: `apps/web/src/product-ui/shell/stable-shell.tsx`
- Styles: `apps/web/src/product-ui/foundation/foundation.module.css`
- Review viewport: foundation desktop `1050 × 700` at `1x`; stable shell desktop
  `1536 × 1024` at `1x`; mobile `390 × 844` at `1x`
- Reviewed states: English ready, Arabic RTL ready, mobile ready, loading, empty, error/recovery, focused dialog

## Evidence

- Full desktop: `docs/product/screenshots/ai-native-phase-0b/foundation-command-brief-desktop.jpg`
- Focused mobile: `docs/product/screenshots/ai-native-phase-0b/foundation-command-brief-mobile.jpg`
- Focused Arabic RTL: `docs/product/screenshots/ai-native-phase-0b/foundation-command-brief-arabic.jpg`
- Side-by-side source comparison: `docs/product/screenshots/ai-native-phase-0b/foundation-command-brief-comparison.jpg`
- Stable shell desktop: `docs/product/screenshots/ai-native-phase-0b/stable-shell-story-en-desktop.png`
- Stable shell Arabic manager/mobile: `docs/product/screenshots/ai-native-phase-0b/stable-shell-story-ar-manager-mobile.png`
- Equal-size stable-shell comparison: `docs/product/screenshots/ai-native-phase-0b/stable-shell-command-brief-comparison.png`
- Source and stable-shell desktop captures are both `1536 × 1024` pixels, CSS `1536 × 1024`,
  device scale factor `1`; no density normalization was required.

## Comparison history

1. The first equal-viewport comparison showed excessive card spacing, a collapsed prepared row, duplicated task context, and missing source icons.
2. The implementation was tightened to compact operational rows, the prepared draft became directly visible, duplicate project text was removed, and Lucide source icons were added.
3. The final foundation comparison preserved the reference hierarchy: decision first, prepared work
   second, current tasks third, and change history last.
4. T083 added the production shell and repeated the comparison at the source's exact desktop size.
   The dark navigation rail, compact white command header, content canvas, desktop/mobile navigation,
   and LTR/RTL direction match the selected Command Brief structure. Global Capture, Chat, and What
   Changed are intentionally visible as honest inert Phase 1 entries, as required by the approved
   plan.
5. The shell review content is deliberately condensed and does not claim Phase 1 Today parity. The
   fuller decision controls, task table, and live assistant behavior remain Phase 1 work rather than
   being simulated in this foundation checkpoint.

## Interaction and accessibility findings

- Primary decision actions remain visible at `390px` with no horizontal overflow.
- Arabic content uses a scoped `dir="rtl"` surface and keeps technical paths in their correct direction with `bdi`.
- The review dialog receives focus, closes with Escape, and returns focus to its trigger.
- Keyboard focus is visibly distinguishable.
- Loading, empty, and recoverable-error states are available as separate stories.
- Reduced-motion, high-contrast, and forced-colors policies are present.
- No current browser console errors were observed after the final interaction run.
- Employee and manager authenticated journeys rendered the role-correct shell in English and Arabic;
  the employee Capture entry is absent for manager-only sessions.
- The inert Research entry returned the localized next-slice status in the browser.
- At `390px`, the mobile bottom navigation remained visible with no horizontal overflow and manager
  operations remained discoverable under More.

## Remaining intentional differences

- The reference depicts future Intelligent Today content. T083 validates the shell frame and entry
  contract only; richer cards and actions are intentionally excluded until their Phase 1 engine
  handoffs are implemented.
- The browser used for visual QA requested increased contrast, so borders appear stronger than the normal reference state. Normal and high-contrast modes are both covered by browser tests.

## Final result

passed

## T087 Universal Capture addendum — 2026-08-12

- The production Stable Shell Global Capture entry opens a labelled, focused dialog in both English
  and Arabic; Escape closes it and returns focus to the trigger.
- The compact form supports the approved text, link, code, safe file, and image choices without
  implying that a private draft is official work.
- Arabic RTL was inspected at `390 × 844`; the bottom-sheet layout, labels, technical mixed text, and
  primary action remain readable with no horizontal overflow.
- Recovery keeps the employee's raw draft visible and presents a clear retryable error.
- The authenticated Arabic employee journey completed a real private save against the local API and
  PostgreSQL. Visual evidence is stored under `docs/product/screenshots/ai-native-phase-1/`.

T087 design result: **passed**.

## T088 What Changed addendum — 2026-08-12

- The Arabic authenticated shell opens an owner-filtered What Changed dialog from the global action.
- A delivered private-capture receipt is described as an operational change only; raw private content,
  employee scoring, readiness, progress, and technical identifiers remain hidden.
- When the API is unavailable, the dialog preserves the last delivered item and displays a concise,
  retryable Arabic warning. Reopening after recovery removes the warning without duplicating the item.
- Evidence is stored in `docs/product/screenshots/ai-native-phase-1/t088-authorized-refresh.png` and
  `t088-recovery-state.png`.

T088 design result: **passed**.
