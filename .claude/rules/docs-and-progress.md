---
paths:
  - "docs/**"
  - "PROGRESS.md"
  - "planning/PROGRESS.md"
  - "planning/phases/**"
---

# Docs and the progress ledger

**Skill:** `docs-maintenance`.

**Agent:** `docs-maintainer` for `docs/modules/**`, the `docs/adr/README.md` index rows, `PROGRESS.md`,
the `planning/PROGRESS.md` phase-status table and handoff log, and each phase file's task-state column.
`docs/modules/<name>.md` is shared with that module's engineer agent and wave-serialized: the two never
run in the same wave. `docs/security/**` belongs to `tooling-engineer`. ADR bodies (`docs/adr/NNNN-*.md`),
`docs/SERVICES-SETUP.md`, `docs/DEVELOPING-ON-MACOS.md` and phase-file prose are human-only
(`human-only.md`).

**Proof:** `just docs-check`; `just docs-check --strict` before a PR.

**Invariants that bite here:**
1. `docs/modules/*.md` bijects with `apps/api/src/modules/*` plus `platform` and `shared-kernel`, and
   each carries the eight headings of `templates/module-contract.md` in order — `docs-check` DC-01, DC-02.
2. A module contract's `**Status:**` is a valid enum value and its `**Last updated:**` date is not older
   than the last commit to the module's `index.ts` or its internal `schema.ts` — `docs-check` DC-03.
3. Every ADR file has a row in `docs/adr/README.md` and every row has a file — `docs-check` DC-04.
4. The root `PROGRESS.md` "Current phase" line matches its row in `planning/PROGRESS.md` —
   `docs-check` DC-12.
5. Write agents never edit the ledger; they report a `Suggested PROGRESS.md line:` that the main session
   or `docs-maintainer` applies — the Stop hook `scripts/hooks/session-close-check.sh` blocks a main
   session that changed watched paths without touching a PROGRESS file.
6. Stale vendor names never appear in `docs/**` outside `docs/adr/` — `docs-check` DC-13.
