// Pins the shape rules of the billing and data-control contract (P03-T02.3) that the kernel pins in
// kernel-enums.test.ts do not cover: one value member per entitlement kind, an export download
// link that is minted per read and never cached (AC-5), the grace-window end and the 410 refusals
// of the deletion operations (AC-6, AC-7), the recent sign-in that export and deletion share, and
// Idempotency-Key on every mutating operation (AC-8), never replayed where the answer carries a
// credential (security review of P03-T02, B1–B3), and a consent list that gives every purpose
// its server-applied state and withdrawability, so the apps hard-code neither (architecture
// review of P03-T02).
import { CONSENT_PURPOSES } from '@ai-stylist/shared-kernel';
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
  readonly parameters?: readonly {
    readonly $ref?: string;
    readonly name?: string;
    readonly in?: string;
  }[];
  readonly requestBody?: { readonly required?: boolean };
  readonly responses: Readonly<Record<string, BundledResponse>>;
  readonly 'x-idempotency-replay'?: string;
};
const paths: Readonly<Record<string, Readonly<Record<string, BundledOperation>>>> = bundle.paths;

function operation(path: string, method: string): BundledOperation {
  const found = paths[path]?.[method];
  if (!found) throw new Error(`no ${method.toUpperCase()} ${path} in the bundle`);
  return found;
}

/** `METHOD /path` of every bundled operation `keep` accepts, in bundle order. */
function operationLines(keep: (op: BundledOperation, method: string) => boolean): string[] {
  return Object.entries(paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([method, op]) => keep(op, method))
      .map(([method]) => `${method.toUpperCase()} ${path}`),
  );
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const IDEMPOTENCY_KEY = '#/components/parameters/IdempotencyKey';
const NO_STORE = '#/components/headers/CacheControlNoStore';
const SCHEMA_REF = '#/components/schemas/';
const RESPONSE_REF = '#/components/responses/';

/** The schemas whose presence in an answer means the answer carries a credential (B1). */
const CREDENTIAL_SCHEMAS = new Set(['SessionGrant', 'DeletionPending', 'SignUpPending']);
const schemaByName: Readonly<Record<string, unknown>> = schemas;
const responseByName: Readonly<Record<string, unknown>> = bundle.components.responses;

/** True when `node` reaches a credential schema through any chain of schema `$ref`s. */
function reachesCredential(node: unknown, seen: Set<string> = new Set()): boolean {
  if (typeof node !== 'object' || node === null) return false;
  if ('$ref' in node && typeof node.$ref === 'string') {
    if (!node.$ref.startsWith(SCHEMA_REF)) return false;
    const name = node.$ref.slice(SCHEMA_REF.length);
    if (CREDENTIAL_SCHEMAS.has(name)) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return reachesCredential(schemaByName[name], seen);
  }
  return Object.values(node).some((child) => reachesCredential(child, seen));
}

/** True when a 2xx answer of `op` carries a credential; shared responses are resolved first. */
function answersCredential(op: BundledOperation): boolean {
  return Object.entries(op.responses)
    .filter(([status]) => /^2[0-9]{2}$/.test(status))
    .some(([, response]) =>
      reachesCredential(
        response.$ref?.startsWith(RESPONSE_REF)
          ? responseByName[response.$ref.slice(RESPONSE_REF.length)]
          : response,
      ),
    );
}

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

