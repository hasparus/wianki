# Planner Brief: Upload Orchestration

## Objective

Give mobile guests a reliable 1–10-photo upload with clear per-file recovery.

## Fixed decisions

25 MiB originals; 1920px/500 KiB derivative; WebP/JPEG; EXIF stripped; maximum
two originals in flight; private signed Supabase uploads; Drive and hot paths
run in parallel; complete-batch success message only.

## Owned surfaces

Upload API, browser compression/progress UI, capability use, finalization, and
Polish success/error copy.

## Dependencies and outputs

Consumes tasks 01–03. Produces verified hot/archive states and a derivative for
moderation.

## Non-goals

No video, background sync, service worker, realtime updates, or server-side
original upload.

## Risks

Mobile memory, HEIC decode variance, duplicate retries, browser closure,
capability expiry, and false “success” after partial failure.

## Acceptance

Client/server enforce limits; unsupported HEIC fails before upload; two-worker
queue is bounded; every file has phase/error state; finalization verifies object
and receipt; partial results remain honest and recoverable.
