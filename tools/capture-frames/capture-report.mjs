#!/usr/bin/env node
// Writes a capture simulator run's summary.md and adds its row to the scoreboard (capture brief §0
// finish line, §11, §12; tools/capture-frames/README.md "Simulator runs"). Reads what
// capture-score.mjs and capture-sim.sh left in the run folder:
//   results/<platform>.summary.json        the scored sweep
//   results/<platform>.info.md             optional notes (e.g. Android's live ML Kit sweep)
//   maestro/<platform>/<theme>/<flow>.status   the flow's exit code
//   screenshots/<platform>/<theme>/*.png   the flows' screenshots
//
// Usage: node tools/capture-frames/capture-report.mjs --run <dir> --scoreboard <file> --commit <sha>
//          --platforms ios[,android]
// Exit: 0 every platform met the finish line, 1 one did not, 2 a usage error.
// Node built-ins only.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const THEMES = ['light', 'dark'];
const MAX_FALSE_LOCK_SHARE = 0.1;

const DEFINITIONS = `## Definitions

- **Case**: one played segment. A single set is one case; a sweep or batch set is one case per
  segment (\`<set id>-sNN\`).
- **Expected**: the segment's \`expected.json\` with \`platform.<platform>\` applied first.
- **Miss**: a case expected to unlock that never unlocks within \`maxUnlockMs\`.
- **False lock**: a case expected to unlock that goes from unlocked straight back to locked (not
  through capturing). The rate is false-lock cases ÷ should-unlock cases; the finish line is ≤ 10 %.
- **False unlock**: a case expected to stay locked that unlocks or auto-captures. The most serious
  failure, listed on its own; it must be 0.
- **Gap** (sweep and batch): the 1 s of empty background between items. It passes when the shutter
  is locked (or in cooldown) within \`relockAfterFailingEvaluations × evaluation.intervalMs\` of the
  gap's start, stays locked, and nothing is captured. Its hint and "Take photo anyway" are not
  judged: the gap is shorter than the anyway delay.
- **"Take photo anyway" timing**: measured on single locked sets only, from the segment's first
  frame on the harness's virtual clock; wanted 10 000 ms ± 500 ms. With the screen-reader flag it
  must show within one evaluation interval of the start.
- **Item** (sweep and batch): unlocks within \`maxUnlockMs\` and captures at least once.
`;

const DEVICE_ONLY = `## Device-only (never claimed here)

- The real camera, its preview and photo capture (C1–C26 on hardware); torch (C13).
- iOS Vision foreground instance mask on live video; the Simulator reads the stored masks.
- Live body pose on real bodies (iOS Vision, Android ML Kit Pose); the runs feed the keypoint files.
- Android live ML Kit object detection quality: the scored run uses stored boxes; any live sweep is
  information only.
- Device motion and tilt hints (phones only), hardware shutter buttons on iOS (C26), real
  VoiceOver/TalkBack (C25), heat (C30), low-end phones (C28, C29), no Google Play (C31).
- The system photo picker driven by hand (C21).
`;

