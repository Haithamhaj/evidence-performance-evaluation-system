# AI-Native Frontend Source Snapshot

**Status:** Approved Phase 0A source receipt  
**Recorded:** 2026-08-11  
**Purpose:** Pin the authoritative engine and product inputs used to define the final frontend
experience.

## Approved Plan Receipt

| Source                              | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| Product-owner approved attachment   | `c37e6b2ea3bd0c2d00b40af8e4fc9f5e984ee4bf52a60809d9d0e12ec958c920` |
| Prettier-normalized repository copy | `ef52f66cd2d7e9b74eab1a1a7d4f6ed0ddb80be369b942816074491cc1c0c669` |

The repository copy differs only through Markdown normalization. The attachment hash remains the
approval receipt, and the approved product meaning is unchanged.

## Engine Source Snapshot

| Source                                   | Git identity                               |
| ---------------------------------------- | ------------------------------------------ |
| Clean `main` baseline                    | `2eee638958294b790c75375d564d5c03188062f2` |
| Completed engine baseline                | `a631eaa81a5b462f329e5917c5be3301281f970a` |
| `ENGINE_FEATURE_REGISTER.md` blob        | `0e462d5af380160b2fa0ad7c871c319dce2e08d4` |
| `ENGINE_CAPABILITY_MATRIX.md` blob       | `aa04a6ac3f310eb195b3d13e7885897716574601` |
| `ENGINE_CUSTOMER_JOURNEY_MAP.md` blob    | `39aed072a9c74135b2a28a1c962202ff3a0836bf` |
| `ENGINE_FRONTEND_HANDOFF_SCHEMA.md` blob | `c3978600b1c9cfc88a3dc1b7682f5606e1718ca9` |

## Use and Exclusions

- Engine domain records remain authoritative for names, statuses, rules, permissions, state,
  external gates, and public contracts.
- Phase 0A adds experience classification and prototype evidence only. It does not copy domain
  authority into the frontend.
- `experimental/clickup-multi-agent-ui` is a negative reference only. It must not be merged, copied,
  or treated as an implementation source.
- Production shell, runtime, tokens, primitives, and components remain blocked until Product Owner
  Gate `D0`, followed by the separate `G0` foundation gate.
