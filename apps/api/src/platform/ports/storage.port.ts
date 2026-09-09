// StorageProvider port (brief §6, doc 11 §5): presigned PUT/GET with a hard TTL cap, content-type,
// size and namespace constraints. Interface + in-memory fake only; the R2 adapter lands in T13.

/** Presigned URLs live at most 15 minutes (doc 11 §5). */
export const MAX_PRESIGN_TTL_SECONDS = 15 * 60;

export type StorageNamespace = 'uploads' | 'derived' | 'avatars';

export type PresignPutRequest = {
  readonly namespace: StorageNamespace;
  /** Object key inside the namespace (no leading slash). */
  readonly key: string;
  readonly contentType: string;
  /** Maximum accepted object size in bytes; the adapter enforces it at upload time. */
  readonly sizeLimitBytes: number;
  /** Seconds until the URL expires; clamped to MAX_PRESIGN_TTL_SECONDS. */
  readonly ttlSeconds: number;
};

export type PresignGetRequest = {
  readonly namespace: StorageNamespace;
  readonly key: string;
  readonly ttlSeconds: number;
};

export type PresignedUrl = {
  readonly url: string;
  /** RFC 3339 instant after which the URL is rejected. */
  readonly expiresAt: string;
  readonly method: 'PUT' | 'GET';
};

export type StorageProvider = {
  presignedPut(request: PresignPutRequest): Promise<PresignedUrl>;
  presignedGet(request: PresignGetRequest): Promise<PresignedUrl>;
};

export const STORAGE_PROVIDER = Symbol('StorageProvider');

export class StorageError extends Error {
  override readonly name = 'StorageError';
}

/** Clamp a requested TTL to the policy cap; non-positive values are rejected. */
export function clampTtl(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new StorageError(`ttlSeconds must be positive, got ${ttlSeconds}`);
  }
  return Math.min(Math.floor(ttlSeconds), MAX_PRESIGN_TTL_SECONDS);
}

type StoredObject = { readonly contentType: string; readonly sizeLimitBytes: number };

/** In-memory StorageProvider for tests and local runs without R2 credentials. */
export class InMemoryStorageProvider implements StorageProvider {
  readonly objects = new Map<string, StoredObject>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly baseUrl = 'memory://storage',
  ) {}

  presignedPut(request: PresignPutRequest): Promise<PresignedUrl> {
    if (request.sizeLimitBytes <= 0) {
      return Promise.reject(new StorageError('sizeLimitBytes must be positive'));
    }
    if (!request.contentType.includes('/')) {
      return Promise.reject(
        new StorageError(`contentType must be a media type, got "${request.contentType}"`),
      );
    }
    const ttl = clampTtl(request.ttlSeconds);
    const id = `${request.namespace}/${request.key}`;
    this.objects.set(id, {
      contentType: request.contentType,
      sizeLimitBytes: request.sizeLimitBytes,
    });
    return Promise.resolve(this.presign('PUT', id, ttl));
  }

  presignedGet(request: PresignGetRequest): Promise<PresignedUrl> {
    const ttl = clampTtl(request.ttlSeconds);
    const id = `${request.namespace}/${request.key}`;
    if (!this.objects.has(id)) {
      return Promise.reject(
        new StorageError(`object not found in namespace "${request.namespace}"`),
      );
    }
    return Promise.resolve(this.presign('GET', id, ttl));
  }

  private presign(method: 'PUT' | 'GET', id: string, ttl: number): PresignedUrl {
    const expiresAt = new Date(this.now().getTime() + ttl * 1000).toISOString();
    return { method, url: `${this.baseUrl}/${id}?expires=${expiresAt}`, expiresAt };
  }
}
