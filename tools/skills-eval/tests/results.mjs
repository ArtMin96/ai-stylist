// Synthetic result documents in the shape of the runner's `--json` file, for the skills-eval
// tests. Every number is made up and no response text is included.

/** One run as the runner records it; `extra` overrides fields. */
export function run(score, extra = {}) {
  return {
    score,
    turns: 3,
    costUsd: 0.2,
    judgeCostUsd: 0.01,
    durationSeconds: 20,
    error: null,
    skippedPaidGraders: false,
    graders: [{ name: 'skill-fired', passed: score > 0, scored: false }],
    ...extra,
  };
}

const baseline = (score) => run(score, { costUsd: 0.1, graders: [] });

function document(cases, extra) {
  return {
    schemaVersion: 1,
    claudeVersion: '2.1.296',
    durationSeconds: 60,
    costUsd: 1.5,
    partial: false,
    cases,
    ...extra,
  };
}

/**
 * Two tasks, two runs per arm. Scores with the skill: 1, 1, 1, 0.5. Without: 0.5, 0.5, 0.25, 0.
 * Per-task differences: 0.5 and 0.625.
 */
export function taskResult(extra = {}) {
  const cases = [
    {
      name: 'task-01',
      maxTurns: 15,
      arms: { with: [run(1), run(1)], without: [baseline(0.5), baseline(0.5)] },
    },
    {
      name: 'task-02',
      maxTurns: 15,
      arms: { with: [run(1), run(0.5)], without: [baseline(0.25), baseline(0)] },
    },
  ];
  return document(cases, extra);
}

/** One task, two runs per arm: 1 and 0.5 with the skill, 0.5 and 0.5 without. */
export function oneTaskResult(extra = {}) {
  const arms = { with: [run(1), run(0.5)], without: [baseline(0.5), baseline(0.5)] };
  return document([{ name: 'task-01', maxTurns: 15, arms }], extra);
}

/**
 * Three queries in one arm. Should trigger: 2 of 2, then 1 of 2 with a third run that errored.
 * Should not trigger: 4 of 4, the last of them with as many `turns` as its `maxTurns` and no error.
 */
export function triggerResult(extra = {}) {
  const timedOut = run(0, { error: 'timed out after 180s' });
  const manyTurns = run(1, { turns: 4 });
  const cases = [
    { name: 'trigger-01-yes', maxTurns: 4, arms: { with: [run(1), run(1)] } },
    { name: 'trigger-02-yes', maxTurns: 4, arms: { with: [run(1), run(0), timedOut] } },
    { name: 'trigger-03-no', maxTurns: 4, arms: { with: [run(1), run(1), run(1), manyTurns] } },
  ];
  return document(cases, extra);
}

/** Two queries, three runs each; `passed` of the six runs route as expected. */
export function twoQueryResult(passed, extra = {}) {
  const scores = [0, 1, 2, 3, 4, 5].map((i) => (i < passed ? 1 : 0));
  const cases = [
    { name: 'trigger-01-yes', maxTurns: 4, arms: { with: scores.slice(0, 3).map((s) => run(s)) } },
    { name: 'trigger-02-no', maxTurns: 4, arms: { with: scores.slice(3).map((s) => run(s)) } },
  ];
  return document(cases, extra);
}
