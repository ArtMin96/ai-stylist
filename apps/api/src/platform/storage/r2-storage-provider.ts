// R2 adapter of the StorageProvider port (doc 11 §5.4, DEC-44): presigned PUT and GET URLs on R2's
// S3 endpoint, signed in process (./sigv4-presign.ts): minting makes no network call. Translation
// only: which user a caller may act for is its module's authorization decision; this adapter
// enforces the port's constraints and nothing else.
//
// - User and namespace confinement: the URL points at `/<bucket>/u/<userId>/<namespace>/<key>`
//   (doc 11 §4.3); `objectKeyOf` refuses a user id that is not `usr_<ULID>`, an unknown namespace
//   and any key that could leave it (absolute, empty, `.` or `..` segments, characters outside
//   `[A-Za-z0-9._-]`). The path is part of the signature, so a URL edited to another user, namespace
//   or key fails.
// - PUT signs `content-type` and `content-length`: an upload of another type or another size
//   (larger or smaller) fails R2's signature check. GET signs `host` only.
// - TTL: `clampTtl` (GET ≤ 10 min, PUT ≤ 15 min). `expiresAt` is X-Amz-Date (whole seconds) + TTL.
// - Logs: method, namespace, TTL and the refusal reason only. Never the URL, its query (the
//   signature and the access key id), the user id, the key, the content type or a credential.
// - Credentials live in `#private` fields: not an own property, so `util.inspect`,
//   `JSON.stringify` and a logged provider never show them.
import type { Logger } from 'pino';

import {
  type Clock,
  type PresignGetRequest,
  type PresignPutRequest,
  type PresignedUrl,
  StorageError,
  type StorageProvider,
  assertUploadConstraints,
  clampTtl,
  objectKeyOf,
} from '@ai-stylist/shared-kernel';

import { SystemClock } from '../system-clock.js';

import { type SigV4Credentials, presignUrl, uriEncode } from './sigv4-presign.js';

/** R2 signs every request for the one region `auto` (the bucket's location is not in the URL). */
export const R2_SIGNING_REGION = 'auto';
const R2_SIGNING_SERVICE = 's3';
// The shape of each R2_* key lives here only: apps/api/src/config.ts checks presence and
// all-or-none, and a malformed value fails at boot when the composition root builds this adapter
// (`AppModule.forRoot` → `createStorageProvider`), with an error naming the key, never the value.
/** Cloudflare account ids are 32 lowercase hex characters; the id becomes the endpoint host. */
const CLOUDFLARE_ACCOUNT_ID = /^[0-9a-f]{32}$/;
/** R2 bucket names: 3–63 lowercase letters, digits and hyphens, not starting or ending with `-`. */
const R2_BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const ACCESS_KEY_ID = /^[A-Za-z0-9]+$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export type R2StorageProviderOptions = {
  /** `R2_ACCOUNT_ID`. */
  readonly accountId: string;
  /** `R2_ACCESS_KEY_ID` of a token scoped to `bucket` (Object Read & Write). */
  readonly accessKeyId: string;
  /** `R2_SECRET_ACCESS_KEY`. */
  readonly secretAccessKey: string;
  /** `R2_BUCKET`: the private user-media bucket of this environment. */
  readonly bucket: string;
  /**
   * S3 endpoint origin, default `https://<accountId>.r2.cloudflarestorage.com` (an EU-jurisdiction
   * bucket is served from `https://<accountId>.eu.r2.cloudflarestorage.com`). `http:` is accepted
   * for a loopback host only (the tests' local endpoint).
   */
  readonly endpoint?: string;
  /** A pino logger built from `loggerOptions()`. */
  readonly logger: Logger;
  readonly clock?: Clock;
};

/** The S3 endpoint of an account's default-jurisdiction buckets. */
export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * Checks the options without echoing a value (the secret must never reach an error or a log). Each
 * message names the option and its env key; an empty value fails like a malformed one.
 */
