#!/usr/bin/env node
// Scores one platform's capture harness results against the frame sets' expected files (capture
// brief §11 "Results log", §12; tools/capture-frames/README.md "Scoring"). One scorer for both apps:
// it reads the iOS line shape (`events[].shutter` = `locked:<reason>`, `anywayMs`) and the Android
// one (`events[].phase`, `anywayAtMs`, `finalLockReason`). Called by capture-sim.sh.
//
// Usage: node tools/capture-frames/capture-score.mjs --platform ios|android --frames <dir>
//          --results <jsonl> [--screen-reader <jsonl>] --out <run dir>
// Writes <run dir>/results/<platform>/<case id>.json (expected, observed, pass, reason) and
// <run dir>/results/<platform>.summary.json for capture-report.mjs.
// Exit: 0 every case passed, 1 a case failed, 2 a usage error or unreadable input.
// Node built-ins only.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const RULES = 'packages/shared-kernel/registry/capture-rules.json';
const LOCKED_STATES = new Set(['locked', 'cooldown', 'warming-up']);

function fail(message) {
  process.stderr.write(`capture-score: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith('--') || argv[i + 1] === undefined) fail(`bad argument '${key}'`);
    args[key.slice(2)] = argv[i + 1];
  }
  for (const key of ['platform', 'frames', 'results', 'out']) {
    if (!args[key]) fail(`--${key} is required`);
  }
  return args;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return fail(`cannot read ${file}: ${error.message}`);
  }
}

function readLines(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    return fail(`cannot read ${file}: ${error.message}`);
  }
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

/** `{ state, reason }` of one logged event on either platform. */
function stateOf(event) {
  const [state, reason] = String(event.phase ?? event.shutter ?? '').split(':');
  return { state, reason: reason ?? null };
}

/** The expected file with this platform's overrides applied (brief §11 "Expected-result file"). */
function expectedFor(frames, relative, platform) {
  const expected = readJson(path.join(frames, relative));
  const merged = { ...expected, ...(expected.platform?.[platform] ?? {}) };
  delete merged.platform;
  return merged;
}

/** What the log shows for one segment, in one shape for both platforms. */
function observe(line) {
  const events = line.events ?? [];
  let falseRelocks = 0;
  for (let i = 1; i < events.length; i += 1) {
    // A relock right after a capture is the next photo starting, not a lost lock.
    if (stateOf(events[i]).state === 'locked' && stateOf(events[i - 1]).state === 'unlocked') {
      falseRelocks += 1;
    }
  }
  const last = events.at(-1);
  const lastLocked = [...events].reverse().find((event) => stateOf(event).state === 'locked');
  return {
    firstUnlockMs: line.firstUnlockMs ?? null,
    anywayMs: line.anywayMs ?? line.anywayAtMs ?? null,
    finalHint: line.finalHint ?? last?.hint ?? null,
    finalState: last ? stateOf(last).state : null,
    finalLockReason: line.finalLockReason ?? (lastLocked ? stateOf(lastLocked).reason : null),
    hintsSeen: [...new Set(events.map((event) => event.hint).filter(Boolean))],
    hintAtUnlock:
      line.hintAtUnlock ??
      events.find((event) => stateOf(event).state === 'unlocked')?.hint ??
      null,
    captures: line.captures ?? [],
    falseRelocks,
    events,
  };
}

/** A gap in a sweep or batch: locked within `relock × interval`, stays locked, no capture. */
function judgeGap(observed, rules) {
  const lockByMs = rules.lock.relockAfterFailingEvaluations * rules.evaluation.intervalMs;
  const reasons = [];
  const lockedAt = observed.events.find((event) => LOCKED_STATES.has(stateOf(event).state))?.tMs;
  if (lockedAt == null || lockedAt > lockByMs)
    reasons.push(`not locked by ${lockByMs} ms (at ${lockedAt ?? 'never'})`);
  const reopened = observed.events.some(
    (event) => lockedAt != null && event.tMs > lockedAt && stateOf(event).state === 'unlocked',
  );
  if (reopened) reasons.push('unlocked again in the gap');
  if (observed.captures.length > 0)
    reasons.push(`${observed.captures.length} capture(s) in the gap`);
  return { reasons, falseUnlock: reopened || observed.captures.length > 0 };
}

function judgeUnlocked(expected, observed, needsCapture) {
  const reasons = [];
  const max = expected.maxUnlockMs;
  const miss = observed.firstUnlockMs == null || observed.firstUnlockMs > max;
  if (miss)
    reasons.push(
      `miss: unlock ${observed.firstUnlockMs ?? 'never'} ms > ${max} ms (final ${observed.finalHint})`,
    );
  // The expected hint is the one shown at the unlock (tools/capture-frames/README.md "expected.json").
  if (!miss && observed.hintAtUnlock !== expected.hint) {
    reasons.push(`hint at unlock ${observed.hintAtUnlock} != ${expected.hint}`);
  }
  if (!miss && needsCapture && observed.captures.length === 0)
    reasons.push('unlocked but never captured');
  return { reasons, miss, falseLock: observed.falseRelocks > 0 };
}

function judgeLocked(expected, observed, timing) {
  const reasons = [];
  const falseUnlock =
    observed.firstUnlockMs != null || observed.captures.some((c) => c.trigger === 'auto');
  if (falseUnlock) reasons.push(`false unlock at ${observed.firstUnlockMs} ms`);
  if (observed.finalHint !== expected.hint)
    reasons.push(`hint ${observed.finalHint} != ${expected.hint}`);
  if (
    expected.lockReason &&
    observed.finalLockReason &&
    observed.finalLockReason !== expected.lockReason
  ) {
    reasons.push(`lock reason ${observed.finalLockReason} != ${expected.lockReason}`);
  }
  if (timing) {
    const { atMs, toleranceMs } = timing;
    const anyway = observed.anywayMs;
    if (anyway == null || Math.abs(anyway - atMs) > toleranceMs) {
      reasons.push(`anyway at ${anyway ?? 'never'} ms, wanted ${atMs} ± ${toleranceMs} ms`);
    }
  }
  return { reasons, falseUnlock };
}

function caseIdOf(line, set) {
  return set.kind === 'single'
    ? line.setId
    : `${line.setId}-s${String(line.segment).padStart(2, '0')}`;
}

function scoreLine(line, context, screenReader) {
  const { frames, platform, index, rules, sets } = context;
  const set = sets.get(line.setId);
  if (!set) return null;
  const segment = set.segments[line.segment];
  const isGap = set.kind !== 'single' && segment.frames === index.playback.gapFrames;
  const expected = expectedFor(frames, segment.expected, platform);
  const observed = observe(line);
  const role = isGap ? 'gap' : set.kind === 'single' ? 'single' : 'item';
  let verdict;
  if (isGap) {
    verdict = judgeGap(observed, rules);
  } else if (expected.shutter === 'unlocked') {
    verdict = judgeUnlocked(expected, observed, true);
  } else {
    // "Take photo anyway" is timed only on a single set; a screen reader shows it at once.
    const timing = screenReader
      ? { atMs: 0, toleranceMs: rules.evaluation.intervalMs }
      : set.kind === 'single'
        ? { atMs: expected.anywayAtMs, toleranceMs: index.acceptance.anywayToleranceMs }
        : null;
    verdict = judgeLocked(expected, observed, timing);
    if (expected.shutter === 'either-or-anyway' && observed.firstUnlockMs != null) {
      verdict = judgeUnlocked(
        { ...expected, maxUnlockMs: expected.maxUnlockMs ?? index.acceptance.maxUnlockMs },
        observed,
        true,
      );
    }
  }
  const { events, ...shown } = observed;
  return {
    caseId: caseIdOf(line, set) + (screenReader ? '-screen-reader' : ''),
    setId: line.setId,
    segment: line.segment,
    family: set.family,
    mode: set.mode,
    variant: set.variant,
    kind: set.kind,
    role,
    screenReader,
    expected,
    observed: { ...shown, eventCount: events.length },
    pass: verdict.reasons.length === 0,
    reason: verdict.reasons.join('; '),
    miss: Boolean(verdict.miss),
    falseLock: Boolean(verdict.falseLock),
    falseUnlock: Boolean(verdict.falseUnlock),
  };
}

function summarize(cases, platform, index) {
  const scored = cases.filter((c) => !c.screenReader);
  const shouldUnlock = scored.filter((c) => c.role !== 'gap' && c.expected.shutter === 'unlocked');
  const anyway = scored
    .filter(
      (c) => c.role === 'single' && c.expected.shutter === 'locked' && c.observed.anywayMs != null,
    )
    .map((c) => c.observed.anywayMs);
  const reader = cases.filter((c) => c.screenReader);
  return {
    platform,
    total: scored.length,
    passed: scored.filter((c) => c.pass).length,
    shouldUnlock: shouldUnlock.length,
    misses: shouldUnlock.filter((c) => c.miss).map((c) => c.caseId),
    falseLocks: shouldUnlock.filter((c) => c.falseLock).map((c) => c.caseId),
    falseUnlocks: scored.filter((c) => c.falseUnlock).map((c) => c.caseId),
    anyway: {
      count: anyway.length,
      minMs: anyway.length ? Math.min(...anyway) : null,
      maxMs: anyway.length ? Math.max(...anyway) : null,
      meanMs: anyway.length ? Math.round(anyway.reduce((a, b) => a + b, 0) / anyway.length) : null,
      atMs: index.acceptance.anywayAtMs,
      toleranceMs: index.acceptance.anywayToleranceMs,
    },
    screenReader: {
      total: reader.length,
      passed: reader.filter((c) => c.pass).length,
      anywayMs: reader.map((c) => c.observed.anywayMs),
    },
    failures: cases.filter((c) => !c.pass).map((c) => ({ caseId: c.caseId, reason: c.reason })),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const frames = path.resolve(args.frames);
  const index = readJson(path.join(frames, 'index.json'));
  const context = {
    frames,
    platform: args.platform,
    index,
    rules: readJson(path.join(REPO_ROOT, RULES)),
    sets: new Map(index.sets.map((set) => [set.id, set])),
  };
  const lines = [
    ...readLines(args.results).map((line) => ({ line, screenReader: false })),
    ...(args['screen-reader'] ? readLines(args['screen-reader']) : []).map((line) => ({
      line,
      screenReader: true,
    })),
  ];
  const cases = lines
    .map(({ line, screenReader }) => scoreLine(line, context, screenReader))
    .filter(Boolean);
  if (cases.length === 0) fail(`no scorable lines in ${args.results}`);
  const dir = path.join(args.out, 'results', args.platform);
  mkdirSync(dir, { recursive: true });
  for (const scored of cases) {
    writeFileSync(path.join(dir, `${scored.caseId}.json`), `${JSON.stringify(scored, null, 2)}\n`);
  }
  const summary = summarize(cases, args.platform, index);
  writeFileSync(
    path.join(args.out, 'results', `${args.platform}.summary.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  process.stdout.write(
    `capture-score ${args.platform}: ${summary.passed}/${summary.total} passed, ` +
      `${summary.misses.length} misses, ${summary.falseLocks.length}/${summary.shouldUnlock} false locks, ` +
      `${summary.falseUnlocks.length} false unlocks, screen reader ${summary.screenReader.passed}/${summary.screenReader.total}\n`,
  );
  process.exit(summary.failures.length === 0 ? 0 : 1);
}

main();
