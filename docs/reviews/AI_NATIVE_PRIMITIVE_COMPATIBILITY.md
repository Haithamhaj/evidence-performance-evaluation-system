# AI-Native Primitive Compatibility Decision

**Date:** 2026-08-11  
**Decision:** Adopt one suite — React Aria Components behind `@evaluation/ui` wrappers  
**Scope:** Phase 0B foundation only

## Tested stack

| Package                 | Exact version | License    | Purpose                                        |
| ----------------------- | ------------- | ---------- | ---------------------------------------------- |
| `react-aria-components` | `1.20.0`      | Apache-2.0 | Keyboard/focus/overlay/disclosure primitives   |
| `lucide-react`          | `1.31.0`      | ISC        | Icons through a closed local name wrapper      |
| `motion`                | `13.0.0`      | MIT        | User-preference-aware semantic motion provider |

`motion` 13.0.0 is intentionally used instead of 13.1.0 because the newer release was inside the
repository's minimum-release-age window. No supply-chain policy exception was added.

## Compatibility result

| Check                                     | Result                        | Evidence                                                                                     |
| ----------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| React 19.2.7 peer compatibility           | Pass                          | Exact peer resolution in lockfile                                                            |
| Next.js 16 server rendering and hydration | Pass                          | Arabic Action Button SSR plus warning-free React 19 hydration                                |
| TypeScript 7 strict project               | Pass with bounded import rule | UI package typecheck passes without weakening `skipLibCheck` or `exactOptionalPropertyTypes` |
| Keyboard and disabled semantics           | Pass                          | Enter activates; disabled action remains blocked                                             |
| Dialog focus trap/Escape/focus return     | Pass                          | jsdom browser-compatibility suite                                                            |
| Arabic, mixed-direction text, and RTL     | Pass                          | Arabic accessible names, `dir="rtl"`, and `dir="auto"` mixed text                            |
| Reduced-motion policy                     | Pass                          | `MotionConfig reducedMotion="user"` reaches `useReducedMotionConfig`                         |
| Owned API boundary                        | Pass                          | Product code exports only local wrappers and a closed icon-name union                        |

## Confirmed TypeScript finding

Importing the package root caused TypeScript 7 to load every component declaration, including an
unrelated `GroupProps` interface whose React 19 ARIA attributes conflict under the repository's
`exactOptionalPropertyTypes` policy. The problem reproduced consistently and disappeared when the
same components were imported through the package's documented component subpath exports.

Decision:

- Keep repository strictness unchanged.
- Import only `react-aria-components/Button`, `/Disclosure`, and `/Modal` inside owned wrappers.
- Do not expose React Aria types to features.
- Do not import the package root from product code.
- Re-evaluate the rule only after a future version passes the same compatibility suite.

## Owned wrappers

- `ActionButton`: primary/secondary/quiet/critical semantics; no library event type leakage.
- `ProductDisclosure`: keyboard-ready disclosure with logical/RTL styling.
- `FocusedDialog`: dismissible focused sheet/dialog with required localized close label.
- `ProductIcon`: closed semantic names; Lucide components are not imported by features.
- `SemanticMotionProvider`: follows the user's reduced-motion preference.

These remain generic primitives. Product labels, business states, permissions, progress, evidence,
and evaluation meaning stay outside `packages/ui`.

## Rejected alternatives

- **Headless UI:** narrower cross-framework fit and no material advantage over the tested React Aria
  accessibility model for this application.
- **Radix UI:** capable, but adopting a second suite would duplicate overlay/focus primitives and
  increase wrapper/upgrade work.
- **Unstyled native-only implementation:** appropriate for simple controls but would make dialog,
  disclosure, focus management, and cross-device accessibility project-owned infrastructure.
- **shadcn/Tailwind migration:** outside the approved styling direction and would introduce a visual
  system migration rather than a bounded primitive layer.

No alternative suite is installed.

## Exit strategy and maintenance risk

The wrappers contain no business meaning, so React Aria can be replaced inside `packages/ui` without
changing feature contracts. The main maintenance risk is upstream React/TypeScript declaration
drift. Exact pins, deep subpath imports, UI typecheck, SSR/hydration tests, and the browser
compatibility suite bound that risk. T081 adds visual Storybook evidence without changing this
adoption decision.

## Acceptance command

```bash
pnpm --filter @evaluation/ui typecheck
pnpm --filter @evaluation/ui lint
pnpm --filter @evaluation/ui test
```
