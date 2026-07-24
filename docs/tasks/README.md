# Delegation Order

Each file is a fixed-contract planning brief. A planning agent must return:

1. a dependency-aware implementation sequence;
2. exact interfaces it consumes and produces;
3. tests mapped to acceptance criteria;
4. migration/deployment consequences;
5. unresolved blockers only when external user input is genuinely required.

Order: `01` first; `02` and `03` may follow in parallel; `04` requires them;
`05` and `06` require shared upload/data contracts; `07` integrates everything.