describe('consents (architecture review)', () => {
  const validatePage = validatorFor('ConsentPage');
  const validateEntry = validatorFor('ResolvedConsent');
  const consents = bundle.paths['/v1/me/consents'];
  const [example] = schemas.ConsentPage.examples;

  it('the example answers one valid entry per purpose, in ConsentPurpose order', () => {
    expect(validatePage(example), JSON.stringify(validatePage.errors)).toBe(true);
    expect(example?.items.map((entry) => entry.purpose)).toEqual([...CONSENT_PURPOSES]);
  });

  it('an entry with a record follows it; one without a record is the default', () => {
    const withRecord = example?.items.filter((entry) => entry.record !== undefined) ?? [];
    expect(withRecord.length).toBeGreaterThan(0);
    for (const entry of withRecord) {
      expect(entry.record?.purpose).toBe(entry.purpose);
      expect(entry.granted).toBe(entry.record?.status === 'granted');
    }
    const defaulted = { purpose: 'notifications', granted: false, withdrawable: true };
    expect(validateEntry(defaulted), JSON.stringify(validateEntry.errors)).toBe(true);
  });

  it('every entry says whether the person can withdraw it', () => {
    expect(schemas.ResolvedConsent.required).toEqual(['purpose', 'granted', 'withdrawable']);
    expect(validateEntry({ purpose: 'core_service', granted: true })).toBe(false);
    expect(validateEntry({ purpose: 'core_service', granted: true, withdrawable: 'no' })).toBe(
      false,
    );
  });

  it('the list answers stay open; the decision and its append-only record keep their shape', () => {
    expect(schemas.ResolvedConsent).not.toHaveProperty('additionalProperties');
    expect(schemas.ConsentPage).not.toHaveProperty('additionalProperties');
    expect(consents.get.responses['200'].content['application/json'].schema.$ref).toBe(
      `${SCHEMA_REF}ConsentPage`,
    );
    expect(schemas.ConsentChange.additionalProperties).toBe(false);
    const recorded = consents.post.responses;
    for (const answer of [recorded['200'], recorded['201']]) {
      expect(answer.content['application/json'].schema.$ref).toBe(`${SCHEMA_REF}ConsentRecord`);
    }
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
  const { download: _link, readyAt: _ready, availableUntil: _kept, ...requested } = ready;
  const inProgress = { ...requested, status: 'in_progress' };

  it('a ready export carries a download link with its expiry; an in-progress one need not', () => {
    expect(validate(ready), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(inProgress), JSON.stringify(validate.errors)).toBe(true);
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
    expect(limited({ ...problem, code: 'RATE_LIMITED', current: inProgress })).toBe(true);
  });
});

describe('re-authentication (security review N4)', () => {
  it('export, deletion and adding a passkey share one recent-sign-in refusal', () => {
    const recentSignIn = `${RESPONSE_REF}RecentSignInRequired`;
    expect(operation('/v1/me/exports', 'post').responses['403']?.$ref).toBe(recentSignIn);
    expect(operation('/v1/me/deletion', 'post').responses['403']?.$ref).toBe(recentSignIn);
    expect(
      operation('/v1/auth/passkey/generate-register-options', 'get').responses['403']?.$ref,
    ).toBe(recentSignIn);
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
    const users = operationLines(
      (op) => op.security?.some((entry) => 'deletionCancelToken' in entry) ?? false,
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
    const missing = operationLines(
      (op, method) =>
        MUTATING_METHODS.has(method) &&
        !op.parameters?.some((parameter) => parameter.$ref === IDEMPOTENCY_KEY),
    );
    expect(missing).toEqual([]);
  });

  it('an operation whose answer carries a credential is marked never-replayed, and only such (B1)', () => {
    const credentialBearing = operationLines((op) => answersCredential(op));
    const neverReplayed = operationLines((op) => op['x-idempotency-replay'] !== undefined);
    expect([...credentialBearing].sort()).toEqual([
      'POST /v1/auth/passkey/verify-authentication',
      'POST /v1/auth/recovery/complete',
      'POST /v1/auth/session/refresh',
      'POST /v1/auth/sign-in/social',
      'POST /v1/auth/sign-up/complete',
    ]);
    expect(neverReplayed).toEqual(credentialBearing);
    for (const line of neverReplayed) {
      const [method = '', path = ''] = line.split(' ');
      const op = operation(path, method.toLowerCase());
      expect(op['x-idempotency-replay'], line).toBe('never');
      expect(op.responses['409']?.$ref, line).toBe(`${RESPONSE_REF}Conflict`);
    }
  });

  it('no GET answers a credential, so fetching a link never opens a session (B2)', () => {
    expect(operationLines((op, method) => method === 'get' && answersCredential(op))).toEqual([]);
  });

  it('refresh and recovery completion take their credential only in a closed body (B2, B3)', () => {
    for (const [path, body, field] of [
      ['/v1/auth/session/refresh', schemas.RefreshSessionRequest, 'refreshToken'],
      ['/v1/auth/recovery/complete', schemas.RecoveryCompletionRequest, 'token'],
    ] as const) {
      const op = operation(path, 'post');
      expect(op.security, path).toEqual([]);
      expect(op.requestBody?.required, path).toBe(true);
      expect(op.parameters?.filter((parameter) => parameter.in === 'query') ?? [], path).toEqual(
        [],
      );
      expect(body.additionalProperties, path).toBe(false);
      expect(body.required, path).toEqual([field]);
    }
  });

  it('a session grant pairs the access token with a separate refresh token (B3)', () => {
    expect(schemas.SessionGrant.required).toEqual([
      'userId',
      'token',
      'expiresAt',
      'refreshToken',
      'refreshTokenExpiresAt',
    ]);
  });
});
