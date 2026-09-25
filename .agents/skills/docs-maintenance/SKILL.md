---
name: docs-maintenance
description: Keep `PROGRESS.md` (root and `planning/PROGRESS.md`), module contracts (`docs/modules/*.md`), the ADR index (`docs/adr/README.md`), and phase-file task-state columns in sync with the code and with each other by running `just docs-check` and fixing every finding inside its write set — module-contract bijection and headings, stale module-contract `Last updated` dates (DC-03), ADR file-to-index sync, and the PROGRESS pointer; DC-05/DC-09 hits in skills, agents and rules are reported, not fixed. Use when asked to update `PROGRESS.md`, refresh a module contract after a public interface or schema change, add an ADR to the index, close out a session, write a handoff entry, or resolve a `just docs-check` failure (DC-01 through DC-04, DC-12). Not for writing the code or schema change behind a doc update — use the owning module's skill (e.g. `backend-module`, `db-migration`) first, then this skill for the doc sync; not for a broken `docs-check.sh` script or a missing `just` recipe itself — use `tooling-ci` for that.
metadata:
  modules:
  last-reviewed: 2026-09-25
  owner-agent: docs-maintainer
---

# Docs Maintenance

## Trigger

- A `just docs-check` finding needs fixing: module-contract bijection or headings (DC-01/DC-02),
  a `Status`/`Last updated` field stale relative to the module's code (DC-03), an ADR file with no
  index row or vice versa (DC-04), or the root `PROGRESS.md` current-phase line drifting from its
  row in `planning/PROGRESS.md` (DC-12).
- A module's public interface, owned tables, events, or allowed/forbidden dependencies changed and
  `docs/modules/<name>.md` needs updating to match — always run _after_ the code change has
  already landed, never as a substitute for it.
- A session is ending: "wrap up", "handoff", "log progress", "close out the session", before
  clearing the session or context compaction.
- The lead's close-out after parallel lanes (`cross-platform-feature` step 12): apply each report's
  `Suggested PROGRESS.md line` once every code lane has finished.
- Do first, then return: the module skill that made the code change (`backend-module`,
  `recommendation-rules`, `entitlements-billing`, `db-migration`, `api-contract-change`, …) — this
  skill syncs the doc that describes their change, it does not make the change itself.

## Required reading

1. `just docs-check`'s own output for this run — every finding line names a check id (`DC-01`
   … `DC-15`), a file, and a line; group by check id before touching anything.
2. `templates/module-contract.md` — the 8 required headings, in order, and what each holds.
3. `templates/session-handoff.md` — the handoff-entry shape for `planning/PROGRESS.md`.
4. `.agents/skills/docs-maintenance/references/contract-sync.md` (this skill) — the "public surface
   changed → contract section" mapping, so a module-contract edit touches the one section the
   change actually affects.
5. `.agents/skills/docs-maintenance/references/session-close.md` (this skill) — the end-of-session
   procedure: phase table row, root pointer line, handoff entry, last green command.
6. `docs/adr/README.md` — the ADR naming convention and index-row shape.
7. `tools/docs/planned-paths.txt` — paths a finding might name that are legitimately not built
   yet; do not "fix" one of these by inventing the file.

## Workflow

1. Run `just docs-check` (scope to the paths you were asked about, or run full-repo). A finding
   that never gets grouped by check id gets fixed twice or missed — group first, act second.
2. For each finding, apply the template that owns that kind of drift, never a bespoke edit:
   - Module contract (DC-01/DC-02/DC-03) → `templates/module-contract.md`'s heading set and
     `.agents/skills/docs-maintenance/references/contract-sync.md`'s section mapping; bump
     `**Last updated:**` to today only when you actually changed the contract's content, not to
     silence the check.
   - ADR index row missing (DC-04) → add the row to `docs/adr/README.md` following the existing
     table's columns; never write or renumber the ADR body itself — that's the ADR author's job.
   - `PROGRESS.md` drift (DC-12) → the root pointer's "Current phase" line must restate the exact
     status word and phase name from `planning/PROGRESS.md`'s table row, nothing paraphrased.
   - Session close → `.agents/skills/docs-maintenance/references/session-close.md`'s procedure end
     to end, using `templates/session-handoff.md` for the log entry.
