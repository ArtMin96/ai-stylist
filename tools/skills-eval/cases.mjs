// The case files `just skills-eval` generates for `claude plugin eval`, as text: one case per task
// of a skill's evals/evals.json (mode `tasks`) or per query of its evals/trigger-evals.json (mode
// `triggers`). Pure builders with no I/O; plugin.mjs writes what they return. The case format
// (prompt.md frontmatter, case.yaml, graders/<name>.md) is the runner's:
// https://code.claude.com/docs/en/plugin-evals.md. Node built-ins only.

/** Input this tool refuses to work with; the message is printed as is and the exit code is 1. */
export class RefusalError extends Error {}

/**
 * Bump when a change in this file can move a score: a prompt part, a tool list, a limit, a
 * grader. The scoreboard hashes it, so every stored score then counts as out of date.
 */
export const GENERATOR_VERSION = 3;

const WORKFLOW_HEADING = '## Session workflow';
const SKILL_STEP_MARKER = '3. **Match a skill:**';
/** Tasks run with read-only tools, so the prompt says how to answer where a session would edit. */
export const READ_ONLY_NOTE =
  'You cannot edit files or run commands in this environment. Show any file you would write in ' +
  'full in your reply, and name the checks you would run.';
const TASK_TOOLS = ['Read', 'Glob', 'Grep', 'Skill'];
const TASK_LIMITS = { max_turns: 15, timeout_seconds: 600 };
// A routing answer is the first assistant turn: the Skill tool is called in it or it is not. The
// turn cap then ends the run, which is how a trigger run is meant to end (summary.mjs counts its
// verdict). What a run does after that turn costs money and tells nothing about routing.
const TRIGGER_LIMITS = { max_turns: 1, timeout_seconds: 180 };
const NEVER_CALLED = { min: 0, max: 0 };
const VERDICT =
  'PASS if the statement is true of the response. FAIL if it is false or the response is empty.';
const SAME_FILE =
  'A reference to a file under either path, or to that file by its name, is the same file.';

const padded = (number) => String(number).padStart(2, '0');

/**
 * The name of the case generated for one entry of an eval file: a task (`tasks`), or the query at
 * `index` (from 1) of the trigger queries. It is what the runner's `--case` glob is matched on.
 */
export function caseName(mode, entry, index) {
  if (mode === 'tasks') return `task-${padded(entry.id)}`;
  return `trigger-${padded(index)}-${entry.should_trigger ? 'yes' : 'no'}`;
}

