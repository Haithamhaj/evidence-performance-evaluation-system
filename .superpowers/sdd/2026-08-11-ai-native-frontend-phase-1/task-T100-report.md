# T100 — Review & Confirmation

## Outcome

Capture now continues into the approved employee review sheet. The employee can edit and select the
Update, edit and independently select Evidence/contribution context, optionally include a Project
progress proposal for its owner, review exact consequences/protections, acknowledge, and confirm only
the selected actions.

## Command and protection boundaries

- Employee edits are revised through the existing Update/Evidence owning APIs before confirmation.
- GitHub-derived Evidence cannot be selected until the employee has edited it.
- Update and Evidence confirmations execute independently and show truthful partial results.
- A selected progress proposal is carried only as `relatedProgressComponentIds` on the reviewed
  Update. The existing activity reader exposes `awaiting_confirmation`; official progress remains
  unchanged until the Project owner's approved rule/confirmation path applies.
- There is no Task-volume, GitHub-volume, activity-frequency, rating, ranking, or employee-score
  shortcut.
- No database or migration change.

## Verification

- Review model, command adapter, UI, and Capture handoff: 4 files / 15 focused tests passed.
- Web typecheck and production compile passed.
- Web lint, Prettier, secret scan, and diff check passed.
- Authenticated English desktop review was captured at
  `docs/product/screenshots/ai-native-final-implementation/t100-review-desktop.png`.

## Remaining acceptance work

T101 owns the one-pass authenticated desktop/mobile customer journey, official receipt verification,
final screenshots, rollback proof, and Product Owner stop gate.
