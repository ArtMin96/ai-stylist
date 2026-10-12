# tools/skills-eval — score the skill eval files (`just skills-eval`)

`skills-eval.mjs` turns the eval files every skill already has into cases for Claude Code's eval
runner, `claude plugin eval` (Claude Code 2.1.269 or newer), runs them and keeps the scores in
`scoreboard.json`. The eval files stay the source of truth:
`.agents/skills/<skill>/evals/evals.json` and `.agents/skills/<skill>/evals/trigger-evals.json` are
read as they are, and the cases are generated again on every run. Node built-ins only.

One command does the whole job, and running it again continues where the last run stopped:

```sh
just skills-eval                           # every skill, both modes: only what changed is scored
just skills-eval code-quality              # one skill, both modes
just skills-eval code-quality triggers     # one skill and mode (`all` as the skill = every skill)
just skills-eval --max-cost-usd 20         # a larger budget for this invocation
just skills-eval code-quality --force      # score it again although it is up to date
just skills-eval --generate-only           # write every case and the estimates, run nothing
```

A run calls the model on your own credential and costs money. It is a developer command: no other
recipe calls it, and it is not part of `just ci-parity` or of CI.

## One invocation

A unit is one skill in one mode. An invocation works through its units in a fixed order: all
`triggers` by skill name, then all `tasks` by skill name. Each unit ends in one of these states:

- `up to date`: the hash of its inputs equals the hash of its stored score, measured with the same
  model, judge and effort. It is not run. `--force` runs it anyway.
- `scored now`: it ran, the result was complete, and its score is in the scoreboard.
- `scored now, not stored`: it ran, but the result is not a full measurement (`--case`, fewer
  runs than the default of its mode, or a case without a scored run). It is printed only.
- `not run: budget`: its estimated cost does not fit in what is left of `--max-cost-usd` once the
  runs in flight are held back (below). The invocation goes on to the next unit that fits.
- `failed`: its eval file cannot be used, or the runner failed or returned a partial result. After
  a runner failure nothing else is started (`not run: after the failure`): a cost ceiling, a
  sign-in or a rate limit would meet the next unit too.

`--max-cost-usd` is one budget for the whole invocation (its default is `DEFAULTS.maxCostUsd` in
`skills-eval.mjs`). Before a unit runs, its cost is estimated as cases x runs x the cost of one
case run (with `--case`, only the cases it selects): from its own last score, else from the mean
of the stored scores of that mode, else from a constant (`UNRECORDED_CASE_RUN_USD` in
`scoreboard.mjs`, see "What a run costs").

The runner checks its own cost ceiling only before it starts a run, so the runs in flight when
the ceiling is crossed come on top of it: 2.93 was spent against a ceiling of 2.50 in the first
smoke. The tool therefore holds back the estimated cost of the runs that can be in flight
(`--concurrency` case runs, or all of them when the unit has fewer) and gives the runner the rest
as its ceiling (`runnerBudget` in `scoreboard.mjs`). A unit runs only when its estimate fits under
that ceiling: above it the runner would stop before the last runs, and a partial result is paid
for and never stored. What a unit spent, a partial one too, is taken from what is left. The
budget holds as long as a run in flight costs no more than the estimate of one case run.

The closing table lists every unit with its score, 95% interval, state and cost, then the totals,
the pooled trigger pass rate when several skills' triggers ran, and what is left. A score beside
`not run` or `failed` is the last stored one.

## What a run costs

List price, measured on 2026-10-12 with `code-quality`, `claude-opus-5-5`, effort `high` and
Claude Code 2.1.296. Every case ran once, so none of these numbers has an interval.

- `triggers`, all 20 queries at one turn and one run each, 3 at once: 0.1068 per run (0.1041 to
  0.1120), 2.14 in all, in 25 s. An earlier smoke at 4 turns cost 0.195 per run.
- `tasks`, one case (task 1) in both arms: 0.405 with the skill and 0.422 without, 0.827
  together, in 79 s. An earlier pilot of 24 runs in an empty workspace cost 0.216 and 0.125 per
  run. A run now starts from the repository snapshot and reads it. Not measured again since the
  snapshot lost the nested `.agents` directories.

From these, at the default runs: the triggers of one skill (20 queries) cost about 2.14 and its
tasks (3 tasks, 3 runs, both arms) about 7.47, and the runs held back for the ceiling come on top
when a unit is fitted into the budget (0.33 and 2.49). A unit that does not fit is left as
`not run: budget`, and the closing line names the `--max-cost-usd` that the largest one needs.

