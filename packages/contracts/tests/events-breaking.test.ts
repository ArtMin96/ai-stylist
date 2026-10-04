// Pins scripts/events-breaking.mjs, the event-schema breaking-change gate (planning/06 §4:
// additive-only within vN, a breaking change ships as vN+1). The CLI is run as a subprocess, the
// way the CI gate runs it, against the fixtures in tests/fixtures/events-breaking/ and against
// per-rule edits of the base fixture written to a temp directory.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, '../scripts/events-breaking.mjs');
const FIXTURES = path.join(HERE, 'fixtures/events-breaking');
const EVENTS = path.resolve(HERE, '../events');

type Json = Record<string, unknown>;
type Payload = { required: string[]; properties: Record<string, Json> } & Json;

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'events-breaking-'));
  temps.push(dir);
  return dir;
}

function run(...args: string[]): { status: number | null; out: string } {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: res.status, out: `${res.stdout}${res.stderr}` };
}

function compareDirs(base: string, head: string) {
  return run('--base-dir', base, '--head-dir', head);
}

function baseSchema(): Json {
  return JSON.parse(readFileSync(path.join(FIXTURES, 'base/sample.event.json'), 'utf8')) as Json;
}

function payloadOf(schema: Json): Payload {
  return (schema.$defs as { Payload: Payload }).Payload;
}

/** Writes `edit(base)` as the only schema of a fresh head directory and compares it to base/. */
function compareEdit(edit: (schema: Json) => void) {
  const schema = baseSchema();
  edit(schema);
  const head = tempDir();
  writeFileSync(path.join(head, 'sample.event.json'), JSON.stringify(schema, null, 2));
  return compareDirs(path.join(FIXTURES, 'base'), head);
}

describe('events-breaking fixtures', () => {
  it('passes the additive fixture (new optional field, new enum value, widening, new v2)', () => {
    const res = compareDirs(path.join(FIXTURES, 'base'), path.join(FIXTURES, 'additive'));
    expect(res.out).toContain('1 base schema version(s) compatible');
    expect(res.out).toContain('new: fixture.sample.recorded.v2');
    expect(res.status).toBe(0);
  });

  it('fails the breaking fixture and names every break', () => {
    const res = compareDirs(path.join(FIXTURES, 'base'), path.join(FIXTURES, 'breaking'));
    expect(res.status).toBe(1);
    for (const line of [
      'property "tags" removed',
      'property "count" newly required',
      'type changed from "string" to "integer"',
      'enum value(s) removed: "beta"',
      'additionalProperties tightened from open to false',
    ]) {
      expect(res.out).toContain(line);
    }
  });

  it('accepts the committed event schemas compared with themselves', () => {
    const res = compareDirs(EVENTS, EVENTS);
    expect(res.out).toMatch(/OK - [1-9]\d* base schema version\(s\) compatible/);
    expect(res.status).toBe(0);
  });
});

describe('events-breaking rules, one edit each', () => {
  it.each<[string, (s: Json) => void, string]>([
    ['removed property', (s) => delete payloadOf(s).properties.count, 'property "count" removed'],
    [
      'newly required property',
      (s) => payloadOf(s).required.push('count'),
      'property "count" newly required',
    ],
    [
      'type change',
      (s) => (payloadOf(s).properties.count = { type: 'string' }),
      'type changed from "integer" to "string"',
    ],
    [
      'retyped array items',
      (s) => (payloadOf(s).properties.tags = { type: 'array', items: { type: 'integer' } }),
      'items: type changed from "string" to "integer"',
    ],
    [
      'removed enum value',
      (s) => (payloadOf(s).properties.kind = { type: 'string', enum: ['beta'] }),
      'enum value(s) removed: "alpha"',
    ],
    [
      'additionalProperties tightened to a schema',
      (s) => (payloadOf(s).properties.meta!.additionalProperties = { type: 'string' }),
      'additionalProperties tightened from open to a schema',
    ],
    [
      'removed schema version (type const bumped in place)',
      (s) =>
        ((s.properties as Record<string, Json>).type = { const: 'fixture.sample.recorded.v2' }),
      'fixture.sample.recorded.v1 (sample.event.json) /: schema version removed',
    ],
  ])('fails on a %s', (_name, edit, finding) => {
    const res = compareEdit(edit);
    expect(res.out).toContain(finding);
    expect(res.status).toBe(1);
  });

  it.each<[string, (s: Json) => void]>([
    ['new optional property', (s) => (payloadOf(s).properties.extra = { type: 'boolean' })],
    ['dropped requirement', (s) => (payloadOf(s).required = ['sampleId'])],
    ['integer widened to number', (s) => (payloadOf(s).properties.count = { type: 'number' })],
    [
      'added enum value',
      (s) => (payloadOf(s).properties.kind = { type: 'string', enum: ['alpha', 'beta', 'gamma'] }),
    ],
    ['title-only edit', (s) => (s.title = 'Renamed only')],
  ])('passes a %s', (_name, edit) => {
    const res = compareEdit(edit);
    expect(res.out).toContain('compatible');
    expect(res.status).toBe(0);
  });
});

describe('events-breaking --base-ref', () => {
  function git(cwd: string, ...args: string[]): void {
    const res = spawnSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args],
      {
        cwd,
        encoding: 'utf8',
      },
    );
    if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
  }

  /** A throwaway repo whose base commit holds base/, with `head` copied over the working tree. */
  function repoWith(head: string): string {
    const repo = tempDir();
    const events = path.join(repo, 'packages/contracts/events');
    cpSync(path.join(FIXTURES, 'base'), events, { recursive: true });
    git(repo, 'init', '-q');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'base');
    rmSync(events, { recursive: true });
    cpSync(path.join(FIXTURES, head), events, { recursive: true });
    return repo;
  }

  it('compares the working tree with the base commit: additive passes', () => {
    const res = run('--base-ref', 'HEAD', '--repo', repoWith('additive'));
    expect(res.out).toContain('compatible');
    expect(res.status).toBe(0);
  });

  it('compares the working tree with the base commit: breaking fails', () => {
    const res = run('--base-ref', 'HEAD', '--repo', repoWith('breaking'));
    expect(res.out).toContain('property "tags" removed');
    expect(res.status).toBe(1);
  });

  it('exits 2 on an unknown base ref and on bad arguments', () => {
    expect(run('--base-ref', 'no-such-ref', '--repo', repoWith('base')).status).toBe(2);
    expect(run('--base-dir', FIXTURES).status).toBe(2);
  });
});
