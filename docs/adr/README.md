# Architecture Decision Records

Decisions that add a dependency or provider, change a contract shape, override `planning/SPINE.md` (which also needs a DEC entry in `planning/16-risks-open-questions-and-decision-log.md`), or affect security-relevant design are recorded here (doc 15 §8). Agents check the decision log before reopening any settled question (`CLAUDE.md`, "Source-of-truth priority").

## Naming convention

- File: `docs/adr/NNNN-slug.md` — four-digit sequence, never reused, kebab-case slug. Sequence is assigned at PR time; renumber nothing.
- Title line: `# ADR-NNNN — <title>`. ADRs that planning docs reference by label (ADR-P02, ADR-OBS-01) keep that label in the title, e.g. `# ADR-0002 (ADR-P02) — iOS build lane`; the file name stays numeric.
- Template: `templates/adr.md` (Status / Date / Deciders / Decision-log entry / Related, then Context, Options considered, Decision, Rationale, Consequences and revisit triggers).
- Status values: `Proposed`, `Accepted`, `Superseded by ADR-NNNN`. An `Accepted` ADR must have (or be pending) a `DEC-NN` entry in doc 16; the index below records which.
- Reversal requires a new ADR and a new DEC entry; never edit a decision in place beyond status changes.

## Index

| ADR                                                         | Label      | Title                                                                                                             | Status                                                                                         | Date       | DEC                           |
| ----------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- | ----------------------------- |
| [0001](0001-monorepo-tooling-and-toolchain-pins.md)         | —          | Monorepo layout, tooling, and toolchain pins                                                                      | Accepted (items 1 and 8 partly superseded by ADR-0004; item 8 pins amended by ADR-0006)        | 2026-09-09 | DEC-37                        |
| [0002](0002-ios-build-lane.md)                              | ADR-P02    | iOS build lane: EAS Build vs GitHub Actions macOS                                                                 | Superseded by ADR-0004                                                                         | 2026-09-09 | — (OQ-04, resolved by DEC-51) |
| [0003](0003-self-hosted-infrastructure-baseline.md)         | —          | Self-hosted infrastructure baseline: pg-boss, owned servers + Coolify, self-managed PostgreSQL, R2 delivery model | Accepted (PostgreSQL 17 pin amended by ADR-0006; provider and region set by DEC-61 and DEC-62) | 2026-09-13 | DEC-41–48                     |
| [0004](0004-native-ios-and-android-clients.md)              | —          | Native iOS (SwiftUI) and Android (Compose) clients replace React Native + Expo                                    | Accepted (toolchain pins amended by ADR-0006)                                                  | 2026-09-22 | DEC-49–54                     |
| [0005](0005-shared-kernel-registries-for-native-clients.md) | —          | Shared-kernel registries as language-neutral JSON, generated for TS, Swift and Kotlin                             | Accepted                                                                                       | 2026-09-23 | DEC-55                        |
| [0006](0006-track-latest-stable-toolchains.md)              | —          | Track latest stable toolchains and dependencies                                                                   | Accepted                                                                                       | 2026-09-26 | DEC-56                        |
| [0007](0007-observability-backend.md)                       | ADR-OBS-01 | Observability backend: OTel to Grafana Cloud free tier (EU); PostHog Cloud US                                     | Accepted (PostHog region amended by DEC-61)                                                    | 2026-09-27 | DEC-58                        |
| [0009](0009-no-cross-module-foreign-keys.md)                | —          | No cross-module foreign keys                                                                                      | Accepted                                                                                       | 2026-10-09 | DEC-67                        |
| [0010](0010-decision-log-ratification.md)                   | —          | P00 ratification of the decision log                                                                              | Proposed                                                                                       | 2026-10-09 | DEC-68                        |

Number 0008 is not used: its draft (home of the composed Drizzle schema) was declined by the owner on 2026-10-04 (`.claude/plans/2026-10-04-repo-split-readiness-proposal.md` §A).
