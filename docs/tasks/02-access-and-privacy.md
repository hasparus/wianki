# Planner Brief: Guest/Admin Access and Privacy

## Objective

Implement private QR/password access and consent without guest accounts.

## Fixed decisions

Next 16 Proxy is optimistic only. Guest cookie is seven days; admin cookie is 12
hours. Tokens are independent 256-bit bearer secrets. Admin QR is shared and has
no individual attribution. Mutation routes check authorization and origin.

## Owned surfaces

`proxy.ts`, `lib/auth`, login/admin entry behavior, privacy page, consent copy.

## Dependencies and outputs

Consumes environment names from task 01. Produces `requireGuest`,
`requireAdmin`, and the consent-version contract for upload/gallery/admin.

## Non-goals

No Supabase Auth, social login, identity capture, IP storage, or per-admin audit.

## Risks

Token leakage in clean redirects/logs, trusting cookie presence, CSRF, weak
manual passphrase, and admin-session survival after secret rotation.

## Acceptance

Valid QR sets cookie and removes token; invalid/expired/tampered sessions fail;
all protected handlers reauthorize; consent is required; admin secret rotation
invalidates sessions.
