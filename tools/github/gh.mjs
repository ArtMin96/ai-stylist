// One call to the GitHub REST API through the GitHub CLI (`gh api`), which owns the login: this
// tool never sees a token. A request body goes to gh on standard input (`--input -`), never as an
// argument. Node built-ins only.
import { spawnSync } from 'node:child_process';

const HEADERS = [
  '-H',
  'Accept: application/vnd.github+json',
  '-H',
  'X-GitHub-Api-Version: 2022-11-28',
];

/** A failed call: `status` is the HTTP status GitHub answered, or 0 when gh itself failed. */
export class GhError extends Error {
  constructor(method, apiPath, status, message) {
    super(message);
    this.method = method;
    this.apiPath = apiPath;
    this.status = status;
  }
}

/** GitHub's own `message` when gh printed the error body, else the first line gh wrote. */
function errorMessage(result) {
  try {
    const message = JSON.parse(result.stdout)?.message;
    if (typeof message === 'string' && message !== '') return message;
  } catch {
    // not JSON: fall through to what gh printed
  }
  const line = result.stderr.trim().split('\n')[0] ?? '';
  const text = line.replace(/^gh: /, '').replace(/ \(HTTP \d{3}\)$/, '');
  return text || 'gh failed without a message';
}

/** Sends `method` to `apiPath` (such as `repos/OWNER/REPO/labels`); returns the parsed answer. */
export function ghApi(method, apiPath, body) {
  const args = ['api', '--method', method, apiPath, ...HEADERS];
  if (body !== undefined) args.push('--input', '-');
  const result = spawnSync('gh', args, {
    input: body === undefined ? '' : JSON.stringify(body),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    const missing = result.error.code === 'ENOENT';
    const message = missing ? 'the GitHub CLI (gh) is not installed' : result.error.message;
    throw new GhError(method, apiPath, 0, message);
  }
  if (result.status !== 0) {
    const status = Number(/\(HTTP (\d{3})\)/.exec(result.stderr)?.[1] ?? 0);
    throw new GhError(method, apiPath, status, errorMessage(result));
  }
  const text = result.stdout.trim();
  return text === '' ? undefined : JSON.parse(text);
}
