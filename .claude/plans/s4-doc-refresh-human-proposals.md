# Proposal — human-only doc edits from the 2026-09-24 doc refresh

`CLAUDE.md` and `planning/15-team-workflow-and-ai-agent-operations.md` are human-only (root `CLAUDE.md`, "Prohibited without explicit human authorization"; `.claude/rules/docs-and-progress.md`). The doc refresh on branch `docs/refresh` found the lines below out of date. Apply them by hand, or authorize an agent to apply exactly these diffs.

## `CLAUDE.md`

1. Repository layout, `packages/shared-kernel/` line (ADR-0005):

   ```diff
   -packages/shared-kernel/ units, IDs, reason codes, entitlement names, event envelope — pure, depends on nothing
   +packages/shared-kernel/ units, IDs, reason codes, entitlement names, event envelope — pure, depends on nothing; registry/*.json generates TS/Swift/Kotlin constants (ADR-0005)
   ```

2. Standard commands, `just generate` line:

   ```diff
   -- `just generate` — contracts → clients (`--check` = staleness gate)
   +- `just generate` — contracts + shared-kernel registries → clients and constants (`--check` = staleness gate)
   ```

## `planning/15-team-workflow-and-ai-agent-operations.md`

3. §5 recipe table, `just generate` row: after "Python models; event schema types;" insert
   "shared-kernel registries (`packages/shared-kernel/registry/*.json`) → TS, Swift (`AIStylistKernel`) and Kotlin constants;".

4. §5 `just bootstrap` steps. The current text says "prek/husky" and "the Android SDK itself is a separate `just android-sdk install`". Both no longer match `scripts/bootstrap.sh`. Proposed replacement for the "Steps:" sentence:

   > Steps: `--system` (Linux: apt packages, udev rules, Docker group, Android SDK packages + `ANDROID_HOME` in `~/.config/ai-stylist/env.sh`, Docker `swift:6.4`; macOS: Homebrew, Xcode check, Docker runtime detection) → mise (an existing one on PATH, else installed to `~/.local/bin`) + `mise install` (all pins) → `pnpm install` / `uv sync` → git hooks (`prek`: gitleaks, commitlint) → `.env` scaffold from `.env.example` with the local `DATABASE_URL` → age identity + secrets onboarding PR, or `secrets-sync` when the recipient is already listed (§6) → `just doctor` → prints next steps (mise activate, direnv hook).

5. §5 `just doctor` checks: "tool versions vs `mise.toml` pins" → "tool versions vs this repo's mise pins (global mise tools are ignored)".

`planning/SPINE.md`: nothing stale found for this scope.