## The scoreboard

`scoreboard.json` is tracked. Per skill and mode it holds `current` and, beside it, `previous`:
the score, its 95% interval, `n` (scored runs), cases, runs, model, judge model, effort, Claude
Code version, git SHA, date, the list-price cost, the cost of one case run, and the hash. For
`tasks` the score is the mean run score with the skill, and `withoutSkill` holds the baseline.
For `triggers` it is the pass rate. Only a complete result is stored: never a partial one, a
failed runner, a `--case` subset, a result with fewer runs per case than the default of its mode
(`DEFAULT_RUNS` in `scoreboard.mjs`), or one with a case that has no scored run. Commit the file
with the change that moved the score.

The hash is taken from the working tree:

- `tasks`: every file of `.agents/skills/<skill>/` except its trigger queries, the system prompt
  the runs get, and `GENERATOR_VERSION` (`cases.mjs`).
- `triggers`: the skill's `trigger-evals.json`, the `name` and `description` of every skill
  (routing weighs them all), the system prompt, and `GENERATOR_VERSION`.

When a unit is scored again after its hash changed, the note under the table gives the old and the
new score and one verdict: `better`, `worse`, or `no measurable change` when the difference is not
larger than the two 95% intervals combined (the root of their summed squares). That is the noise
rule of planning/13 §10.

## Modes

`tasks` reads `evals/evals.json` and compares the skill with no skill (`--ablation with-without`).

- The plugin holds only that skill: a copy of `.agents/skills/<skill>/` without `evals/`. In the
  copy, `.agents/skills/<skill>/` is replaced by the absolute path of the copy, because the
  repository path does not exist in a run's workspace. The source skill is never changed.
- One case per task: the prompt as written, the tools `Read`, `Glob`, `Grep` and `Skill`, 15 turns,
  600 s. Every run is also told step 3 of "Session workflow" from the root `CLAUDE.md` (read at
  generation time, so there is one source) and that it cannot edit files or run commands.
- One `llm` grader per assertion (`graders/check-NN.md`): PASS when the statement is true of the
  reply. An assertion that names `.agents/skills/<skill>/` is `arm: with-only`, because only a run
  that has the skill can meet it, and its rubric says where that directory is in the run. Such a
  grader, and the `skill-fired` grader (a `Skill` call for this skill), is shown as an indicator
  and left out of the score.
- Each run starts from a snapshot of the tracked files at `HEAD` without any directory named
  `.agents` or `.claude`, at any depth, so the run without the skill cannot read the skill, or an
  older copy of it such as `planning/.agents/skills/`, from disk. An invocation writes one tar,
  and each case's `scaffold.sh` unpacks it. The script is run once in an empty directory first,
  and the time is printed (the runner allows 120 s, the tool refuses over 30 s).
- A task with a non-empty `files` list is refused: the snapshot is the only workspace.

`triggers` reads `evals/trigger-evals.json` and has one arm (`--ablation none`).

- The plugin holds every skill under `.agents/skills/`, copied the same way.
- One case per query: only the `Skill` tool, 1 turn, 180 s, and the same step 3 text. Routing is
  the first assistant turn: the skill is called in it or it is not. The turn cap then ends the
  run with the error `Reached maximum number of turns`, which is how a trigger run is meant to
  end: the runner still grades it, and its verdict counts. Any other error leaves a run out.
- One `tool_used` grader: `should_trigger: true` needs a `Skill` call for the skill, `false` needs
  none. The case name ends in `-yes` or `-no`.
- A skill that is loaded only after another one, in a later turn, counts as not called.

## Options

- `--force`: score what is selected even when it is up to date.
- `--max-cost-usd <n>`: the budget of the invocation (default: `DEFAULTS.maxCostUsd` in
  `skills-eval.mjs`). The total stays at or under it, on the one condition named under "One
  invocation".
- `--runs <n>`: runs per case and arm, 1 to 50, for both modes. The default is 3 for `tasks` and
  1 for `triggers`: a task score needs repeats of each case, a trigger pass rate gets its
  resolution from the number of queries, pooled over the skills. A result with fewer runs than
  the default of its mode is never stored.
- `--effort <level>`: `low`, `medium`, `high`, `xhigh` or `max` (default `high`). The runner has no
  effort flag, so the tool exports `CLAUDE_CODE_EFFORT_LEVEL` for it and drops `CLAUDE_EFFORT`.
