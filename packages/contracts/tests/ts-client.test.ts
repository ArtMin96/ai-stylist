// Consumes the generated hey-api client (AC-2): the SDK compiles against the fetch client, the
// response types match the OpenAPI schemas, and problem responses are typed as ProblemDetails.
import { type ProblemDetails as KernelProblem, problem } from '@ai-stylist/shared-kernel';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  type AccountDeletionRequest,
  type CompleteSignUpResponse,
  type ConsentPage,
  type ConsentRecord,
  type DataExport,
  type DataExportInProgress,
  type EntitlementState,
  type GetDataExportResponse,
  type GetEntitlementsResponse,
  type GetHealthError,
  type GetHealthResponse,
  type GetVersionResponse,
  type HealthReport,
  type ListConsentsResponse,
  type Preferences,
  type PreferencesVersionConflict,
  type ProblemDetails,
  type RecordConsentError,
  type RecordConsentResponse,
  type RefreshSessionResponse,
  type RequestAccountDeletionResponse,
  type RequestDataExportError,
  type RequestDataExportResponse,
  type ResolvedConsent,
  type ResolvedEntitlement,
  type SessionGrant,
  type SignInResult,
  type SignInWithIdTokenResponse,
  type SignInWithPasskeyResponse,
  type UpdatePreferencesError,
  type UpdatePreferencesResponse,
  type VersionInfo,
  cancelAccountDeletion,
  completeAccountRecovery,
  getEntitlements,
  getHealth,
  getVersion,
  listConsents,
  refreshSession,
  signInWithIdToken,
  updatePreferences,
} from '../gen/ts-client/index.js';
import { createClient } from '../gen/ts-client/client/index.js';
import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}

type BundledOperation = { operationId: string; tags: string[] };

/** `METHOD /path operationId` for every bundled operation tagged `tag`, sorted. */
function operationsTagged(tag: string): string[] {
  const paths: Record<string, Record<string, BundledOperation>> = bundle.paths;
  return Object.entries(paths)
    .flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([, op]) => op.tags.includes(tag))
        .map(([method, op]) => `${method.toUpperCase()} ${path} ${op.operationId}`),
    )
    .sort();
}

describe('generated ts-client', () => {
  it('types health and version responses from the contract', () => {
    expectTypeOf<GetHealthResponse>().toEqualTypeOf<HealthReport>();
    expectTypeOf<GetVersionResponse>().toEqualTypeOf<VersionInfo>();
    expectTypeOf<HealthReport['checks']['db']>().toEqualTypeOf<'ok' | 'down'>();
    expectTypeOf<GetHealthError>().toEqualTypeOf<ProblemDetails>();
  });

  it('shared-kernel problem() output satisfies the contract ProblemDetails', () => {
    const p: ProblemDetails = problem('NOT_FOUND', { detail: 'no such thing' });
    expect(p.status).toBe(404);
    expectTypeOf<KernelProblem>().toExtend<ProblemDetails>();
  });

  it('calls GET /v1/health through an injected fetch and returns typed data', async () => {
    const calls: string[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      fetch: (input: string | URL | Request) => {
        const request = new Request(input);
        calls.push(`${request.method} ${new URL(request.url).pathname}`);
        return Promise.resolve(jsonResponse({ status: 'ok', checks: { db: 'ok' } }));
      },
    });
    const { data, error } = await getHealth({ client });
    expect(error).toBeUndefined();
    expect(data?.checks.db).toBe('ok');
    expect(calls).toEqual(['GET /v1/health']);
  });

  it('surfaces problem+json bodies as typed errors', async () => {
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      fetch: () =>
        Promise.resolve(
          jsonResponse(problem('INTERNAL', { detail: 'boom' }), 500, 'application/problem+json'),
        ),
    });
    const { data, error } = await getVersion({ client });
    expect(data).toBeUndefined();
    expect(error?.code).toBe('INTERNAL');
    expect(error?.status).toBe(500);
  });

  it('bundle exposes both platform operations with operationIds', () => {
    const paths = bundle.paths;
    expect(paths['/v1/health'].get.operationId).toBe('getHealth');
    expect(paths['/v1/version'].get.operationId).toBe('getVersion');
    expect(bundle.openapi).toBe('3.1.0');
  });
});

