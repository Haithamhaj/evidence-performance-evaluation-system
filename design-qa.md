# Design QA — Final Employee Project Workspace

- source visual truth path: `docs/product/screenshots/ai-native-final-design/project-workspace-approved.png`
- implementation screenshot path: `docs/product/screenshots/ai-native-final-implementation/t097-project-desktop.png`
- combined comparison evidence: `docs/product/screenshots/ai-native-final-implementation/t097-project-comparison.png`
- mobile evidence: `docs/product/screenshots/ai-native-final-implementation/t097-project-mobile.png`
- viewport: 1487 × 1058 CSS px desktop; 390 × 844 CSS px mobile
- source pixels: 1487 × 1058
- implementation pixels: 1487 × 1058 at device scale 1
- normalization: identical desktop viewport and state; no scaling or density conversion
- state: authenticated employee `Codex`, English, Atlas Delivery, fresh confirmed progress

## Full-view comparison evidence

The comparison preserves the approved persistent shell, Project purpose and document provenance, circular confirmed progress, completed/current/next milestone path, one measurable KPI, attention queue, compact Work/Updates/Evidence/Documents collections, append-only Timeline, and assistant rail. The implementation uses the existing ProductIcon family and no substitute raster or custom SVG assets.

## Focused region evidence

- Progress journey: 62% comes from the approved Project contract; milestone and KPI cells remain separate from employee performance.
- Assistant rail: Smart Brief, suggested action, source, primary action, and calculation disclosure remain contained in the rail without colliding with Project content.
- Mobile: 390 px evidence has no horizontal overflow; Project sections stack, the assistant rail is progressively disclosed away, and the existing bottom navigation remains visible.

## Findings and comparison history

1. P1 — the Project route previously rendered the temporary Workspace client rather than the approved composition.
   - Fix: route now consumes one protected `EmployeeProjectExperienceV1` composition behind its independent rollback flag.
   - Post-fix evidence: the visible route exposes the approved Project hierarchy and no internal identifiers.
2. P2 — the first desktop pass crowded the milestone and KPI region.
   - Fix: bounded the progress grid, widened the assistant rail, and added safe text wrapping.
   - Post-fix evidence: `t097-project-comparison.png` keeps the three regions visually independent.
3. P2 — action links and long Project text could crowd narrow screens.
   - Fix: mobile rows now stack actions beneath the record and preserve compact milestone labels.
   - Post-fix evidence: the 390 px full-page capture preserves all Project sections without horizontal overflow.

## Required fidelity surfaces

- Fonts and typography: existing Geist-based product typography retained; hierarchy, weight, and wrapping are close to the approved target and readable at both viewports.
- Spacing and layout rhythm: compact attention and evidence rows, dividers, Timeline rhythm, and assistant separation match the target intent; no actionable collision or clipping remains.
- Colors and visual tokens: dark navy navigation, blue primary action, Project accent colors, status greens, and muted dividers preserve the approved palette and contrast.
- Image quality and asset fidelity: the target contains no photographic assets; all icons use the existing product icon library. The progress ring is a semantic quantitative indicator, not a replacement illustration.
- Copy and content: Project copy is coherent, source-backed, localized, and explicitly describes Project progress rather than employee performance.
- Accessibility and behavior: semantic headings/regions, focus-visible styling, local links, reduced-motion behavior, 390 px no-overflow, and retained mobile navigation are present.

## Remaining P3 polish

- Add richer owner/contributor avatar treatment once the public people composition is finalized.
- The approved mock contains a more detailed KPI baseline/verification table; the implementation intentionally shows only currently sourced fields.

final result: passed