- `--model <id>`: the model under test (default `claude-opus-5-5`, `DEFAULT_MODEL` in
  `skills-eval.mjs`).
- `--judge-model <id>`: the model of the `llm` graders (default: the runner's own). Never the model
  under test (planning/13 §10).
- `--concurrency <n>`: runs at once, 1 to 8 (default 3). They share your rate limit.
- `--case <glob>`: only the cases whose name matches, for example `task-01`. It needs one skill
  and one mode, and its result is never stored.
- `--generate-only`: write the run directory and stop. Nothing runs and `claude` is not needed.

The tool always passes `--no-publish` (the report quotes this private repository and stays on this
machine), `--trust-plugin` and `--threshold 0` (a low score is the measurement, not a failure), and
never `--keep-temp`.

## The run directory

`artifacts/skills-eval/<UTC time>-<skill or all>-<mode or all>/` (gitignored) holds everything an
invocation writes besides the scoreboard:

- `summary.txt`: the closing table;
- `snapshot.tar`: the repository snapshot, when a `tasks` unit was generated;
- `<skill>-<mode>/` per unit that was generated: `plugin/` (the cases are under `plugin/evals/`),
  `result.json` and `report.html` from the runner, `summary.txt` (the unit's own summary) and
  `run-config.json`: skill, mode, hash, model, judge model, effort, runs, the budget and the
  ceiling it ran under, Claude Code version, git SHA, time, the scaffold check and the exact
  runner command. `uncommittedSources` lists the skill files and `CLAUDE.md` when they differ
  from that commit, because a run reads them from the working tree.

## A unit's summary

Every number comes from the runs the runner scored in full. A run that errored, or whose judges
were skipped at the cost ceiling, is listed at the end and never averaged in. The runs that the
turn cap ended (`Reached maximum number of turns`) are counted on the last line. For `tasks` they
are among the errored runs and are named: when there are any, raise `max_turns` in `cases.mjs`.
For `triggers` they are the normal case and are counted in. The runner's `turns` field is not
used for this. It also counts tool results, and passes `max_turns` in runs that were never cut
off.

- `tasks`: the mean score per task and arm; the mean run score per arm with its 95% interval; the
  difference with its interval twice, once with runs as the sample (unpooled standard error, df
  from the smaller arm) and once with cases as the sample (one difference per task). The line says
  `INSIDE its interval` when the difference is not larger than the interval: that is a tie.
- `triggers`: the pass rate overall, for should-trigger and for should-not-trigger queries, each
  with `N` (scored runs), `n` (cases) and the half-width `1.96 * sqrt(p(1 - p) / N)`. At a rate of
  0 or 1 the line gives the rule-of-three bound `3 / N` instead.
- The mean cost per run, per arm.

Exit 0 when nothing failed (units left by the budget are not a failure), 1 when the invocation is
refused or a unit failed, 2 for a usage error. The invocation is refused when `claude` is needed
and missing or older than 2.1.269, when the skill does not exist, and when `CLAUDE.md` has lost
step 3.

## What a run does not have

- The repository's rules, hooks and other skills are not loaded: `.claude/` and `.agents/` are not
  in the snapshot, and the runner gives each run its own empty home and configuration. The
  runner's guide (<https://code.claude.com/docs/en/plugin-evals.md>, "What a run can access") says
  that no user or project settings, hooks, memory or `CLAUDE.md` are loaded, not even a
  `CLAUDE.md` that a scaffold script wrote. Step 3 of the session workflow reaches a run through
  the system prompt. The root `CLAUDE.md` is in the snapshot as a file a run can read: in the
  2026-10-12 smoke the run without the skill quoted it. A run's transcript is removed with its
  temporary directory, so whether that run read the file or was given it could not be checked.
- No toolchain and no write access: a task run can read and search, nothing else.
- The judges' reasoning is not recorded, only their votes; there are no custom-code graders.

## Tests

`scripts/test/skills-eval.test.sh` runs `tests/*.test.mjs` with `node --test`. The tool runs on
throwaway git checkouts with synthetic skills, and `claude` is a stub on a scratch `PATH`
(`tests/claude-stub.mjs`), so no model is called. `tests/case-format.mjs` holds every generated
file to the keys the runner accepts. `tests/repository.test.mjs` generates every skill of this
repository in both modes into a temporary directory and times the scaffold.
