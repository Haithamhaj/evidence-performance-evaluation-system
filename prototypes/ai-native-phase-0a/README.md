# AI-Native Today — Phase 0A Prototype

This standalone prototype demonstrates the Product Owner-selected **Command Brief** direction for
Gate D0. It uses synthetic data and imports no production application code.

## Run

```bash
node scripts/serve-ai-native-phase-0a-prototype.mjs --port 4173
```

Open `http://127.0.0.1:4173/?locale=en&state=busy`.

## Prototype controls

- Locale: `locale=en` or `locale=ar`
- Today state: `state=busy`, `state=clear`, `state=stale`, or `state=recovery`
- Visible role area: `role=employee`, `role=manager`, or `role=admin`

The state preview menu is a D0 review aid only. It is not a proposed production control.

## Boundaries

- Synthetic fixtures only; no API, database, provider, or production imports.
- AI prepares and explains; consequential actions require the employee's confirmation.
- Project progress is represented only as a receipt against an approved contract condition.
- No employee rating, ranking, productivity score, or readiness percentage is present.
