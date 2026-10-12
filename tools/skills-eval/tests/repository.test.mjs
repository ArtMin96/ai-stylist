// `just skills-eval --generate-only` on this repository's own skills, CLAUDE.md and HEAD, run in
// process: every skill and mode is generated into a temporary directory and nothing is run. A
// unit the tool refuses (an eval file it cannot use) is reported, not failed: what the eval files
// may hold is not this suite's rule. Every case that is generated must be one the runner loads.
// Run by scripts/test/skills-eval.test.sh.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { planInvocation, runInvocation } from '../invocation.mjs';
import { listSkills, readSkillStep } from '../plugin.mjs';
import { assertLoadableCase, readCaseDir } from './case-format.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..', '..');
const SCRATCH = realpathSync(mkdtempSync(path.join(tmpdir(), 'skills-eval-repository-')));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

test('every skill of this repository generates cases the runner loads, in both modes', (t) => {
  const runDir = path.join(SCRATCH, 'run');
  const options = {
    root: REPO,
    skill: 'all',
    mode: 'all',
    generateOnly: true,
    force: false,
    runs: 3,
    concurrency: 3,
    maxCostUsd: 5,
    model: 'model-x',
    effort: 'high',
  };
  const context = {
    options,
    skills: listSkills(REPO),
    skillStep: readSkillStep(REPO),
    board: {},
    boardFile: path.join(SCRATCH, 'scoreboard.json'),
    layout: { runDir, snapshotFile: path.join(runDir, 'snapshot.tar') },
    gitSha: 'not recorded',
    uncommitted: [],
    cliVersion: null,
    startedAt: new Date(),
  };
  const rows = runInvocation(context, planInvocation(context));
  assert.equal(rows.length, context.skills.length * 2);

  const counts = { triggers: 0, tasks: 0 };
  for (const row of rows.filter((each) => each.status === 'generated')) {
    const plugin = path.join(runDir, `${row.skill}-${row.mode}`, 'plugin');
    const names = readdirSync(path.join(plugin, 'evals'));
    assert.equal(names.length, row.caseCount, `${row.skill} ${row.mode}`);
    for (const name of names) assertLoadableCase(readCaseDir(path.join(plugin, 'evals', name)));
    counts[row.mode] += names.length;
    if (row.mode === 'triggers') continue;
    // The copy of the skill names its own files by where they are, never by the repository path.
    const copy = path.join(plugin, 'skills', row.skill);
    for (const entry of readdirSync(copy, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const text = readFileSync(path.join(entry.parentPath, entry.name), 'utf8');
      assert.ok(!text.includes(`.agents/skills/${row.skill}/`), `${row.skill}: ${entry.name}`);
    }
  }
  const refused = rows.filter((row) => row.status !== 'generated');
  for (const row of refused) t.diagnostic(`refused: ${row.skill} ${row.mode}: ${row.note}`);
  assert.ok(counts.triggers > 0 && counts.tasks > 0, JSON.stringify(counts));

  const firstTasks = rows.find((row) => row.mode === 'tasks' && row.status === 'generated');
  const configFile = path.join(runDir, `${firstTasks.skill}-tasks`, 'run-config.json');
  const { scaffold } = JSON.parse(readFileSync(configFile, 'utf8'));
  const megabytes = (scaffold.snapshotBytes / 1e6).toFixed(1);
  const made = `${counts.triggers} trigger cases and ${counts.tasks} task cases`;
  t.diagnostic(`${context.skills.length} skills: ${made}, ${refused.length} units refused`);
  t.diagnostic(`scaffold: ${scaffold.entries} entries, ${megabytes} MB, ${scaffold.seconds} s`);
  // The runner refuses a workspace of more than 200 000 entries (Claude Code 2.1.296), and kills
  // a scaffold after 120 s; the tool itself refuses one that takes more than 30 s.
  assert.ok(scaffold.entries > 0 && scaffold.entries < 200_000, `${scaffold.entries} entries`);
  assert.ok(!existsSync(context.boardFile), 'generation wrote a scoreboard');
});
