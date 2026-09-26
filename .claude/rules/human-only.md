---
paths:
  - "CLAUDE.md"
  - "planning/**"
  - "templates/**"
  - ".claude/plans/**"
  - "secrets/**"
  - ".sops.yaml"
  - ".spectral.yaml"
  - "prototype/**"
  - "README.md"
  - "CODEOWNERS"
  - ".envrc"
  - "solo.yml"
  - "AI-STYLIST-FABLE-PROMPT.md"
---

# Human-only files

**Skill:** none. To change one of these files, write the exact diff into a new
`.claude/plans/<yyyy-mm-dd>-<slug>-proposal.md` and stop.

**Agent:** none: the human, or the main session when the human asks for that exact change. Two
exceptions. `docs-maintainer` writes the `planning/PROGRESS.md` phase-status table and handoff log and
each `planning/phases/P*.md` task-state column (`docs-and-progress.md`). `tooling-engineer` and
`docs-maintainer` may create new proposal files under `.claude/plans/`; neither edits an existing one.

**Proof:** `just docs-check --strict` (DC-14 compares the root `CLAUDE.md` layout block with the tree;
DC-15 compares the doc 15 §5 recipe catalog with `just --summary`).

**Invariants that bite here:**
1. Root `CLAUDE.md`, `planning/SPINE.md` and `planning/15-*.md` are never edited directly — the
   PreToolUse path guard `scripts/hooks/guard-protected-paths.sh` denies it and `permissions.ask` in
   `.claude/settings.json` prompts the human.
2. The rest of `planning/**` (docs 00–16, phase prose, `planning/research/`, `planning/.agents/`,
   `planning/templates/`, the historical `planning/claude-contract-historical.md`) is read-only context. New evidence against
   a recorded decision becomes a proposed ADR and a decision-log entry for
   `planning/16-risks-open-questions-and-decision-log.md`, never a silent edit (reviewer-checked).
3. `secrets/**` and `.sops.yaml` change only through the secrets recipes a human runs (`just secrets-edit`,
   `just secrets-updatekeys`, `just secrets-approve`) — the path guard denies direct edits.
4. `prototype/**` is a throwaway spike; production code never imports it — depcruise
   `prototype-unimportable` (`just arch-check`).
5. `templates/**` is the authoring source for issues, PRs, ADRs, handoffs, module contracts, phases,
   skills and agents; it changes only through the main session (reviewer-checked).
6. Existing `.claude/plans/*.md` files are history. Read the `> Status:` banner first; never re-execute a
   plan marked EXECUTED, APPLIED or SUPERSEDED (reviewer-checked).
