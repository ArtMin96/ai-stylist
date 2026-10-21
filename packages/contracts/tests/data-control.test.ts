// Pins the shape rules of the billing and data-control contract (P03-T02.3) that the kernel pins in
// kernel-enums.test.ts do not cover: one value member per entitlement kind, an export download
// link that is minted per read and never cached (AC-5), the grace-window end and the 410 refusals
// of the deletion operations (AC-6, AC-7), and Idempotency-Key on every mutating operation (AC-8).
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

const schemas = bundle.components.schemas;
const BUNDLE_ID = 'https://contracts.ai-stylist.app/openapi.bundle.json';

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats.default(ajv);
// The bundle's components are a schema container, not a keyword: refs point into it.
ajv.addKeyword('components');
ajv.addSchema({ $id: BUNDLE_ID, components: bundle.components });

function validatorFor(name: keyof typeof schemas) {
  const validate = ajv.getSchema(`${BUNDLE_ID}#/components/schemas/${name}`);
  if (!validate) throw new Error(`no schema ${name} in the bundle`);
  return validate;
}

/** A bundled response: shared ones are a `$ref`, inline ones carry a description. */
type BundledResponse = {
  readonly $ref?: string;
  readonly description?: string;
  readonly headers?: object;
};

/** The parts of a bundled operation these pins read; parameters are a `$ref` or named inline. */
type BundledOperation = {
  readonly security?: readonly Readonly<Record<string, readonly string[]>>[];
  readonly parameters?: readonly { readonly $ref?: string; readonly name?: string }[];
  readonly responses: Readonly<Record<string, BundledResponse>>;
};
const paths: Readonly<Record<string, Readonly<Record<string, BundledOperation>>>> = bundle.paths;

function operation(path: string, method: string): BundledOperation {
  const found = paths[path]?.[method];
  if (!found) throw new Error(`no ${method.toUpperCase()} ${path} in the bundle`);
  return found;
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const IDEMPOTENCY_KEY = '#/components/parameters/IdempotencyKey';
const NO_STORE = '#/components/headers/CacheControlNoStore';

describe('resolved entitlements', () => {
  const validate = validatorFor('ResolvedEntitlement');

  it('accepts one value member per kind: granted, a limit or null (unlimited), a level', () => {
    for (const entry of [
      { name: 'data.export', granted: true },
      { name: 'closet.max_items', source: 'plan_grant', limit: 40 },
      { name: 'closet.max_items', source: 'trial_grant', limit: null },
      { name: 'tryon.generative', source: 'trial_grant', level: 'G2' },
      { name: 'trends.level' },
    ]) {
      expect(validate(entry), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('refuses an unknown name, an unknown grant kind, a negative limit and a free-text level', () => {
    expect(validate({ name: 'closet.unlimited', granted: true })).toBe(false);
    expect(validate({ name: 'data.export', source: 'server_grant', granted: true })).toBe(false);
    expect(validate({ name: 'closet.max_items', limit: -1 })).toBe(false);
    expect(validate({ name: 'avatar.level', level: 'A1 + all poses' })).toBe(false);
  });

  it('the state names its lifecycle state and lists the entitlements', () => {
    const state = validatorFor('EntitlementState');
    expect(state({ state: 'free', entitlements: [] }), JSON.stringify(state.errors)).toBe(true);
    expect(state({ state: 'expired', entitlements: [] })).toBe(false);
    expect(schemas.EntitlementState.required).toEqual(['state', 'entitlements']);
  });
});

describe('data export (AC-5)', () => {
  const validate = validatorFor('DataExport');
  const ready = {
    id: 'xpt_00000000000000000000000001',
    status: 'ready',
    requestedAt: '2026-10-21T10:00:00Z',
    readyAt: '2026-10-21T10:05:00Z',
    availableUntil: '2026-10-22T10:05:00Z',
    download: { url: 'https://storage.example.invalid/x', expiresAt: '2026-10-21T10:15:00Z' },
  };

  it('a ready export carries a download link with its expiry; an in-progress one need not', () => {
    expect(validate(ready), JSON.stringify(validate.errors)).toBe(true);
    const { download: _link, readyAt: _ready, availableUntil: _kept, ...pending } = ready;
    expect(validate({ ...pending, status: 'in_progress' }), JSON.stringify(validate.errors)).toBe(
      true,
    );
    expect(schemas.DataExportDownload.required).toEqual(['url', 'expiresAt']);
  });

  it('the link carries no example value and every read is answered no-store', () => {
    expect(schemas.DataExportDownload.properties.url).not.toHaveProperty('examples');
    expect(schemas.DataExportDownload.properties.url).not.toHaveProperty('example');
    const read = operation('/v1/me/exports/{id}', 'get');
    expect(read.responses['200']?.headers).toEqual({ 'Cache-Control': { $ref: NO_STORE } });
  });

  it('a second export while one runs is a 429 that may carry the running export', () => {
    const request = operation('/v1/me/exports', 'post');
    expect(request.responses['429']?.$ref).toBe('#/components/responses/DataExportLimited');
    const limited = validatorFor('DataExportInProgress');
    const problem = { type: 'about:blank', title: 'Too many requests', status: 429 };
    expect(limited({ ...problem, code: 'RATE_LIMITED', current: ready })).toBe(true);
  });
});

describe('account deletion (AC-6, AC-7)', () => {
  it('the deletion request carries the end of its grace window', () => {
    expect(schemas.AccountDeletionRequest.required).toEqual(['id', 'requestedAt', 'graceEndsAt']);
    expect(operation('/v1/me/deletion', 'post').responses['410']?.$ref).toBe(
      '#/components/responses/AccountDeleted',
    );
  });

  it('only the cancel takes the cancel credential, and it takes nothing else', () => {
    expect(operation('/v1/me/deletion', 'delete').security).toEqual([{ deletionCancelToken: [] }]);
    const users = Object.entries(paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([, op]) => op.security?.some((entry) => 'deletionCancelToken' in entry))
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    );
    expect(users).toEqual(['DELETE /v1/me/deletion']);
  });

  it('a cancel after the window is a 410 that is never cached', () => {
    const cancel = operation('/v1/me/deletion', 'delete');
    expect(cancel.responses['410']?.headers).toEqual({ 'Cache-Control': { $ref: NO_STORE } });
  });
});

describe('idempotency (AC-8)', () => {
  it('every mutating operation of the contract declares Idempotency-Key', () => {
    const missing = Object.entries(paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([method]) => MUTATING_METHODS.has(method))
        .filter(([, op]) => !op.parameters?.some((parameter) => parameter.$ref === IDEMPOTENCY_KEY))
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    );
    expect(missing).toEqual([]);
  });
});