function fail(message) {
  process.stderr.write(`capture-report: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail(`bad argument '${argv[i]}'`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of ['run', 'scoreboard', 'commit', 'platforms']) {
    if (!args[key]) fail(`--${key} is required`);
  }
  return args;
}

function list(dir, suffix) {
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith(suffix))
        .sort()
    : [];
}

function flowsOf(run, platform) {
  const flows = new Map();
  for (const theme of THEMES) {
    for (const file of list(path.join(run, 'maestro', platform, theme), '.status')) {
      const flow = file.replace(/\.status$/, '');
      const code = readFileSync(path.join(run, 'maestro', platform, theme, file), 'utf8').trim();
      flows.set(flow, {
        ...flows.get(flow),
        [theme]: code === '0' ? 'pass' : `fail (exit ${code})`,
      });
    }
  }
  return flows;
}

function platformVerdict(summary, flows, shots) {
  const problems = [];
  if (summary.failures.length > 0) problems.push(`${summary.failures.length} failing case(s)`);
  if (summary.misses.length > 0) problems.push(`${summary.misses.length} miss(es)`);
  if (summary.falseLocks.length > MAX_FALSE_LOCK_SHARE * summary.shouldUnlock)
    problems.push('false locks over 10 %');
  if (summary.falseUnlocks.length > 0)
    problems.push(`${summary.falseUnlocks.length} false unlock(s)`);
  const { minMs, maxMs, atMs, toleranceMs } = summary.anyway;
  if (minMs == null || minMs < atMs - toleranceMs || maxMs > atMs + toleranceMs)
    problems.push('anyway timing');
  if (
    summary.screenReader.total === 0 ||
    summary.screenReader.passed < summary.screenReader.total
  ) {
    problems.push('screen-reader anyway');
  }
  if (flows.size === 0) problems.push('no Maestro flows ran');
  for (const [flow, themes] of flows) {
    for (const theme of THEMES) {
      if (themes[theme] !== 'pass')
        problems.push(`flow ${flow} ${theme}: ${themes[theme] ?? 'not run'}`);
    }
  }
  for (const theme of THEMES) {
    if (shots[theme].length === 0) problems.push(`no ${theme} screenshots`);
  }
  return problems;
}

function section(run, platform) {
  const file = path.join(run, 'results', `${platform}.summary.json`);
  if (!existsSync(file))
    return {
      text: `## ${platform}\n\nNot run: no scored results.\n`,
      problems: ['not run'],
      row: null,
    };
  const summary = JSON.parse(readFileSync(file, 'utf8'));
  const flows = flowsOf(run, platform);
  const shots = Object.fromEntries(
    THEMES.map((theme) => [theme, list(path.join(run, 'screenshots', platform, theme), '.png')]),
  );
  const problems = platformVerdict(summary, flows, shots);
  const share = summary.shouldUnlock
    ? ((100 * summary.falseLocks.length) / summary.shouldUnlock).toFixed(1)
    : '0.0';
  const { minMs, maxMs, meanMs, count } = summary.anyway;
  const anyway = count ? `${minMs}–${maxMs} ms (mean ${meanMs}, n=${count})` : 'none measured';
  const reader = `${summary.screenReader.passed}/${summary.screenReader.total} (at ${summary.screenReader.anywayMs.join(', ')} ms)`;
  const info = path.join(run, 'results', `${platform}.info.md`);
  const lines = [
    `## ${platform}`,
    '',
    `**Verdict: ${problems.length === 0 ? 'PASS' : `FAIL — ${problems.join('; ')}`}**`,
    '',
    `| Measure | Result |`,
    `|---|---|`,
    `| Cases passed | ${summary.passed}/${summary.total} |`,
    `| Misses | ${summary.misses.length} |`,
    `| False locks | ${summary.falseLocks.length}/${summary.shouldUnlock} (${share} %) |`,
    `| False unlocks | ${summary.falseUnlocks.length} |`,
    `| "Take photo anyway" | ${anyway}; wanted ${summary.anyway.atMs} ± ${summary.anyway.toleranceMs} ms |`,
    `| Screen reader: anyway at once | ${reader} |`,
    `| Screenshots | light ${shots.light.length}, dark ${shots.dark.length} |`,
    '',
    '### Maestro flows',
    '',
    '| Flow | light | dark |',
    '|---|---|---|',
    ...[...flows].map(
      ([flow, themes]) =>
        `| ${flow} | ${themes.light ?? 'not run'} | ${themes.dark ?? 'not run'} |`,
    ),
    '',
    '### Failures',
    '',
    ...(summary.failures.length
      ? summary.failures.map((f) => `- \`${f.caseId}\`: ${f.reason}`)
      : ['None.']),
    '',
    ...(summary.misses.length
      ? ['### Misses', '', ...summary.misses.map((id) => `- \`${id}\``), '']
      : []),
    ...(summary.falseUnlocks.length
      ? ['### False unlocks', '', ...summary.falseUnlocks.map((id) => `- \`${id}\``), '']
      : []),
    ...(existsSync(info) ? [readFileSync(info, 'utf8').trim(), ''] : []),
  ];
  const row = `${summary.passed}/${summary.total}, misses ${summary.misses.length}, false locks ${share} %, false unlocks ${summary.falseUnlocks.length}, anyway ${count ? `${minMs}–${maxMs}` : '—'} ms, reader ${summary.screenReader.passed}/${summary.screenReader.total}`;
  return { text: lines.join('\n'), problems, row };
}

const SCOREBOARD_HEAD = `# Capture camera scoreboard

One row per \`just capture-sim*\` run (capture brief §0 finish line). Run folders:
\`artifacts/capture-camera/runs/<yyyy-mm-dd-hhmm>/summary.md\`.

## Runs

| Run | Commit | iOS | Android | Verdict |
|---|---|---|---|---|
`;

const SCOREBOARD_TAIL = `
## BLOCKED cases

None yet.

## Threshold and harness changes (old → new, reason)

None yet.
`;

function addScoreboardRow(file, row) {
  let text = existsSync(file) ? readFileSync(file, 'utf8') : SCOREBOARD_HEAD + SCOREBOARD_TAIL;
  const lines = text.split('\n');
  const header = lines.findIndex((line) => line.startsWith('| Run |'));
  if (header < 0) fail(`${file} has no runs table`);
  let end = header + 2;
  while (end < lines.length && lines[end].startsWith('|')) end += 1;
  lines.splice(end, 0, row);
  text = lines.join('\n');
  writeFileSync(file, text);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const platforms = args.platforms.split(',');
  const runName = path.basename(args.run);
  const sections = Object.fromEntries(
    platforms.map((platform) => [platform, section(args.run, platform)]),
  );
  const passed = platforms.every((platform) => sections[platform].problems.length === 0);
  const headline = platforms
    .map(
      (platform) =>
        `${platform}: ${sections[platform].problems.length === 0 ? 'PASS' : 'FAIL'}${sections[platform].row ? ` (${sections[platform].row})` : ''}`,
    )
    .join(' · ');
  const summary = [
    `# Capture simulator run ${runName}`,
    '',
    `Commit \`${args.commit}\`. ${headline}`,
    '',
    ...platforms.map((platform) => sections[platform].text),
    DEFINITIONS,
    DEVICE_ONLY,
  ].join('\n');
  writeFileSync(path.join(args.run, 'summary.md'), summary);
  const cell = (platform) =>
    platforms.includes(platform) ? (sections[platform].row ?? 'not run') : '—';
  addScoreboardRow(
    args.scoreboard,
    `| ${runName} | \`${args.commit}\` | ${cell('ios')} | ${cell('android')} | ${passed ? 'PASS' : 'FAIL'} |`,
  );
  process.stdout.write(`capture-report: ${path.join(args.run, 'summary.md')} — ${headline}\n`);
  process.exit(passed ? 0 : 1);
}

main();
