# Delegation order

Each file is a fixed-contract planning brief. A planning agent returns:

1. a dependency-aware implementation sequence
2. the exact interfaces it consumes and produces
3. tests mapped to acceptance criteria
4. migration and deployment consequences
5. blockers, only where external input is genuinely required

Order: `01` first. `02` and `03` can run in parallel after it. `04` needs both.
`05` and `06` need the shared upload and data contracts. `07` integrates
everything.
