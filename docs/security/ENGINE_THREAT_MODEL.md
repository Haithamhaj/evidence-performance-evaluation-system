# Engine Threat Model

Status: E6C pilot threat model. Owner: System Administrator with Product Owner escalation for protected
rule decisions. Review after any identity, privacy mode, AI boundary, storage, or deployment change.

## Protected assets and trust boundaries

- Identity: OIDC callback/session state, role assignments, deactivation state, and time-bounded acting authority.
- Private context: Gmail/Calendar summaries, connector tokens, private Inbox, coaching, and future private-mode originals.
- Historical truth: audit events, closed evaluations, responsibility windows, source/evidence lineage, and export receipts.
- Untrusted input: repositories, webhooks, documents, archives, code, images, comments, voice transcripts, and AI output.
- Secrets: provider keys, OAuth/GitHub credentials, object-store credentials, encryption handles, backup keys, and signed URLs.

## Threats and active controls

| Threat                                                     | Control and verification                                                                                                 | Owner / response                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| OIDC replay, callback mix-up, stale session, inactive user | encrypted same-origin state, nonce/PKCE, exact issuer/audience, inactive-user denial                                     | Identity admin; revoke session/client     |
| Role confusion or delegated overreach                      | server policy plus exact action/resource/time scope; responsibility-window tests                                         | Manager for ownership, admin for roles    |
| Private Google context/token exposure                      | owner-only projection, encrypted token boundary, disconnect generation lock, log redaction                               | Connector owner; revoke Google grant      |
| Forged/replayed GitHub event                               | minimum-permission App, signature verification, source delivery idempotency, reconciliation                              | Integration admin; suspend installation   |
| Malicious upload/archive/object read                       | type/size/archive limits, malware gate, signed bounded reads, content treated as untrusted                               | Storage admin; quarantine/revoke          |
| Prompt injection or schema bypass                          | AI Router only, trusted prompt/version, untrusted-content delimiter, schema and prohibited-output validation, human gate | AI admin; disable route/fallback          |
| Provider leakage                                           | route policy, source classification, redacted logs/traces, no direct provider SDK outside router                         | AI admin; revoke/rotate key               |
| Evaluation/upward/coaching/leave privacy leak              | frozen visibility policy, fail-closed future modes, field separation, audit-before-sensitive-read                        | Product/privacy owner; disable projection |
| Export theft or stale access                               | asynchronous encrypted artifact, current-access recheck, expiry/revocation, access audit                                 | System Administrator; revoke artifact     |
| Queue replay/idempotency abuse                             | operation/source keys, durable receipts, transactional effects, bounded replay                                           | Operations admin; pause/drain/reconcile   |
| Audit tampering/admin override abuse                       | append-only restrictions, audit in protected transaction, exact reason/action, separated roles                           | System Administrator; incident review     |
| Backup exfiltration/destructive restore                    | encrypted bundle, hash manifest, external key custody, isolated default, direct-human restore gate                       | Backup custodian; rotate/revoke/recover   |

## Logging and error rules

Credentials, tokens, model keys, signed URLs, private source bodies, prompts, uploads, feedback originals,
and personal notes are never normal log fields. Structured records use allowlisted identifiers,
correlation/operation IDs, bounded categories, and redacted errors. Public health returns status only;
detailed diagnostics require System Administrator authorization and still omit raw errors.

## Residual and external risks

- Live OIDC, Google, GitHub, storage/malware, Redis, email, telemetry, AI, backup, and deployment
  credentials/targets remain truthful `EXTERNAL_GATE` items until configured and validated by their owner.
- Future Manager-Blinded/Anonymous modes remain disabled and fail closed; enabling one requires an approved
  privacy threat-model revision and direct verification.
- Destructive shared/production restore and launch remain direct human gates.
