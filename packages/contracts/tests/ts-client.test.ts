// Consumes the generated hey-api client (AC-2): the SDK compiles against the fetch client, the
// response types match the OpenAPI schemas, and problem responses are typed as ProblemDetails.
import { type ProblemDetails as KernelProblem, problem } from '@ai-stylist/shared-kernel';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  type CompleteSignUpResponse,
  type ConsentPage,
  type GetHealthError,
  type GetHealthResponse,
  type GetVersionResponse,
  type HealthReport,
  type ListConsentsResponse,
  type ProblemDetails,
  type RecordConsentError,
  type SignInResult,
  type SignInWithIdTokenResponse,
  type SignInWithPasskeyResponse,
  type VersionInfo,
  getHealth,
  getVersion,
  listConsents,
  signInWithIdToken,
} from '../gen/ts-client/index.js';
import { createClient } from '../gen/ts-client/client/index.js';
import bundle from '../gen/openapi.bundle.json' with { type: 'json' };

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
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

  it('bundle exposes every identity operation with its operationId', () => {
    const paths: Record<string, Record<string, { operationId: string }>> = bundle.paths;
    const operationIds = Object.entries(paths)
      .filter(([path]) => path.startsWith('/v1/auth/') || path.startsWith('/v1/me/'))
      .flatMap(([path, item]) =>
        Object.entries(item).map(
          ([method, op]) => `${method.toUpperCase()} ${path} ${op.operationId}`,
        ),
      )
      .sort();
    expect(operationIds).toEqual([
      'DELETE /v1/me/recovery cancelAccountRecovery',
      'GET /v1/auth/get-session getSession',
      'GET /v1/auth/list-sessions listDeviceSessions',
      'GET /v1/auth/magic-link/verify completeAccountRecovery',
      'GET /v1/auth/passkey/generate-authenticate-options getPasskeySignInOptions',
      'GET /v1/auth/passkey/generate-register-options getPasskeyRegistrationOptions',
      'GET /v1/me/consents listConsents',
      'POST /v1/auth/get-session refreshSession',
      'POST /v1/auth/passkey/verify-authentication signInWithPasskey',
      'POST /v1/auth/passkey/verify-registration registerPasskey',
      'POST /v1/auth/revoke-sessions signOutAllDevices',
      'POST /v1/auth/sign-in/magic-link requestAccountRecovery',
      'POST /v1/auth/sign-in/social signInWithIdToken',
      'POST /v1/auth/sign-out signOut',
      'POST /v1/auth/sign-up/complete completeSignUp',
      'POST /v1/me/consents recordConsent',
    ]);
  });

  it('types every sign-in answer as one SignInResult', () => {
    expectTypeOf<SignInWithIdTokenResponse>().toEqualTypeOf<SignInResult>();
    expectTypeOf<SignInWithPasskeyResponse>().toEqualTypeOf<SignInResult>();
    expectTypeOf<CompleteSignUpResponse>().toEqualTypeOf<SignInResult>();
    expectTypeOf<SignInResult['outcome']>().toEqualTypeOf<
      'session' | 'deletion_pending' | 'sign_up_required'
    >();
    expectTypeOf<ListConsentsResponse>().toEqualTypeOf<ConsentPage>();
    expectTypeOf<RecordConsentError>().toEqualTypeOf<ProblemDetails>();
  });

  it('posts an identity token without credentials and returns the session outcome', async () => {
    const calls: { line: string; authorization: string | null; body: unknown }[] = [];
    const answer: SignInResult = {
      outcome: 'session',
      session: { ...synthetic, expiresAt: '2026-10-21T10:00:00Z' },
    };
    const client = createClient({
      baseUrl: 'http://localhost:3000',
      auth: synthetic.token,
      fetch: async (input: string | URL | Request) => {
        const request = new Request(input);
        calls.push({
          line: `${request.method} ${new URL(request.url).pathname}`,
          authorization: request.headers.get('authorization'),
          body: await request.json(),
        });
        return jsonResponse(answer);
      },
    });
    const { data, error } = await signInWithIdToken({
      client,
      body: { provider: 'google', idToken: { token: 'synthetic-id-token' } },
    });
    expect(error).toBeUndefined();
    expect(data?.outcome).toBe('session');
    expect(data?.session?.userId).toBe(synthetic.userId);
    expect(calls).toEqual([
      {
        line: 'POST /v1/auth/sign-in/social',
        authorization: null,
        body: { provider: 'google', idToken: { token: 'synthetic-id-token' } },
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
