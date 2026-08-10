# Planner brief: moderation and admin

## Objective

Keep unsafe/uncertain photos hidden while giving the couple recovery controls.

## Fixed decisions

Vision uses private derivative bytes. Adult/racy/violence at LIKELY or
VERY_LIKELY flags. Errors become `review_required`. Admin may approve, hide,
retry moderation, reconcile the archive, or confirmed-delete both copies.

## Owned surfaces

Vision adapter, moderation events, admin APIs, queues, actions, and deletion
reconciliation.

## Dependencies and outputs

Consumes schema and upload/Worker contracts. Produces final moderation status
and gallery eligibility.

## Non-goals

No facial recognition, semantic troll detection, individual admin attribution,
or permanent immediate Drive deletion.

## Risks

False positives, service outages, partial deletes, stale signed URLs, and
accidentally publishing pending/error items.

## Acceptance

Threshold unit tests; failure remains hidden; admin actions reauthorize/CSRF
check; delete is confirmed and partial failures persist; every decision creates
a moderation event.
