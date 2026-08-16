# Phase 9 Internal Beta Release Evidence

## Decision summary

The repository is technically ready for a bounded internal employee beta, with retained rollback
routes and provider-independent manual work. This is not a production-launch approval. Production
identity, Google, GitHub, storage, email, telemetry, deployment, backup, and restore remain the
external gates recorded in `docs/operations/EXTERNAL_GATE_REGISTER.md`.

## P9-04 — Locale and device matrix

| Surface                 | English desktop | Arabic RTL | 390px/touch | Evidence                                                                        |
| ----------------------- | --------------- | ---------- | ----------- | ------------------------------------------------------------------------------- |
| Home                    | Verified        | Verified   | Verified    | `t096-home-desktop.png`, T090 Arabic RTL acceptance, `t096-home-mobile.png`     |
| Project                 | Verified        | Verified   | Verified    | `t097-project-desktop.png`, `t097-project-mobile.png`, approved RTL foundations |
| Work                    | Verified        | Verified   | Verified    | `t098-work-desktop.png`, `t098-work-mobile.png`, T092 Arabic mobile acceptance  |
| Capture and Review      | Verified        | Verified   | Verified    | T099/T100/T101 desktop/mobile screenshots                                       |
| Today and live receipts | Verified        | Verified   | Verified    | T090/T091 screenshots and Storybook keyboard/390px checks                       |

The localization suite passed 25/25. Storybook passed 7/7, including Arabic direction, keyboard
operation, automated accessibility checks, and a 390px overflow check. Mixed technical text and URLs
remain rendered through the existing RTL-safe components.

Arabic evaluation remains outside this release: rubric translation and semantic approval are still a
protected human gate. Normal Arabic daily-work foundations remain available.

## P9-06 — Performance evidence

- The 1,000-item Work projection performance test passed its existing bounded budget.
- The durable receipt UI retains ordered de-duplication, a single in-flight read, bounded retries, and
  explicit refresh fallback.
- The current web production compile succeeds; the new feedback interaction adds no provider call,
  polling loop, or heavy client dependency.
- The protected performance-input scanner passes across 668 runtime files. Negative regression tests
  are excluded from runtime scanning, while explicit fixture scans remain available to prove the
  forbidden-field detector.

Real-user Core Web Vitals need a deployed internal environment and approved product analytics sink;
they are an operational follow-up, not something the local repository can truthfully manufacture.

## P9-07 — Accessibility evidence

- Core primitives pass keyboard activation, disabled-state, Escape/focus-return, RTL disclosure, and
  reduced-motion tests.
- Today passes Arabic keyboard operation, automated accessibility inspection, and 390px viewport
  containment.
- Work supports keyboard row navigation and a non-drag transition alternative.
- Progress visuals retain text/table equivalents and do not rely on color alone.
- Suggestion feedback uses native buttons, an accessible grouped choice, and announced success/error
  states.

The internal beta should include one short VoiceOver session with a real employee before broader
Arabic release. That human observation is tracked in the rollout checklist and does not weaken the
implemented keyboard or semantic requirements.

## P9-08 — Security and privacy evidence

- Protected API matrix: 55 controllers / 29 policy rows passed.
- Frontend import boundaries: 1,288 files passed.
- Secret scan: 1,995 files passed.
- Product-performance input boundary: 668 runtime files passed.
- Owner/private suggestion feedback rejects browser-selected identity and wrong-user access.
- Logout, same-origin gateway, deep-link, export re-authorization, source privacy, and manager-safe
  surfaces retain their focused regression coverage.

No retained route was removed. No provider credential or private content is exposed in the browser
bundle or the new feedback receipt.

## Remaining launch gates

1. Product Owner reviews the running employee journey using
   `docs/reviews/PHASE_9_PRODUCT_OWNER_LAUNCH_REVIEW.md` and accepts or rejects the internal beta.
2. An administrator supplies any provider integration selected for the pilot using minimum scopes.
3. Telemetry remains disabled until sink, residency, retention, and redaction are approved.
4. Production deployment, backup destination, and restore remain direct accountable-human gates.

## Recommendation

Proceed with a small internal employee cohort using the rollout runbook, keep rollback flags enabled,
and review aggregate product friction weekly. Do not expose suggestion feedback per employee, and do
not use it in Project progress, Evidence, evaluation, manager judgment, or employee scoring.
