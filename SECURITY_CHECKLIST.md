# Security Checklist

Use this checklist for every API or schema change before merge/release.

## API Security

- All admin routes enforce authentication and admin-role authorization.
- No debug/test endpoints are shipped in production.
- Public API responses never include secrets, internal tokens, or internal-only diagnostics.
- Sensitive write endpoints validate input with server-side schemas.

## Authorization

- Never trust client-supplied `userId`, `vendorId`, or `riderId`.
- Always derive caller identity from auth token/session on the server.
- Enforce role-based access control consistently (`admin`, `vendor`, `rider`, `user`).
- Ensure non-admin users can act only on their own resources.

## Payments

- Payment verification is performed server-side only.
- Webhook-based verification is preferred over client-triggered polling paths.
- Verification endpoints are idempotent and safe against replay/duplicate execution.
- Payment metadata and references are validated before any write side-effects.

## Rate Limiting

- All public endpoints are rate-limited (per IP by default).
- Authenticated mutation endpoints use per-user or per-IP limits.
- Payment verification endpoints use stricter limits than generic public APIs.
- 429 responses include `Retry-After` and rate-limit headers.

## Environment Safety

- No secrets in `NEXT_PUBLIC_*` variables.
- No endpoints expose environment values, stack traces, or debug payloads in production.
- Production logs avoid sensitive values (keys, tokens, full PII).

## Migrations and Data Access

- Review all migrations for accidental privilege expansion or policy bypass.
- Verify RLS policy changes do not expose internal/sensitive tables publicly.
- Internal utility/sync paths are protected by auth and/or secrets.
- New columns/tables with sensitive data are covered by least-privilege access controls.

## Release Gate

- Run a route inventory review for new/modified `/api/*` endpoints.
- Confirm auth/RBAC for each endpoint class: public, authenticated, admin, internal.
- Confirm rate-limits are applied to all exposed public endpoints.
- Confirm no debug/test routes exist in production build output.
