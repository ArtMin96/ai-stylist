# Proposal: `just skills-eval`, one run that scores the skill eval files (owner-approved)

> Status: APPLIED (2026-10-12, at the owner's word). Applied: the tool
> and its tests (`tools/skills-eval/`, `scripts/test/skills-eval.test.sh`), the first doc 15 §5 row
> and the two `code-quality` check repairs (both by the lead), and the `justfile` edits in
> section 5 (by an agent of the lead session, with the paid smoke behind section 4), and the
> replacement doc 15 row in section 2 (approved by the owner after the command changed).
> tooling-engineer did not edit the `justfile`, because its single-writer check found an
> uncommitted `justfile` in `.claude/worktrees/fx-enforcement` (last changed 2026-09-25; the same
> hunks are already on `main`). Written 2026-10-12 by tooling-engineer (main checkout, base d4affb5).

## 1. What was decided

- Skill evals are scored with Claude Code's own runner, `claude plugin eval` (Claude Code 2.1.269+).
- The cases are generated on every run from the files each skill already has,
  `evals/evals.json` and `evals/trigger-evals.json` under `.agents/skills/<skill>/`. Their format,
  the DC-05 check, `templates/skill.md` and the `tools/docs/fixtures/` cases are unchanged.
- One command does the whole job (owner, 2026-10-12: "We always write automation scripts to do
  things in one run"). `just skills-eval` takes every skill in both modes: all `triggers`, then all
  `tasks`, skills by name. A skill and mode whose inputs are unchanged since its last stored score
  is up to date and skipped (`--force` runs it). `--max-cost-usd` is one budget for the
  invocation: what does not fit is left, and running the command again continues.
- `tools/skills-eval/scoreboard.json` (tracked) holds the current and the previous score per skill
  and mode: score, 95% interval, n, runs, model, effort, CLI version, date, cost and a hash of
  what was scored. Only a complete result is stored. A new score is compared with the last one:
  "better", "worse", or "no measurable change" inside the interval (planning/13 §10).
- Output goes to one run directory per invocation under `artifacts/skills-eval/` (gitignored).

## 2. APPLIED: `planning/15-team-workflow-and-ai-agent-operations.md` §5, replace the row

```text
| `just skills-eval [skill] [mode]` | Score the skill eval files with `claude plugin eval` in one run: no argument = every skill in both modes, all `triggers` (`evals/trigger-evals.json` against all skills) then all `tasks` (`evals/evals.json` with and without the skill). A skill and mode whose inputs are unchanged since its last stored score (`tools/skills-eval/scoreboard.json`) is skipped (`--force` runs it); `--max-cost-usd` is one budget for the invocation and what does not fit is left, so running it again continues. A new score is compared with the last one, and a difference inside its interval is "no measurable change". Cases are generated, effort is pinned, the report stays local. Spends model usage; never part of CI |
```

## 3. `.agents/skills/code-quality/evals/evals.json` (applied by the lead)

- Task 2 check 1, reworded. Was: "Flags `any` (and the untyped `unit` parameter) as a blocker with
  `unknown` plus narrowing or a schema as the fix". Now: "Flags `data: any` and the untyped `unit`
  parameter as blockers and replaces each with a precise type (`unknown` plus narrowing, a
  schema-derived type, or a specific parameter type)".
- Task 3 check 5, split in two. Was one check: "`print` is replaced by structured logging that
  does not log the raw path, and validation names `just lint`, `just typecheck` and
  `just test workers`". Now check 5: "`print` is replaced by structured logging that does not log
  the raw path", and check 6: "The report names `just lint`, `just typecheck` and
  `just test workers` as the validation commands".

## 4. How to run it, and what a run costs

```sh
just skills-eval                     # everything that changed, within the budget; run again to continue
just skills-eval code-quality        # one skill, both modes
just skills-eval --generate-only     # free: writes every case and the cost estimates
```

Options, the states of a unit, the scoreboard and the run directory: `tools/skills-eval/README.md`.

Cost, list price, from the paid smokes of 2026-10-12 (`code-quality`, `claude-opus-5-5`, effort
`high`, Claude Code 2.1.296, one run per case, so no interval; $5.89 spent in all):

- `triggers`, as built now (one turn, one run per query): $0.1068 per run over all 20 queries,
  $2.14 in all against `--max-cost-usd 3`, 25 s at 3 runs at once. Pass rate 0.950 (19 of 20):
  9 of 10 should-trigger, 10 of 10 should-not-trigger. It is the first stored score. A first
  smoke at 4 turns cost $0.195 per run and overran its ceiling of 2.50 by $0.43.
- `tasks`, one case in both arms: $0.405 with the skill and $0.422 without it, $0.827 together,
  79 s. The pilot (24 runs, empty workspace) cost $0.216 and $0.125: a run now reads the
  repository snapshot. The smoke is one case and one run per arm, measured before the snapshot
  lost the nested `.agents` directories.

Until a score is stored, the budget uses the constants in `UNRECORDED_CASE_RUN_USD`
(`tools/skills-eval/scoreboard.mjs`): 0.11 per trigger run and 0.83 per task case run. An
estimate at the default runs (1 for triggers, 3 for tasks): 500 queries x 0.107 = about $53 and
76 tasks x 3 x 0.83 = about $189, about $243 for every skill in both modes; one skill with 20
queries and 3 tasks is about $2.14 + $7.47 = $9.61. To fit a unit, the runs that can be in flight
are held back on top of its estimate (3 x 0.11 for triggers, 3 x 0.83 for tasks).

## 5. `justfile` (two edits, applied 2026-10-12)

After the `ml-eval` recipe, a new recipe:

```text
# Score the skill eval files with Claude Code's eval runner `claude plugin eval` in one run (tools/skills-eval/README.md; needs Claude Code 2.1.269+; spends model usage on your own credential, never part of CI): `just skills-eval [skill|all] [tasks|triggers] [--force] [--max-cost-usd N] [--runs N] [--effort low|medium|high|xhigh|max] [--model ID] [--judge-model ID] [--concurrency N] [--case GLOB] [--generate-only]`; no argument = every skill in both modes, all `triggers` (evals/trigger-evals.json against a plugin that holds every skill) before all `tasks` (evals/evals.json with and without the skill), skills by name; a skill and mode whose inputs are unchanged since its last stored score in tools/skills-eval/scoreboard.json is up to date and skipped (`--force` runs it); `--max-cost-usd` is one budget for the invocation (the runner's ceiling is what is left of it minus the runs that can be in flight, so the total stays inside it), what does not fit is left, and running the command again continues; a new score is compared with the last one (better, worse, or no measurable change inside the interval); cases are generated into one run directory per invocation under artifacts/skills-eval/ (gitignored) with result.json, report.html, run-config.json and summary.txt per skill and mode; defaults: 3 runs per case for tasks and 1 for triggers, effort high; the report is never published
skills-eval *args:
    node tools/skills-eval/skills-eval.mjs "$@"
```

In `test-tooling`, one more line (free suite, stub `claude`), and `skills-eval` added to the suite
list in the `test` recipe's comment: `    bash scripts/test/skills-eval.test.sh`

## 6. Not built

- The repository's `CLAUDE.md`, rules and hooks are not loaded in a run; only step 3 of "Session
  workflow" is passed in. No toolchain in the workspace: runs read and search, nothing else.
- No judge reasoning is recorded (votes only), and there are no custom-code graders.
- No full baseline run yet: the scoreboard holds one score, the triggers of `code-quality`.
