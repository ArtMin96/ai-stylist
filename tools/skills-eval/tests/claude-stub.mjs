#!/usr/bin/env node
// A stand-in for the `claude` CLI, for tools/skills-eval/tests/cli.test.mjs: the suite puts a
// launcher named `claude` on a scratch PATH that runs this file, so `just skills-eval` never
// reaches the real CLI and no model is called. It answers `--version` and `plugin eval`, and
// exits 64 on anything else, so a new call cannot go untested.
//
//   CLAUDE_STUB_VERSION  the version `--version` prints (default 2.1.296)
//   CLAUDE_STUB_LOG      a file that gets one JSON line per `plugin eval` call: the unit (the name
//                        of the directory that holds the plugin, `<skill>-<mode>`), the arguments
//                        and the two effort variables
//   CLAUDE_STUB_RESULTS  a directory of result documents; `<unit>.json` is delivered at the
//                        `--json` path (no such file: none is written)
//   CLAUDE_STUB_EXIT     the exit code of `plugin eval` (default 0)
// Node built-ins only.
import { appendFileSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const env = process.env;

if (args.length === 1 && args[0] === '--version') {
  process.stdout.write(`${env.CLAUDE_STUB_VERSION ?? '2.1.296'} (Claude Code)\n`);
} else if (args[0] === 'plugin' && args[1] === 'eval') {
  const unit = path.basename(path.dirname(args[2]));
  const call = {
    unit,
    args,
    effortLevel: env.CLAUDE_CODE_EFFORT_LEVEL ?? null,
    claudeEffort: env.CLAUDE_EFFORT ?? null,
  };
  appendFileSync(env.CLAUDE_STUB_LOG, `${JSON.stringify(call)}\n`);
  const result = path.join(env.CLAUDE_STUB_RESULTS ?? '', `${unit}.json`);
  if (existsSync(result)) copyFileSync(result, args[args.indexOf('--json') + 1]);
  process.stdout.write(`claude stub: ran ${unit}\n`);
  process.exitCode = Number(env.CLAUDE_STUB_EXIT ?? 0);
} else {
  process.stderr.write(`claude stub: unexpected call: ${args.join(' ')}\n`);
  process.exitCode = 64;
}