function endpointOrigin(options: R2StorageProviderOptions): string {
  if (!CLOUDFLARE_ACCOUNT_ID.test(options.accountId)) {
    throw new TypeError(
      'R2: accountId (R2_ACCOUNT_ID) must be a Cloudflare account id (32 lowercase hex)',
    );
  }
  if (!ACCESS_KEY_ID.test(options.accessKeyId)) {
    throw new TypeError('R2: accessKeyId (R2_ACCESS_KEY_ID) must be letters and digits only');
  }
  if (options.secretAccessKey.length === 0 || /\s/.test(options.secretAccessKey)) {
    throw new TypeError(
      'R2: secretAccessKey (R2_SECRET_ACCESS_KEY) must be non-empty without whitespace',
    );
  }
  if (!R2_BUCKET_NAME.test(options.bucket)) {
    throw new TypeError('R2: bucket (R2_BUCKET) must be an R2 bucket name (3-63 of a-z, 0-9, -)');
  }
  const url = new URL(options.endpoint ?? r2Endpoint(options.accountId));
  const secure =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
  if (!secure || url.pathname !== '/' || url.search !== '' || url.username !== '') {
    throw new TypeError('R2: endpoint must be an https origin (http only for a loopback host)');
  }
  return url.origin;
}

type SigningPlan = {
  readonly objectKey: string;
  readonly ttlSeconds: number;
  readonly headers: Readonly<Record<string, string>>;
};

export class R2StorageProvider implements StorageProvider {
  readonly #origin: string;
  readonly #bucket: string;
  readonly #credentials: SigV4Credentials;
  readonly #clock: Clock;
  readonly #logger: Logger;

  constructor(options: R2StorageProviderOptions) {
    this.#origin = endpointOrigin(options);
    this.#bucket = options.bucket;
    this.#credentials = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    };
    this.#clock = options.clock ?? new SystemClock();
    this.#logger = options.logger;
  }

  // A throw inside a promise executor rejects that promise: every refusal is a rejected promise.
  presignedPut(request: PresignPutRequest): Promise<PresignedUrl> {
    return new Promise((resolve) => {
      resolve(
        this.#mint('PUT', request.namespace, () => {
          const objectKey = objectKeyOf(request);
          assertUploadConstraints(request);
          return {
            objectKey,
            ttlSeconds: clampTtl(request.ttlSeconds, 'PUT'),
            headers: {
              'content-type': request.contentType,
              'content-length': String(request.sizeLimitBytes),
            },
          };
        }),
      );
    });
  }

  /** Signs without checking that the object exists (that would cost a request); R2 answers 404. */
  presignedGet(request: PresignGetRequest): Promise<PresignedUrl> {
    return new Promise((resolve) => {
      resolve(
        this.#mint('GET', request.namespace, () => ({
          objectKey: objectKeyOf(request),
          ttlSeconds: clampTtl(request.ttlSeconds, 'GET'),
          headers: {},
        })),
      );
    });
  }

  /** Signs the planned request; a refusal is logged by reason and rethrown. */
  #mint(method: PresignedUrl['method'], namespace: string, plan: () => SigningPlan): PresignedUrl {
    let signing: SigningPlan;
    try {
      signing = plan();
    } catch (error) {
      if (error instanceof StorageError && error.refusal !== undefined) {
        this.#logger.warn(
          { component: 'storage', provider: 'r2', method, refusal: error.refusal },
          'presign refused',
        );
      }
      throw error;
    }
    const signingDate = new Date(Math.floor(this.#clock.now().getTime() / 1000) * 1000);
    const path = `/${[this.#bucket, ...signing.objectKey.split('/')].map(uriEncode).join('/')}`;
    const url = presignUrl({
      method,
      origin: this.#origin,
      path,
      headers: signing.headers,
      credentials: this.#credentials,
      region: R2_SIGNING_REGION,
      service: R2_SIGNING_SERVICE,
      signingDate,
      expiresInSeconds: signing.ttlSeconds,
    });
    this.#logger.debug(
      { component: 'storage', provider: 'r2', method, namespace, ttlSeconds: signing.ttlSeconds },
      'presigned url minted',
    );
    const expiresAt = new Date(signingDate.getTime() + signing.ttlSeconds * 1000).toISOString();
    return { method, url, expiresAt };
  }
}