/** A word that is safe to paste into a shell command line. */
export function shellQuote(word) {
  if (/^[\w@%+=:,./-]+$/.test(word)) return word;
  return `'${word.replaceAll("'", `'\\''`)}'`;
}

/** The lines below a `## ` heading, up to the next one. */
function sectionLines(lines, heading) {
  const start = lines.indexOf(heading);
  if (start === -1) return [];
  const body = lines.slice(start + 1);
  const length = body.findIndex((line) => line.startsWith('## '));
  return length === -1 ? body : body.slice(0, length);
}

/**
 * Step 3 of "Session workflow" in the root CLAUDE.md, as one line without its list number. It is
 * the one place that tells an agent to match a skill, so the cases quote it and never copy it.
 * Throws a RefusalError when the step is not there.
 */
export function skillStepText(claudeMd) {
  const section = sectionLines(claudeMd.split('\n'), WORKFLOW_HEADING);
  const start = section.findIndex((line) => line.startsWith(SKILL_STEP_MARKER));
  if (start === -1) {
    const wanted = `"${SKILL_STEP_MARKER}" under "${WORKFLOW_HEADING}"`;
    throw new RefusalError(`CLAUDE.md: no list item ${wanted}`);
  }
  const rest = section.slice(start + 1);
  const length = rest.findIndex((line) => line.trim() === '' || /^\d+\. /.test(line));
  const item = [section[start], ...(length === -1 ? rest : rest.slice(0, length))];
  const text = item.map((line) => line.trim()).join(' ');
  return text.slice(text.indexOf(' ') + 1);
}

/** What every run of a mode is told on top of its prompt; `skillStep` is skillStepText(). */
export function systemPromptFor(mode, skillStep) {
  return mode === 'tasks' ? `${skillStep}\n\n${READ_ONLY_NOTE}` : skillStep;
}

/** A YAML double-quoted scalar: JSON string syntax is valid YAML, on one line, with `\s` kept. */
const yamlString = (text) => JSON.stringify(text);

/** A YAML frontmatter block: strings quoted, numbers bare, a list of plain words as a flow list. */
function frontmatter(fields) {
  const lines = Object.entries(fields).map(([key, value]) => {
    if (Array.isArray(value)) return `${key}: [${value.join(', ')}]`;
    return `${key}: ${typeof value === 'string' ? yamlString(value) : value}`;
  });
  return `---\n${lines.join('\n')}\n---\n`;
}

/** The `tool_used` grader on the Skill tool: at least one call for `skill`, or the given bounds. */
function skillGrader(skill, bounds = {}) {
  // The tool input is JSON, and a plugin skill is called as `<plugin>:<skill>` or by its bare name.
  const inputMatch = `"skill"\\s*:\\s*"(?:[\\w-]+:)?${skill}"`;
  return frontmatter({ type: 'tool_used', tool: 'Skill', input_match: inputMatch, ...bounds });
}

/**
 * The `llm` grader for one assertion. An assertion that names the skill's own files can only hold
 * in a run that has the skill, so it is `with-only`: an indicator in a two-arm run, not a score.
 */
function assertionGrader(assertion, skill, skillDir) {
  const ownPath = `.agents/skills/${skill}/`;
  const needsSkill = assertion.includes(ownPath);
  const rubric = [`Statement: ${assertion}`, '', VERDICT];
  // The plugin copy names its files by where they are, so that is the only path a run can cite.
  if (needsSkill) rubric.push('', `In this run \`${ownPath}\` is \`${skillDir}/\`. ${SAME_FILE}`);
  const header = frontmatter(needsSkill ? { type: 'llm', arm: 'with-only' } : { type: 'llm' });
  return `${header}\n${rubric.join('\n')}\n`;
}

function checkTask(task, where) {
  if (Array.isArray(task.files) && task.files.length > 0) {
    const reason = 'every run starts from a snapshot of the repository at HEAD';
    throw new RefusalError(`${where}: a non-empty "files" list is not supported (${reason})`);
  }
  const assertions = Array.isArray(task.assertions) ? task.assertions : [];
  const texts = [task.prompt, ...assertions];
  const complete = texts.every((text) => typeof text === 'string' && text.trim() !== '');
  if (!Number.isInteger(task.id) || assertions.length === 0 || !complete) {
    const needs = 'an integer "id", a "prompt" and at least one assertion, each a non-empty string';
    throw new RefusalError(`${where}: a task needs ${needs}`);
  }
}

/** The bash file a tasks case names as its scaffold_script: run in the run's empty workspace. */
export function scaffoldScript(snapshotFile) {
  const lines = [
    '#!/usr/bin/env bash',
    '# Generated by `just skills-eval`. Fills the empty workspace of one eval run with the tracked',
    '# files of the repository at HEAD, without any .agents/ or .claude/ directory.',
    'set -euo pipefail',
    `tar -xf ${shellQuote(snapshotFile)}`,
  ];
  return `${lines.join('\n')}\n`;
}

const caseYaml = (name) =>
  `schema_version: "1.1"\nname: ${yamlString(name)}\ncontext:\n  scaffold_script: scaffold.sh\n`;

/**
 * One `tasks` case: `{ name, files }`, the files as text keyed by their path in the case
 * directory. `skillDir` is the generated copy of the skill, `systemPrompt` what every run is told
 * on top of the prompt, `scaffold` the scaffold script. Throws a RefusalError for a task this tool
 * cannot run.
 */
export function taskCase({ skill, task, skillDir, systemPrompt, scaffold }) {
  checkTask(task, `.agents/skills/${skill}/evals/evals.json task ${task.id}`);
  const name = caseName('tasks', task);
  const outcome = typeof task.expected_output === 'string' ? task.expected_output : '';
  const header = frontmatter({
    name,
    description: `${skill} evals.json task ${task.id}`,
    ...(outcome === '' ? {} : { expected_outcome: outcome }),
    ...TASK_LIMITS,
    allowed_tools: TASK_TOOLS,
    append_system_prompt: systemPrompt,
  });
  const files = {
    'prompt.md': `${header}${task.prompt}\n`,
    'case.yaml': caseYaml(name),
    'scaffold.sh': scaffold,
    'graders/skill-fired.md': skillGrader(skill),
  };
  task.assertions.forEach((assertion, i) => {
    files[`graders/check-${padded(i + 1)}.md`] = assertionGrader(assertion, skill, skillDir);
  });
  return { name, files };
}

/**
 * One `triggers` case for the query at `index` (from 1) of a skill's trigger-evals.json: the run
 * may only call the Skill tool, and passes when it calls it for `skill` (`should_trigger`) or
 * never does.
 */
export function triggerCase({ skill, index, entry, systemPrompt }) {
  const where = `.agents/skills/${skill}/evals/trigger-evals.json query ${index}`;
  if (typeof entry.query !== 'string' || entry.query.trim() === '') {
    throw new RefusalError(`${where}: "query" must be a non-empty string`);
  }
  if (typeof entry.should_trigger !== 'boolean') {
    throw new RefusalError(`${where}: "should_trigger" must be true or false`);
  }
  const fires = entry.should_trigger;
  const name = caseName('triggers', entry, index);
  const header = frontmatter({
    name,
    description: `${skill} trigger query ${index}: should ${fires ? '' : 'not '}trigger`,
    ...TRIGGER_LIMITS,
    allowed_tools: ['Skill'],
    append_system_prompt: systemPrompt,
  });
  const grader = fires ? 'skill-fired' : 'skill-not-fired';
  const files = {
    'prompt.md': `${header}${entry.query}\n`,
    [`graders/${grader}.md`]: skillGrader(skill, fires ? {} : NEVER_CALLED),
  };
  return { name, files };
}

/** Whether a generated trigger case expects no Skill call for its skill: its name ends in `-no`. */
export const expectsNoTrigger = (caseName) => caseName.endsWith('-no');
