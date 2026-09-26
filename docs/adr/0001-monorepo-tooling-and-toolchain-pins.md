# ADR-0001 — Monorepo layout, tooling, and toolchain pins

- **Status:** Accepted. Partly superseded by [ADR-0004](0004-native-ios-and-android-clients.md) (2026-09-22): item 1 (`apps/mobile/src/render/`) and the Java Temurin 17 / watchman pins in item 8. The body below is unchanged. **Amended by [ADR-0006](0006-track-latest-stable-toolchains.md) (2026-09-26):** the item 8 pins moved to Node 24 (Active LTS), pnpm 12, Python 3.14 and Temurin 25, and toolchains now track the latest stable release.
- **Date:** 2026-09-09
- **Deciders:** product owner + implementing session (P02-T16)
- **Decision-log entry:** DEC-37 in [planning/16](../../planning/16-risks-open-questions-and-decision-log.md) (extends DEC-31 / DEC-32 / DEC-33; the layout tie-breaks below are new)
- **Related:** NFR-TEAM-030, NFR-TEAM-080, NFR-TEAM-090, NFR-TEAM-100 · RISK-12 · OQ-04, OQ-07 · phase P02

## Context

P02 turns the planning package into a repository. SPINE §2 and DEC-31/32/33 already fix the stack (pnpm workspaces + Turborepo, `just`, `mise`, GitHub Actions, the SPINE §3 module map), and doc 15 §1.2 fixes the toolchain pins. What the planning docs do not settle is a handful of layout tie-breaks where documents disagree (P02 brief §8 rows 1–5 and 12), plus two tool choices doc 15 leaves open (git-hook manager, ADR file naming). Every later phase writes code against these paths, so they must be fixed before P03.

## Options considered

| Option                                                                                                                          | Pros                                                                                  | Cons                                                                                                                       | Evidence (primary source + as-of date)                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A (chosen) — follow doc 15 / CLAUDE.md / SPINE where they agree; where docs conflict, take the P02 brief §8 recommended default | One decision record; no doc is rewritten; matches what CLAUDE.md already tells agents | Doc 04 §4.3/§6 and P02 §8 still contain the losing spellings until amended                                                 | `planning/15` §1.2 (pins as of Aug 2026), `planning/04` §4–6, `planning/06` §1, P02 brief §8 (2026-09-09) |
| B — follow doc 04 §6 verbatim (`src/renderer/`, `tools/bootstrap/`, no `packages/db`, `docs/ → planning/`)                      | Architecture doc is the layout owner                                                  | Contradicts CLAUDE.md, doc 15 §4/§7, doc 06 §1; would require rewriting the operating contract that AC-9 requires verbatim | same                                                                                                      |
| C — defer tie-breaks to T18 close-out                                                                                           | No decision now                                                                       | Every task in waves 2–3 would guess; ESLint/depcruise rules need the paths in T06                                          | P02 §13                                                                                                   |

## Decision

Adopt option A. Concretely:

**Repository layout tie-breaks**

1. Mobile 3D boundary directory is `apps/mobile/src/render/` (not `src/renderer/`). Doc 04 §4.3/§6 and P02 §8 references are to be corrected in the T16 PR description; they are not authoritative.
2. Backend domain modules are 13 directories under `apps/api/src/modules/`: `identity`, `profile`, `avatar`, `closet`, `media`, `outfit`, `context`, `recommendation`, `fashion-intel`, `billing`, `notifications`, `admin`, `assistant`. `platform` lives at `apps/api/src/platform/`; `shared-kernel` is the workspace package `packages/shared-kernel/`. Together these are the 15 SPINE §3 modules and get 15 contract files in `docs/modules/`.
3. Drizzle: `packages/db/` holds the drizzle-kit config, the composed schema entry, and `migrations/`. Per-module table definitions live in `apps/api/src/modules/<name>/internal/schema.ts` (doc 06 §1 is the canonical owner) and are composed from `packages/db/`.
4. Bootstrap and doctor scripts live in `scripts/` (`scripts/bootstrap.sh`, `scripts/doctor.sh`); `tools/` holds `tools/depcruise/rules.cjs` (`just arch-check`) and `tools/codegen/` (contract generators).
5. `docs/adr/` and `docs/modules/` are real directories at the root; `planning/` stays untouched, read-only context.
6. ADR files are named `docs/adr/NNNN-slug.md`; planning labels (ADR-P02, ADR-OBS-01) appear in the title line only.

**Tooling and pins**

7. Package manager pnpm 10.x (exact version in root `packageManager`, frozen lockfile in CI, build-script allowlist) with pnpm workspaces + Turborepo (`turbo.json`, remote cache).
8. `mise.toml` pins: Node 22.x (active LTS, exact patch), pnpm 10.x, Python 3.12.x, Java Temurin 17, just 1.x (plus watchman latest stable per doc 15 §1.2). Bumps only via Renovate PRs. Exact patch values compatible with Expo SDK 55 / the EAS image are verified in T01 (P02 brief §9) and recorded in `mise.toml`, not here.
9. Git-hook manager is `prek` (doc 15 §4 lists `prek`/husky; `prek` chosen as the first-listed, single-binary option). Hooks: gitleaks + commit-lint (Conventional Commits).
10. Secrets: sops + age (`secrets/<env>.enc.yaml`, `.sops.yaml`, direnv `.envrc` → gitignored `.env`, `just secrets-sync`) per doc 15 §6.

## Rationale

The layout tie-breaks follow the document that owns each concept (SPINE for module names, doc 06 for schema ownership, doc 15 for tooling paths) and the wording CLAUDE.md already uses, so the operating contract can move to the root verbatim (AC-9) without a second layout. Keeping `platform` and `shared-kernel` outside `modules/` matches doc 04 §4.1/§4.2 (leaf-only `platform`, dependency-free `shared-kernel`) and lets dependency-cruiser express the rules as path patterns. Pins are the doc 15 §1.2 values; nothing here is a benchmark or a measured claim. `prek` over husky is a convenience pick with no evidence beyond doc 15 listing it first; it is cheap to reverse.

## Consequences and revisit triggers

- Positive: one path vocabulary for ESLint boundaries, depcruise, CODEOWNERS, skills, and module contracts; agents stop guessing.
- Negative/accepted debt: doc 04 §4.3/§6 and P02 §8 still carry `renderer`/`tools/bootstrap` spellings until the planning docs are amended (planning is read-only for this task); the pins may need patch-level adjustment at T01 against the EAS image.
- **Revisit when:** Expo SDK 55 / EAS image requires a Node or Java major other than the pin; `prek` blocks a required hook (switch to husky, new ADR); doc 06 changes schema ownership; a second workspace consumer of Drizzle schema appears (would argue for schema in `packages/db/`). Reversal requires a new DEC entry.
