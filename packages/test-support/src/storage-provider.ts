/** One presign request as the fake saw it (the shared-kernel request types, structurally). */
export type FakePresignRequest = {
  readonly userId: string;
  readonly namespace: string;
  readonly key: string;
  readonly ttlSeconds: number;
  /** PUT only. */
  readonly contentType?: string;
  /** PUT only. */
  readonly sizeLimitBytes?: number;
};

export type FakePresignedUrl = {
  readonly url: string;
  readonly expiresAt: string;
  readonly method: 'PUT' | 'GET';
};

/**
 * Structural match for the shared-kernel `StorageProvider` port
 * (packages/shared-kernel/src/ports/storage.ts), plus the requests it received. For module tests,
 * which may not import platform's `InMemoryStorageProvider`. It does not enforce the port's request
 * checks (TTL caps, key confinement, media type): those are the adapters' behaviour, tested in
 * `apps/api/src/platform/tests/`.
 */
export type FakeStorageProvider = {
  presignedPut(
    request: FakePresignRequest & { readonly contentType: string; readonly sizeLimitBytes: number },
  ): Promise<FakePresignedUrl>;
  presignedGet(request: FakePresignRequest): Promise<FakePresignedUrl>;
  /** Every request, in order, with the method it was signed for. */
  readonly requests: readonly (FakePresignRequest & { readonly method: 'PUT' | 'GET' })[];
};

/**
 * Deterministic presigner: the URL is `fake://storage/u/<userId>/<namespace>/<key>?method=<M>` and
 * `expiresAt` is `now() + ttlSeconds` (pass `() => clock.now()` of a `fakeClock` to control it).
 */
export function fakeStorageProvider(now: () => Date = () => new Date()): FakeStorageProvider {
  const requests: (FakePresignRequest & { readonly method: 'PUT' | 'GET' })[] = [];
  const sign = (method: 'PUT' | 'GET', request: FakePresignRequest): Promise<FakePresignedUrl> => {
    requests.push({ ...request, method });
    const { userId, namespace, key, ttlSeconds } = request;
    return Promise.resolve({
      method,
      url: `fake://storage/u/${userId}/${namespace}/${key}?method=${method}`,
      expiresAt: new Date(now().getTime() + ttlSeconds * 1000).toISOString(),
    });
  };
  return {
    requests,
    presignedPut: (request) => sign('PUT', request),
    presignedGet: (request) => sign('GET', request),
  };
}
