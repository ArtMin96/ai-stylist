// StorageProvider port (brief §6, doc 11 §5): presigned PUT/GET with a hard TTL cap, content-type,
// size, user-prefix and namespace constraints. The interface, its DI token and the request checks
// every adapter shares; the adapters (R2 and the local in-memory one) live in `platform/storage/`,
// and module tests use `fakeStorageProvider` from `@ai-stylist/test-support`. Shared by `media` and
// `avatar` (doc 04 §4.1 has no avatar → media edge), hence the kernel.
//
// Object keys are `u/<userId>/<namespace>/<key>` (doc 11 §4.3): all media of one user sits under
// one prefix, which account deletion lists and deletes (doc 11 §13.2 step 4). No request can name
// an object outside `u/<its userId>/`. Which user a request may act for is the calling module's
// authorization (it passes the authenticated principal's id).
//
// Not enforced here (business rules of the `media` module, P06): the content-type allowlist and
// the maximum upload size of doc 11 §5.4/§5.5 (JPEG/PNG/HEIC, about 20 MB). This port only signs
// the exact type and size the caller passes; the `media` caller enforces the allowlist and the cap
// before it asks for a URL, and that is a P06 exit criterion. P06 workers fetch originals with
// HTTP decompression disabled: `Content-Encoding` is not a signed header, and whether R2 stores an
// unsigned `Content-Encoding` sent with a presigned PUT has not been verified against R2.
import { type Id, isId } from '../ids.js';

/** Presigned GET (read) URLs live at most 10 minutes (doc 11 §5.4). */
export const MAX_PRESIGN_GET_TTL_SECONDS = 10 * 60;
/** Presigned PUT/multipart (write) URLs live at most 15 minutes (doc 11 §5.4). */
export const MAX_PRESIGN_PUT_TTL_SECONDS = 15 * 60;

/** The key prefixes inside a user's `u/<userId>/` (runtime list of `StorageNamespace`). */
export const STORAGE_NAMESPACES = ['uploads', 'derived', 'avatars'] as const;
export type StorageNamespace = (typeof STORAGE_NAMESPACES)[number];

/** S3/R2 limit on a whole object key (`u/<userId>/<namespace>/<key>`), in bytes. */
const MAX_OBJECT_KEY_BYTES = 1024;
/** One key segment: unreserved URI characters only, so the key needs no encoding in a URL. */
const KEY_SEGMENT = /^[A-Za-z0-9._-]+$/;
/** A bare media type `type/subtype` (RFC 6838 restricted names), no parameters, no whitespace. */
const MEDIA_TYPE =
  /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;

/** Where an object lives: `u/<userId>/<namespace>/<key>`. */
export type StorageLocation = {
  /**
   * Owner of the object (`usr_<ULID>`): the authenticated principal whose access the calling module
   * checked. Every object key starts with `u/<userId>/`; a malformed id is refused.
   */
  readonly userId: Id<'user'>;
  readonly namespace: StorageNamespace;
  /** Object key inside the user's namespace (no leading slash). */
  readonly key: string;
};

export type PresignPutRequest = StorageLocation & {
  /**
   * A bare media type, signed as `Content-Type`. The allowlist (doc 11 §5.5) is the `media`
   * caller's rule, enforced before this call (P06), not this port's.
   */
  readonly contentType: string;
  /**
   * Byte size of the upload, enforced at upload time. The R2 adapter signs it as `Content-Length`,
   * so the PUT must send exactly this many bytes (a presigned S3 PUT cannot express a range). The
   * maximum size (doc 11 §5.5) is the `media` caller's rule (P06), not this port's.
   */
  readonly sizeLimitBytes: number;
  /** Seconds until the URL expires; clamped to MAX_PRESIGN_PUT_TTL_SECONDS. */
  readonly ttlSeconds: number;
};

export type PresignGetRequest = StorageLocation & {
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

/** DI token. `Symbol.for`: two installed copies of the kernel resolve to the same token. */
export const STORAGE_PROVIDER: unique symbol = Symbol.for('ai-stylist.storage-provider');

/** Which request constraint a refused presign broke; adapters log it, never the value. */
export type PresignRefusal = 'user_id' | 'namespace' | 'key' | 'content_type' | 'size' | 'ttl';

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
 * The object key `u/<userId>/<namespace>/<key>` a request may address (doc 11 §4.3). Refuses
 * (without echoing the input) a user id that is not a `usr_<ULID>` (`isId`, shared kernel), an
 * unknown namespace and any key that could leave the namespace or be rewritten on the way: an
 * absolute key, an empty, `.` or `..` segment, and every character outside `[A-Za-z0-9._-]` and `/`
 * (so no backslash, percent-encoding, whitespace or control character). So no request reaches
 * outside `u/<its userId>/`: a key that spells another user's prefix (`u/usr_…/x.jpg`) is only a
 * nested path inside the caller's own namespace.
 */
export function objectKeyOf(location: StorageLocation): string {
  const { userId, namespace, key } = location;
  if (typeof userId !== 'string' || !isId(userId, 'user')) {
    throw new StorageError('userId must be a user id (usr_<ULID>)', 'user_id');
  }
  if (!(STORAGE_NAMESPACES as readonly string[]).includes(namespace)) {
    throw new StorageError(
      `namespace must be one of ${STORAGE_NAMESPACES.join(', ')}`,
      'namespace',
    );
  }
  const prefix = `u/${userId}/${namespace}/`;
  const confined =
    typeof key === 'string' &&
    key.length > 0 &&
    prefix.length + key.length <= MAX_OBJECT_KEY_BYTES &&
    key.split('/').every((segment) => KEY_SEGMENT.test(segment) && !/^\.\.?$/.test(segment));
  if (!confined) {
    throw new StorageError(
      'key must stay inside its namespace: "/"-separated segments of [A-Za-z0-9._-], none empty, "." or ".."',
      'key',
    );
  }
  return `${prefix}${key}`;
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
