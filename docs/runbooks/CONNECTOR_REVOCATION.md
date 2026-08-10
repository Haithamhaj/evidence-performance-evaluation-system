# Connector Revocation

## When to use

Use for suspected Google/GitHub token exposure, unexpected provider access, user disconnect, or provider outage. Revocation must preserve historical source references and audit records while making remote content inaccessible as required by policy.

## Procedure

1. Identify organization, user/installation, provider, and correlation ID without exposing the credential.
2. Disable synchronization and webhook processing for only the affected connection.
3. Revoke the provider grant or GitHub App installation/key through the owning platform administrator.
4. Clear the credential handle and record disconnect/content-inaccessible timestamps through the connector’s protected service.
5. Keep queues paused for the affected connector until revocation is confirmed.
6. Reconcile signed event IDs after recovery; duplicates remain idempotent.
7. Tell affected employees that manual task/update/evidence capture is still available.

Never delete historical evidence, source IDs, or contribution history as a substitute for revocation. Follow [incident response](./INCIDENT_RESPONSE.md) if compromise is suspected.
