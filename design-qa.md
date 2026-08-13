# Design QA — Intelligent Universal Capture

- source visual truth: `docs/product/screenshots/ai-native-final-design/universal-capture-approved.png`
- implementation: `docs/product/screenshots/ai-native-final-implementation/t099-clarify-desktop.png`
- initial capture: `docs/product/screenshots/ai-native-final-implementation/t099-capture-desktop.png`
- mobile: `docs/product/screenshots/ai-native-final-implementation/t099-capture-mobile.png`
- provider recovery: `docs/product/screenshots/ai-native-final-implementation/t099-provider-recovery.png`
- desktop viewport: 1487 × 1056 CSS px; mobile viewport: 390 × 844 CSS px
- state: authenticated employee, English, mixed URL + text, one clarification question

## Comparison result

The implementation preserves the approved right-side workspace sheet, mixed composer, attachment
actions, three-step orientation, likely Project/meaning/Work/KPI/privacy summary, one focused
clarification, and private/continue actions. It uses the existing ProductIcon family; no mock assets,
branding, raster substitutes, or copied external components are used.

## Findings corrected

1. P1 — the previous Capture required choosing a source type and did not show the assistant's
   interpretation. Replaced by one mixed composer and source-backed understanding panel.
2. P1 — the sheet was initially wider than the approved target. Reduced the desktop sheet to 52vw,
   matching the reference split while retaining a full-width mobile bottom sheet.
3. P1 — provider failure needed an honest usable state. The raw draft remains visible, the employee
   can retry or save privately, and no official record is claimed.
4. P2 — technical source IDs could leak into the daily UI. The sheet renders human labels and
   confidence only; opaque identifiers stay inside validated command payloads.

## Required behavior evidence

- No official Update, Evidence, Work Item, progress, or evaluation record is created by Understand.
- One missing question is displayed at a time.
- Project candidates are server-authorized before they reach the AI route.
- Uploaded or pasted content is treated as bounded untrusted input.
- Keyboard close/focus, visible focus, reduced motion, English/Arabic catalogs, RTL, and 390px layout
  remain supported.

## Deferred to T100 by approved scope

- The third step becomes active only when the Review & Confirmation model is connected.
- Employee selection of Update, Evidence, contribution context, and progress proposal happens there,
  not inside Capture.

final result: passed
