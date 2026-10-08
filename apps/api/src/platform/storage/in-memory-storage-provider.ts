// In-memory adapter for the shared-kernel `StorageProvider` port. `createStorageProvider` binds it
// for local runs, dev, tests and CI when no R2 key is set; the R2 adapter is
// ./r2-storage-provider.ts. Module tests use `fakeStorageProvider` from `@ai-stylist/test-support`
// (they may not import platform).
import {
  type PresignGetRequest,
  type PresignPutRequest,
  type PresignedUrl,
  StorageError,
  type StorageProvider,
  assertUploadConstraints,
  clampTtl,
  objectKeyOf,
} from '@ai-stylist/shared-kernel';

type StoredObject = { readonly contentType: string; readonly sizeLimitBytes: number };

/**
 * In-memory StorageProvider for tests and local runs without R2 credentials (never staging or
 * prod: `loadConfig` refuses that). Refuses the same requests as the R2 adapter (`objectKeyOf`,
 * `assertUploadConstraints`, `clampTtl`); `objects` is keyed by `u/<userId>/<namespace>/<key>`.
 */
export class InMemoryStorageProvider implements StorageProvider {
  readonly objects = new Map<string, StoredObject>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly baseUrl = 'memory://storage',
  ) {}

  // A throw inside a promise executor rejects that promise: every refusal is a rejected promise.
  presignedPut(request: PresignPutRequest): Promise<PresignedUrl> {
    return new Promise((resolve) => {
      const id = objectKeyOf(request);
      assertUploadConstraints(request);
      const ttl = clampTtl(request.ttlSeconds, 'PUT');
      this.objects.set(id, {
        contentType: request.contentType,
        sizeLimitBytes: request.sizeLimitBytes,
      });
      resolve(this.presign('PUT', id, ttl));
    });
  }

  presignedGet(request: PresignGetRequest): Promise<PresignedUrl> {
    return new Promise((resolve) => {
      const id = objectKeyOf(request);
      const ttl = clampTtl(request.ttlSeconds, 'GET');
      if (!this.objects.has(id)) {
        throw new StorageError(`object not found in namespace "${request.namespace}"`);
      }
      resolve(this.presign('GET', id, ttl));
    });
  }

  private presign(method: 'PUT' | 'GET', id: string, ttl: number): PresignedUrl {
    const expiresAt = new Date(this.now().getTime() + ttl * 1000).toISOString();
    return { method, url: `${this.baseUrl}/${id}?expires=${expiresAt}`, expiresAt };
  }
}