describe('generated ts-client: identity', () => {
  const synthetic = { token: 'synthetic-session-token', userId: 'usr_01J9Z3K8X2Q7N5V4B6C8D0E1F2' };
  const grant: SessionGrant = {
    ...synthetic,
    expiresAt: '2026-10-21T10:00:00Z',
    refreshToken: 'synthetic-refresh-token',
    refreshTokenExpiresAt: '2027-01-19T09:45:00Z',
  };

  type RecordedCall = {
    line: string;
    query: string;
    authorization: string | null;
    body: unknown;
  };

  /** A client that holds the access token for `bearerAuth`, records each call and answers `answer`. */
  function recordingClient(answer: unknown): {
    client: ReturnType<typeof createClient>;
    calls: RecordedCall[];
  } {
    const calls: RecordedCall[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      auth: synthetic.token,
      fetch: async (input: string | URL | Request) => {
        const request = new Request(input);
        const url = new URL(request.url);
        calls.push({
          line: `${request.method} ${url.pathname}`,
          query: url.search,
          authorization: request.headers.get('authorization'),
          body: await request.json(),
        });
        return jsonResponse(answer);
      },
    });
    return { client, calls };
  }

  it('bundle exposes every identity operation with its operationId', () => {
    expect(operationsTagged('identity')).toEqual([
      'DELETE /v1/me/deletion cancelAccountDeletion',
      'DELETE /v1/me/recovery cancelAccountRecovery',
      'GET /v1/auth/get-session getSession',
      'GET /v1/auth/list-sessions listDeviceSessions',
      'GET /v1/auth/passkey/generate-authenticate-options getPasskeySignInOptions',
      'GET /v1/auth/passkey/generate-register-options getPasskeyRegistrationOptions',
      'GET /v1/me/consents listConsents',
      'GET /v1/me/exports/{id} getDataExport',
      'POST /v1/auth/passkey/verify-authentication signInWithPasskey',
      'POST /v1/auth/passkey/verify-registration registerPasskey',
      'POST /v1/auth/recovery/complete completeAccountRecovery',
      'POST /v1/auth/revoke-sessions signOutAllDevices',
      'POST /v1/auth/session/refresh refreshSession',
      'POST /v1/auth/sign-in/magic-link requestAccountRecovery',
      'POST /v1/auth/sign-in/social signInWithIdToken',
      'POST /v1/auth/sign-out signOut',
      'POST /v1/auth/sign-up/complete completeSignUp',
      'POST /v1/me/consents recordConsent',
      'POST /v1/me/deletion requestAccountDeletion',
      'POST /v1/me/exports requestDataExport',
    ]);
  });

  it('types the export and deletion answers', () => {
    expectTypeOf<RequestDataExportResponse>().toEqualTypeOf<DataExport>();
    expectTypeOf<GetDataExportResponse>().toEqualTypeOf<DataExport>();
    expectTypeOf<RequestDataExportError>().toEqualTypeOf<ProblemDetails | DataExportInProgress>();
    expectTypeOf<RequestAccountDeletionResponse>().toEqualTypeOf<AccountDeletionRequest>();
  });

  it('cancels a deletion with the cancel credential only, never a session token', async () => {
    const cancelToken = 'synthetic-cancel-credential';
    const seen: { line: string; cancel: string | null; authorization: string | null }[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      auth: (scheme) => (scheme.type === 'apiKey' ? cancelToken : synthetic.token),
      fetch: (input: string | URL | Request) => {
        const request = new Request(input);
        seen.push({
          line: `${request.method} ${new URL(request.url).pathname}`,
          cancel: request.headers.get('deletion-cancel-token'),
          authorization: request.headers.get('authorization'),
        });
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });
    const { error } = await cancelAccountDeletion({ client });
    expect(error).toBeUndefined();
    expect(seen).toEqual([
      { line: 'DELETE /v1/me/deletion', cancel: cancelToken, authorization: null },
    ]);
  });

  it('types every sign-in answer as one SignInResult', () => {
    expectTypeOf<SignInWithIdTokenResponse>().toEqualTypeOf<SignInResult>();
    expectTypeOf<SignInWithPasskeyResponse>().toEqualTypeOf<SignInResult>();
    expectTypeOf<CompleteSignUpResponse>().toEqualTypeOf<SignInResult>();
    expectTypeOf<SignInResult['outcome']>().toEqualTypeOf<
      'session' | 'deletion_pending' | 'sign_up_required'
    >();
  });

  it('types the consent list as one resolved entry per purpose and a decision as its record', () => {
    expectTypeOf<ListConsentsResponse>().toEqualTypeOf<ConsentPage>();
    expectTypeOf<ConsentPage['items'][number]>().toEqualTypeOf<ResolvedConsent>();
    expectTypeOf<ResolvedConsent['granted']>().toEqualTypeOf<boolean>();
    expectTypeOf<ResolvedConsent['withdrawable']>().toEqualTypeOf<boolean>();
    expectTypeOf<ResolvedConsent['record']>().toEqualTypeOf<ConsentRecord | undefined>();
    expectTypeOf<RecordConsentResponse>().toEqualTypeOf<ConsentRecord>();
    expectTypeOf<RecordConsentError>().toEqualTypeOf<ProblemDetails>();
  });

  it('posts an identity token without credentials and returns the session outcome', async () => {
    const { client, calls } = recordingClient({ outcome: 'session', session: grant });
    const { data, error } = await signInWithIdToken({
      client,
      body: { provider: 'google', idToken: { token: 'synthetic-id-token' } },
    });
    expect(error).toBeUndefined();
    expect(data?.outcome).toBe('session');
    expect(data?.session?.userId).toBe(synthetic.userId);
    expect(data?.session?.refreshToken).toBe(grant.refreshToken);
    expect(calls).toEqual([
      {
        line: 'POST /v1/auth/sign-in/social',
        query: '',
        authorization: null,
        body: { provider: 'google', idToken: { token: 'synthetic-id-token' } },
      },
    ]);
  });

  it('renews with the refresh token in the body, never the access token, and gets a new pair', async () => {
    expectTypeOf<RefreshSessionResponse>().toEqualTypeOf<SessionGrant>();
    const rotated: SessionGrant = {
      ...grant,
      token: 'synthetic-session-token-2',
      refreshToken: 'synthetic-refresh-token-2',
    };
    const { client, calls } = recordingClient(rotated);
    const { data, error } = await refreshSession({
      client,
      body: { refreshToken: grant.refreshToken },
    });
    expect(error).toBeUndefined();
    expect(data).toEqual(rotated);
    expect(calls).toEqual([
      {
        line: 'POST /v1/auth/session/refresh',
        query: '',
        authorization: null,
        body: { refreshToken: grant.refreshToken },
      },
    ]);
  });

  it('completes a recovery with the link token in a POST body, never in a URL', async () => {
    const { client, calls } = recordingClient({ outcome: 'session', session: grant });
    const { data, error } = await completeAccountRecovery({
      client,
      body: { token: 'synthetic-recovery-token' },
    });
    expect(error).toBeUndefined();
    expect(data?.outcome).toBe('session');
    expect(calls).toEqual([
      {
        line: 'POST /v1/auth/recovery/complete',
        query: '',
        authorization: null,
        body: { token: 'synthetic-recovery-token' },
      },
    ]);
  });

  it('sends the bearer token on /v1/me/* and surfaces 410 as a typed problem', async () => {
    const seen: (string | null)[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      auth: synthetic.token,
      fetch: (input: string | URL | Request) => {
        seen.push(new Request(input).headers.get('authorization'));
        return Promise.resolve(
          jsonResponse(problem('ACCOUNT_DELETED'), 410, 'application/problem+json'),
        );
      },
    });
    const { data, error } = await listConsents({ client });
    expect(data).toBeUndefined();
    expect(error?.code).toBe('ACCOUNT_DELETED');
    expect(error?.status).toBe(410);
    expect(seen).toEqual([`Bearer ${synthetic.token}`]);
  });
});

