# Planner Brief: Deployment and Event Operations

## Objective

Turn the integrated application into a rehearsed, recoverable event service.

## Fixed decisions

Private GitHub repository; Vercel app; `wesele.weuniok.com`; Supabase Pro for
event month; Cloudflare Worker; Production OAuth consent; locally generated QR;
manual retention.

## Owned surfaces

CI, deployment instructions, integration smoke tests, DNS/secret matrix, quota
checks, recovery and wedding-day runbook.

## Dependencies and outputs

Consumes all other workstreams. Produces a go/no-go checklist and recovery
instructions usable without implementation judgment.

## Non-goals

No new product capability, multi-region failover, paid observability platform,
or automatic retention job.

## Risks

Paused/free projects, OAuth refresh expiry, mismatched secrets/origins, stale QR
printouts, quota exhaustion, and untested mobile/weak-network behavior.

## Acceptance

CI green from clean checkout; real disposable photo traverses both stores and
moderation; iPhone/Android rehearsal; all secrets rotatable; partial states
recoverable from admin/runbook.
