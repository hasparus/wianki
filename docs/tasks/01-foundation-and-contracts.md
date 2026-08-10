# Planner brief: foundation and contracts

## Objective

Keep tooling, schema, environment names, statuses, and design tokens as stable
inputs for all other workstreams.

## Fixed decisions

Root Next.js app plus `workers/archive` workspace; Node 24; private
Supabase bucket; migrations only; three independent statuses; exact palette in
`docs/visual-system.md`; no remote fonts or dark mode.

## Owned surfaces

Root configuration, CI, `lib/domain.ts`, environment templates,
`supabase/migrations`, and cross-workstream documentation.

## Dependencies and outputs

No feature dependency. Output is the canonical schema/API vocabulary consumed
by every later planner.

## Non-goals

Do not design page UI, Google API orchestration, or new product features.

## Risks

Generated Next declarations entering lint/Git, service keys exposed to browser,
schema edits outside migrations, and enum drift across Worker/app.

## Acceptance

Clean checkout installs; lint/typegen/typecheck/unit/Worker/build pass; no secret
is tracked; RLS denies anon/authenticated table and object access.
