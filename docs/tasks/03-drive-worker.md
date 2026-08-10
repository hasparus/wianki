# Planner Brief: Drive Archive Worker

## Objective

Archive originals in user-owned Drive without Vercel payload transit.

## Fixed decisions

Personal OAuth with `drive.file`; Worker stores refresh token; exact-origin
CORS; ten-minute operation JWT; 24-hour signed receipt; raw streaming body;
25 MiB cap; Drive `appProperties.photoId`; delete means trash.

## Owned surfaces

`workers/archive`, local OAuth bootstrap script, Worker tests and secrets
documentation.

## Dependencies and outputs

Consumes task 01 token/status vocabulary. Produces upload, reconcile, and delete
HTTP contracts plus signed receipts for task 04/05.

## Non-goals

No Google service account for Drive, R2 mirror, image transformation, or Drive
credentials in Next.js/browser.

## Risks

Buffering bodies, OAuth Testing expiry, mismatched lengths, permissive CORS,
receipt replay, orphaned files, and Drive 5xx responses.

## Acceptance

Exact token/photo/operation checks; body streams; wrong origin and expired JWT
fail; UUID reconciliation works; deletion trashes; secrets stay outside config.
