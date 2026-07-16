# Repository Validation Tools

## AI Provider Boundary Checker

`validate-boundaries.mjs` is a bounded repository guard for the protected rule that feature modules must use the provider-neutral AI Router instead of provider SDKs directly.

The accepted T011 scope is:

1. Reject direct provider SDK imports outside `packages/ai-routing` (including static imports, dynamic imports, and `require` forms covered by the scanner).
2. Reject the direct and meta-call patterns represented by the 17 committed T011 regression cases.
3. Scan the current production source tree without false positives, including the OIDC, logger, audit, and administration chains.

The checker runs through `pnpm lint`, so the direct-import check is enforced in CI as the repository's import-grep equivalent.

## KNOWN_LIMITATIONS

This tool is not a complete JavaScript/TypeScript value-flow analyzer. Full static analysis of closures and arbitrary runtime values is undecidable and is outside the approved T011 scope.

The checker does not guarantee detection of:

- closures returned inside object or array containers;
- aliased or destructured indirect value flows; or
- reflection-based invocation and mutation flows beyond the committed bounded cases.

These limitations do not relax the AI-Router-only product rule. They are covered by layered controls:

1. Runtime key isolation: provider credentials and provider-specific configuration must be injected only into the AI Router runtime boundary.
2. CI import scanning: `pnpm lint` runs `validate-boundaries.mjs` and rejects direct provider SDK imports outside `packages/ai-routing`.
3. Human code review: changes involving AI providers, credentials, adapters, routing, dynamic imports, reflection, or indirect invocation must be reviewed for AI Router bypasses.

Use these commands for the bounded acceptance check:

```bash
pnpm exec vitest run tests/repository/ai-provider-boundaries.test.ts
node scripts/validate-boundaries.mjs
pnpm lint
```
