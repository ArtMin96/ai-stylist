// StorageProvider port (brief §6, doc 11 §5): presigned PUT/GET with a hard TTL cap, content-type,
// size and namespace constraints. The interface, the request checks every adapter shares and the
// in-memory fake; the R2 adapter is ../storage/r2-storage-provider.ts (P02-T13).

/** Presigned GET (read) URLs live at most 10 minutes (doc 11 §5.4). */
export const MAX_PRESIGN_GET_TTL_SECONDS = 10 * 60;
/** Presigned PUT/multipart (write) URLs live at most 15 minutes (doc 11 §5.4). */
export const MAX_PRESIGN_PUT_TTL_SECONDS = 15 * 60;

/** The top-level key prefixes a presigned URL may point into (runtime list of `StorageNamespace`). */
export const STORAGE_NAMESPACES = ['uploads', 'derived', 'avatars'] as const;
export type StorageNamespace = (typeof STORAGE_NAMESPACES)[number];

/** S3/R2 limit on a whole object key (`<namespace>/<key>`), in bytes. */
const MAX_OBJECT_KEY_BYTES = 1024;
/** One key segment: unreserved URI characters only, so the key needs no encoding in a URL. */
const KEY_SEGMENT = /^[A-Za-z0-9._-]+$/;
/** A bare media type `type/subtype` (RFC 6838 restricted names), no parameters, no whitespace. */
const MEDIA_TYPE =
  /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;

export type PresignPutRequest = {
  readonly namespace: StorageNamespace;
  /** Object key inside the namespace (no leading slash). */
  readonly key: string;
  readonly contentType: string;
  /**
   * Byte size of the upload, enforced at upload time. The R2 adapter signs it as `Content-Length`,
   * so the PUT must send exactly this many bytes (a presigned S3 PUT cannot express a range).
   */
  readonly sizeLimitBytes: number;
  /** Seconds until the URL expires; clamped to MAX_PRESIGN_PUT_TTL_SECONDS. */
  readonly ttlSeconds: number;
};

export type PresignGetRequest = {
  readonly namespace: StorageNamespace;
  readonly key: string;
  /** Seconds until the URL expires; clamped to MAX_PRESIGN_GET_TTL_SECONDS. */
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

/** Which request constraint a refused presign broke; adapters log it, never the value. */
export type PresignRefusal = 'namespace' | 'key' | 'content_type' | 'size' | 'ttl';

export class StorageError extends Error {
  override readonly name = 'StorageError';

  constructor(
    message: string,
    /** Set when a presign request was refused before any URL was minted. */
    readonly refusal?: PresignRefusal,
  ) {
    super(message);
  }
}

/**
 * Clamp a requested TTL to the policy cap for the URL's method (GET 10 min, PUT 15 min); a TTL
 * under one second (it would floor to an already-expired 0) or not a number is rejected.
 */
export function clampTtl(ttlSeconds: number, method: PresignedUrl['method']): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds < 1) {
    throw new StorageError(`ttlSeconds must be at least 1, got ${ttlSeconds}`, 'ttl');
  }
  const cap = method === 'GET' ? MAX_PRESIGN_GET_TTL_SECONDS : MAX_PRESIGN_PUT_TTL_SECONDS;
  return Math.min(Math.floor(ttlSeconds), cap);
}

/**
 * The object key `<namespace>/<key>` a request may address. Refuses (without echoing the input) an
 * unknown namespace and any key that could leave it or be rewritten on the way: an absolute key,
 * an empty, `.` or `..` segment, and every character outside `[A-Za-z0-9._-]` and `/` (so no
 * backslash, percent-encoding, whitespace or control character).
 */
export function objectKeyOf(namespace: string, key: string): string {
  if (!(STORAGE_NAMESPACES as readonly string[]).includes(namespace)) {
    throw new StorageError(
      `namespace must be one of ${STORAGE_NAMESPACES.join(', ')}`,
      'namespace',
    );
  }
  const confined =
    typeof key === 'string' &&
    key.length > 0 &&
    namespace.length + 1 + key.length <= MAX_OBJECT_KEY_BYTES &&
    key.split('/').every((segment) => KEY_SEGMENT.test(segment) && !/^\.\.?$/.test(segment));
  if (!confined) {
    throw new StorageError(
      'key must stay inside its namespace: "/"-separated segments of [A-Za-z0-9._-], none empty, "." or ".."',
      'key',
    );
  }
  return `${namespace}/${key}`;
}

/** Validates the type and size a presigned PUT signs; never echoes the values. */
export function assertUploadConstraints(request: PresignPutRequest): void {
  if (typeof request.contentType !== 'string' || !MEDIA_TYPE.test(request.contentType)) {
    throw new StorageError(
      'contentType must be a bare media type "type/subtype" (no parameters)',
      'content_type',
    );
  }
  if (!Number.isSafeInteger(request.sizeLimitBytes) || request.sizeLimitBytes <= 0) {
    throw new StorageError('sizeLimitBytes must be a positive integer', 'size');
  }
}

type StoredObject = { readonly contentType: string; readonly sizeLimitBytes: number };

/**
 * In-memory StorageProvider for tests and local runs without R2 credentials. Refuses the same
 * requests as the R2 adapter (`objectKeyOf`, `assertUploadConstraints`, `clampTtl`).
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
      const id = objectKeyOf(request.namespace, request.key);
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
      const id = objectKeyOf(request.namespace, request.key);
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
