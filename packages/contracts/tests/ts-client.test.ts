// Consumes the generated hey-api client (AC-2): the SDK compiles against the fetch client, the
// response types match the OpenAPI schemas, and problem responses are typed as ProblemDetails.
import { type ProblemDetails as KernelProblem, problem } from '@ai-stylist/shared-kernel';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  type GetHealthError,
  type GetHealthResponse,
  type GetVersionResponse,
  type HealthReport,
  type ProblemDetails,
  type VersionInfo,
  getHealth,
  getVersion,
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
