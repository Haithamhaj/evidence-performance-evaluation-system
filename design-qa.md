# P3-14 Project Progress Charts Design QA

## Visual target

- Source visual truth:
  `/Users/haitham/.codex/generated_images/019f659b-889b-7873-9927-4ae4802ea123/exec-c0773327-29ec-4c06-af2e-6786c7f45c3a.png`
- Browser-rendered implementation:
  `docs/product/screenshots/ai-native-final-design/p3-14-progress-contract-empty-en.png`
- Comparison artifact:
  `/tmp/p3-14-design-qa-comparison.png`
- Source pixels: `1487 × 1058`; normalized to `1012 × 720` for the side-by-side comparison.
- Implementation pixels: `1280 × 720`; CSS viewport `1280 × 720`; density `1×`.
- State: English desktop, authenticated Codex contributor, real Project, no approved Progress Contract.

## Findings

- [P1] The active-contract visual state cannot yet be compared.
  - Location: `Contract-based progress charts` on the real Codex Project.
  - Evidence: the source visual contains confirmed circular progress, milestones, and KPI values. The
    running Project truthfully contains no approved Progress Contract and therefore renders the
    protected empty state instead of a percentage or chart.
  - Impact: typography, spacing, color, circular-chart fidelity, milestone density, KPI layout, and
    accessible-table parity cannot be accepted visually against the source until an authorized owner
    activates a contract with a verified measurement.
  - Fix/gate: the authorized Project Owner reviews and activates the Progress Contract. Then capture
    the same English desktop state and rerun the side-by-side comparison before accepting P3-14.

## Required fidelity surfaces

- Fonts and typography: the empty state uses the existing Command Brief type hierarchy and reads
  clearly; active percentage/KPI typography remains blocked by the state mismatch.
- Spacing and layout rhythm: the empty state is compact and aligned with the surrounding Project
  sections; active ring/milestone/table density remains blocked.
- Colors and visual tokens: the empty state uses the existing neutral/blue Command Brief tokens; active
  semantic progress colors remain blocked.
- Image quality and asset fidelity: no image asset is required for the truthful empty state. The
  implementation uses the existing icon system and no handcrafted image substitute.
- Copy and content: the live copy explicitly states that charts require an approved contract and does
  not imply activity-derived progress.

## Evidence checked

- Full-view comparison: source and browser screenshot were normalized to the same 720 px height and
  inspected together in `/tmp/p3-14-design-qa-comparison.png`.
- Focused region: the live `Contract-based progress charts` region was captured after scrolling it
  into view. A deeper active-chart comparison would be false precision because the states differ.
- Primary interaction: authenticated Project load and protected contract-state projection.
- Console: no browser console errors were present in the captured state.

## Comparison history

- Iteration 1: implementation correctly withheld the chart because the real Project has no approved
  Progress Contract. No visual fix can close the active-state mismatch without crossing the protected
  human approval gate.

## Implementation checklist

- [x] Never render a chart without an approved Progress Contract and verified measurement.
- [x] Pair every rendered chart with a visible source-backed summary/table alternative.
- [x] Exclude Task, Update, and GitHub volume from progress calculation and copy.
- [x] Verify the real Codex contributor empty state and console.
- [ ] Authorized Project Owner activates the contract.
- [ ] Capture and compare the real active-contract state at the same viewport.

final result: blocked