describe('generated ts-client: profile', () => {
  const token = 'synthetic-session-token';
  const stored: Preferences = {
    version: 4,
    fitPreferences: { tops: 'regular' },
    styleTypes: ['minimal'],
    softDislikes: [],
    hardExclusions: [{ kind: 'material', value: 'wool' }],
    occasionPresets: ['work_day'],
    sizingByRegion: [],
  };

  it('bundle exposes every profile operation with its operationId', () => {
    expect(operationsTagged('profile')).toEqual([
      'GET /v1/me/measurements getMeasurements',
      'GET /v1/me/onboarding-progress getOnboardingProgress',
      'GET /v1/me/preferences getPreferences',
      'GET /v1/me/profile getProfile',
      'PATCH /v1/me/onboarding-progress updateOnboardingProgress',
      'PATCH /v1/me/preferences updatePreferences',
      'PATCH /v1/me/profile updateProfile',
      'PUT /v1/me/measurements replaceMeasurements',
    ]);
  });

  it('types a versioned write: the resource, or a problem that may carry the current state', () => {
    expectTypeOf<UpdatePreferencesResponse>().toEqualTypeOf<Preferences>();
    expectTypeOf<PreferencesVersionConflict>().toExtend<ProblemDetails>();
    expectTypeOf<UpdatePreferencesError>().toEqualTypeOf<
      ProblemDetails | PreferencesVersionConflict
    >();
  });

  it('sends If-Match, Idempotency-Key and a partial body; answers the new version', async () => {
    const seen: { ifMatch: string | null; idempotencyKey: string | null; body: unknown }[] = [];
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      auth: token,
      fetch: async (input: string | URL | Request) => {
        const request = new Request(input);
        seen.push({
          ifMatch: request.headers.get('if-match'),
          idempotencyKey: request.headers.get('idempotency-key'),
          body: await request.json(),
        });
        return jsonResponse({ ...stored, version: 5, climateTolerance: 'runs_cold' });
      },
    });
    const idempotencyKey = '00000000000000000000000001';
    const { data, error } = await updatePreferences({
      client,
      headers: { 'If-Match': '"4"', 'Idempotency-Key': idempotencyKey },
      body: { climateTolerance: 'runs_cold', clear: ['typicalDay'] },
    });
    expect(error).toBeUndefined();
    expect(data?.version).toBe(5);
    expect(seen).toEqual([
      {
        ifMatch: '"4"',
        idempotencyKey,
        body: { climateTolerance: 'runs_cold', clear: ['typicalDay'] },
      },
    ]);
  });

  it('surfaces 409 VERSION_MISMATCH with the stored preferences', async () => {
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      auth: token,
      fetch: () =>
        Promise.resolve(
          jsonResponse(
            { ...problem('VERSION_MISMATCH'), current: stored },
            409,
            'application/problem+json',
          ),
        ),
    });
    const { data, error } = await updatePreferences({
      client,
      headers: { 'If-Match': '"3"' },
      body: { styleTypes: ['classic'] },
    });
    expect(data).toBeUndefined();
    expect(error?.code).toBe('VERSION_MISMATCH');
    expect(error && 'current' in error ? error.current?.version : undefined).toBe(4);
  });
});

describe('generated ts-client: billing', () => {
  it('bundle exposes the billing operation with its operationId', () => {
    expect(operationsTagged('billing')).toEqual(['GET /v1/me/entitlements getEntitlements']);
  });

  it('types the entitlement state; an unlimited limit is null', () => {
    expectTypeOf<GetEntitlementsResponse>().toEqualTypeOf<EntitlementState>();
    expectTypeOf<ResolvedEntitlement['limit']>().toEqualTypeOf<number | null | undefined>();
  });

  it('reads the trial state with its end and one value per entitlement kind', async () => {
    const answer: EntitlementState = {
      state: 'trial',
      stateEndsAt: '2026-10-24T10:00:00Z',
      entitlements: [
        { name: 'closet.max_items', source: 'trial_grant', limit: null },
        { name: 'tryon.generative', source: 'trial_grant', level: 'G2' },
        { name: 'data.export', granted: true },
      ],
    };
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      auth: 'synthetic-session-token',
      fetch: () => Promise.resolve(jsonResponse(answer)),
    });
    const { data, error } = await getEntitlements({ client });
    expect(error).toBeUndefined();
    expect(data).toEqual(answer);
  });
});
