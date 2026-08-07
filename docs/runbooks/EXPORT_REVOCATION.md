# Export Revocation

## Procedure

1. Identify the export receipt, requester, authorization scope, expiry, and correlation ID.
2. Revoke the signed download reference or object access policy; do not delete evaluation or evidence history.
3. Mark the export receipt revoked through the protected export service and append an audit event with reason.
4. Confirm cached/public access is unavailable and the object remains private.
5. If access may have occurred, follow [incident response](./INCIDENT_RESPONSE.md) and assess the active feedback-visibility mode.

A revoked export cannot be reactivated. A new authorized request must generate a new receipt and expiring reference. Manager exports must continue to exclude individual Documentation Readiness percentages/rankings and any content unavailable under the active visibility mode.
