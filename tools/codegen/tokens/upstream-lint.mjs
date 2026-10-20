// TK-12: the pinned `@google/design.md` (0.4.0, root devDependency) `lint` must report 0 errors
// (DEC-87 pipeline stage 1). It runs as a child process through the workspace bin, never npx, so
// only the locked version can run. Its exit code is the contract: 1 on any error, 0 with warnings
// (the accepted `token-like-ignored` warning for `elevation` and `motion` exits 0). Its output is
// shown only when it fails. DESIGN_MD_BIN points the tests at a stub.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const LINT_TIMEOUT_MS = 60_000;

/** The bin to run: `$DESIGN_MD_BIN`, else `<repo>/node_modules/.bin/design.md`. */
export const designMdBin = (root, env = process.env) =>
  env.DESIGN_MD_BIN || path.join(root, 'node_modules', '.bin', 'design.md');

/** Runs `design.md lint <input>`; returns TK-12 findings (empty when it passed). */
export function upstreamLint(bin, input) {
  const run = spawnSync(bin, ['lint', input], { encoding: 'utf8', timeout: LINT_TIMEOUT_MS });
  if (run.error?.code === 'ENOENT') {
    const message = `\`${bin}\` not found: install the pinned root devDependency @google/design.md`;
    return [{ rule: 'TK-12', at: 'design.md lint', message }];
  }
  if (run.error) {
    return [{ rule: 'TK-12', at: 'design.md lint', message: run.error.message }];
  }
  if (run.status === 0) return [];
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
  const status = run.status ?? run.signal;
  return [
    {
      rule: 'TK-12',
      at: 'design.md lint',
      message: `exited ${status}${output ? `:\n${output}` : ''}`,
    },
  ];
}