3. Rerun `just docs-check` after every batch of fixes. A finding outside this skill's write set
   (a skills/agents README coverage row, a generated-file mismatch, a source-code change) gets
   named in the report, not fixed — fixing it here would be editing another agent's file set.
4. Stop and write a proposal instead of editing when the only fix touches `CLAUDE.md`,
   `planning/SPINE.md`, or `planning/15-*.md` (all three are human-only per `CLAUDE.md`,
   "Prohibited without explicit human authorization"): draft the exact diff as a new file
   `.claude/plans/<yyyy-mm-dd>-<slug>-proposal.md` (never edit an existing plan) and say so in the
   report — do not apply it, even if the fix looks trivial.
5. `docs/modules/**` is shared with each module's engineer agent and serialized by waves: never
   edit a module contract while that module's engineer runs in the same wave. The write set is
   `docs/modules/**`, `docs/adr/README.md`, `PROGRESS.md`, `planning/PROGRESS.md`'s phase-status
   table and handoff log, and each `planning/phases/P*.md` task-state column.
6. Report what changed, what is still red and why (e.g. it needs a human-authorized proposal or
   falls in another agent's write set), and the exact `just docs-check` output from the final run.

## Validation commands

```bash
just docs-check                       # full repo; group findings by check id first
just docs-check <path you fixed>      # re-check just that file after a targeted fix
just docs-check --fixtures            # only when you changed scripts/docs/** itself — rare here
just ci-parity                        # before handing back, if the fix touched anything code-adjacent
```

## Output

The `agent-operating-contract` report: every file changed and which `DC-NN` finding it closed
under `Changed:`; the final `just docs-check` output (pasted, not paraphrased) under
`Verification:`; any finding left red because it belongs to another write set (named) or needs a
human-authorized `CLAUDE.md`/SPINE/doc-15 change (the proposal file path, not an applied edit)
under `Noticed but not touched:` or `Blockers:`.

Done checklist: `just docs-check` exit 0 for every check this skill's write set can affect · no
edit outside `docs/modules/**`, `docs/adr/README.md`, `PROGRESS.md`, `planning/PROGRESS.md`, a
phase file's task-state column, or a new proposal file · no `CLAUDE.md`/SPINE/doc-15/ADR-body edit
· a `Suggested PROGRESS.md line` even when another agent applies it.

## Stop / escalation

- A fix requires editing `CLAUDE.md`, `planning/SPINE.md`, or `planning/15-*.md` → write the
  proposal under `.claude/plans/` and stop; never apply it directly.
- A finding is in a skill, agent or rule file (DC-05, DC-06, DC-07, DC-08 README rows, or a DC-09 /
  DC-10 / DC-11 hit under `.agents/skills/**`, `.claude/agents/**`, `.claude/rules/**`) → the
  enforcement layer belongs to the main session with a human; report it with the exact fix, do not
  edit it.
- The module's engineer runs in the same wave → wait for the next wave; never edit its contract in
  parallel.
- The doc drift traces back to code that has not actually landed yet (e.g. a module contract
  finding for a PR still in flight) → the owning module's engineer lands their change first; do
  not describe code that does not exist.
- A `docs-check` finding looks wrong (a false positive in `scripts/docs/**` itself) → that is
  `tooling-ci` territory; report the suspected bug, do not patch the checker from here.
- Auth, consent, deletion, or webhook code changed and its module contract needs a security note →
  flag for `security-privacy-review` before the doc edit ships, rather than writing around it.

## Overlap

Adjacent: the module skills (`backend-module`, `recommendation-rules`, `entitlements-billing`,
`api-contract-change`, `db-migration`, …) make the code/schema/contract change first — this skill
only syncs the description of a change that already landed. `architecture-review` reviews a diff
for boundary violations, a different question from "does the doc match the code". `tooling-ci`
owns `scripts/docs/docs-check.sh` itself, the `just` recipe catalog, and CI wiring — a broken check
or missing recipe is its bug, not a doc-content fix. `testing-regression` owns test coverage and
regression fixes, never doc content. `cross-platform-feature` hands this skill the lanes'
suggested PROGRESS lines at close-out. This skill owns `docs/adr/README.md`, the two `PROGRESS.md`
files and phase task-state columns, and shares `docs/modules/**` with each module's engineer
(wave-serialized); it owns no SPINE module (`metadata.modules` is empty).
