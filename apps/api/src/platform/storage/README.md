# platform/storage — the `StorageProvider` port's R2 adapter (P02-T13)

The port, its DI token `STORAGE_PROVIDER`, the request checks every adapter shares (`clampTtl`,
`objectKeyOf`, `assertUploadConstraints`) and the in-memory provider live in
`../ports/storage.port.ts` (P02-interim placement; the port moves to `packages/shared-kernel` before
the first domain module injects it). Policy: doc 11 §4.3 (media keys under `u/<user_id>/`), §5.4
(TTL ≤ 10 min GET, ≤ 15 min PUT; content type, size and the caller's own key namespace), DEC-44
(private user media = presigned GET on R2's S3 endpoint, uncached; public assets only through a
custom domain, not this adapter).

## Files

- `create-storage-provider.ts`: `createStorageProvider({ accountId, accessKeyId, secretAccessKey,
bucket, clock, logger })` → `StorageProvider`. The composition root passes the validated
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` (`apps/api/src/config.ts`);
  nothing here reads `process.env`. All four set → `R2StorageProvider`; none → the
  `InMemoryStorageProvider`; some → a `TypeError` naming the missing keys (`loadConfig` refuses the
  same set first). `loadConfig` also refuses to boot with none of the four keys when `APP_ENV` is
  `staging` or `prod` or `NODE_ENV` is `production` (`allowsInMemoryStorage`, doc 15 §11: staging
  and prod use real R2 buckets), so the in-memory provider is bound only in local, dev and test runs.
  Behind that, the factory refuses the in-memory provider itself when the composition root passes
  `allowsInMemory: allowsInMemoryStorage(config)` as `false` (defence in depth).
- `r2-storage-provider.ts`: `R2StorageProvider`, `r2Endpoint(accountId)`.
- `sigv4-presign.ts`: AWS Signature Version 4 query presigning on `node:crypto` (no SDK; see
  "Signer" below).

## Object keys: `u/<userId>/<namespace>/<key>`

Every request carries a required `userId: Id<'user'>` (`@ai-stylist/shared-kernel`), and every
object key is `u/<userId>/<namespace>/<key>` (doc 11 §4.3), so account deletion lists and deletes
one prefix per user (doc 11 §13.2 step 4). `objectKeyOf` refuses a user id that is not a
`usr_<ULID>` (`isId(userId, 'user')`, refusal `user_id`), so no request can address an object
outside `u/<its userId>/`: a key that spells another user's prefix (`u/usr_…/x.jpg`) is only a
nested path inside the caller's own namespace. Which user a request may act for is the calling
module's authorization: it passes the authenticated principal's id, after the same user-scope check
as the database row (doc 11 §4.3, §5.4).

## Not enforced here: the `media` caller's rules (P06)

doc 11 §5.4 constrains a write URL to a content-type allowlist and a maximum size; §5.5 names them
(JPEG/PNG/HEIC, about 20 MB). Both are business rules of the `media` module, not of this adapter:
the port signs exactly the `contentType` and `sizeLimitBytes` the caller passes, and the `media`
caller enforces the allowlist and the size cap before it asks for a URL. That is a P06 exit
criterion. P06 workers fetch originals with HTTP decompression disabled: `Content-Encoding` is not a
signed header, and whether R2 stores an unsigned `Content-Encoding` sent with a presigned PUT (and
serves it back on GET) has not been verified against R2, so a client that decompresses on the fly
could inflate a small upload far past the signed size.

## `R2StorageProvider`

- **No network.** A URL is signed in process; minting never calls R2. A presigned GET is not
  checked for existence (R2 answers 404), unlike the in-memory provider.
- **Endpoint.** `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<R2_BUCKET>/u/<userId>/<namespace>/<key>`,
  path style, signing region `auto`, service `s3`. An EU-jurisdiction bucket is served from
  `https://<account>.eu.r2.cloudflarestorage.com`: pass it as the `endpoint` option (no env key
  yet; OQ-07). `http:` is accepted for a loopback endpoint only (the tests).
- **User and namespace confinement.** `objectKeyOf` refuses a malformed user id, a namespace outside
  `uploads`, `derived`, `avatars` and a key that is absolute, has an empty, `.` or `..` segment, or
  contains anything but `[A-Za-z0-9._-]` and `/` (no backslash, percent-encoding, whitespace or
  control character), or makes the whole key exceed 1024 bytes. The path is signed, so a URL edited
  to another user, namespace, key or bucket fails at R2.
- **PUT constraints.** `content-type` (a bare `type/subtype`, no parameters) and
  `content-length` (= `sizeLimitBytes`) are signed headers: an upload of another type or another
  size, larger or smaller, fails R2's signature check. The client sends exactly
  `Content-Type: <contentType>` and a body of exactly `sizeLimitBytes` bytes. The type allowlist and
  the size cap are the `media` caller's (above).
- **TTL.** `clampTtl`: GET ≤ 600 s, PUT ≤ 900 s, under 1 s refused. `X-Amz-Date` is the clock in
  whole seconds and `expiresAt` = `X-Amz-Date` + TTL, so `expiresAt` is never later than R2's
  cut-off.
- **Credentials.** Held in `#private` fields, never an own property: `util.inspect(provider)`,
  `JSON.stringify(provider)` and a logged provider show neither the access key id nor the secret.
- **Logs.** `presigned url minted` (debug: `method`, `namespace`, `ttlSeconds`) and
  `presign refused` (warn: `method`, `refusal` = `user_id` | `namespace` | `key` | `content_type` |
  `size` | `ttl`), both with `component: "storage"`, `provider: "r2"`. Never the URL, its query
  (signature, access key id), the user id, the key, the content type or a credential; a
  `StorageError` message never echoes the refused value either.

## Signer

`presignUrl` implements the query-string variant of SigV4 from the AWS S3 API reference
("Authenticating Requests: Using Query Parameters"): canonical request with the URI-encoded path
(encoded once), the sorted `X-Amz-*` query, `host` plus the given headers, payload
`UNSIGNED-PAYLOAD`; HMAC-SHA256 key chain `AWS4<secret>` → date → region → service →
`aws4_request`. It is pinned by tests to AWS's published presigned-GET example and to the output
of `@smithy/signature-v4` 5.7.4 (the AWS SDK v3 signer) for an R2 PUT and GET.

Why no SDK (2026-10-04): query signing needs no S3 client, and `@aws-sdk/client-s3` +
`@aws-sdk/s3-request-presigner` pull in 27 packages (about 22 MB) whose presigner leaves
`content-type` unsigned by default. The lighter candidates were `@smithy/signature-v4` (Apache-2.0,
the AWS SDK's own signer, 4 packages, no install scripts) and `aws4fetch` (MIT, 1 package, last
release 2024-08). Adding any of them changes `pnpm-lock.yaml`, a single-writer file, so it is a
human step. If one is adopted, it replaces `presignUrl` only; the vector tests stay as they are.

## Tests

- `../tests/r2-storage.sec.test.ts`: the signed-URL security suite. URLs go over real HTTP (fetch)
  to `../tests/fake-s3.ts`, a local endpoint that verifies SigV4 presigned requests from the AWS
  spec and its own clock (itself checked against the AWS example): round trip, expired PUT and GET,
  wrong content type, larger and smaller body, URL edited to another namespace, key, bucket or
  expiry, a PUT and a GET URL of user A edited to user B's prefix, two users' objects at the same
  namespace and key kept apart, a key spelling another user's prefix kept inside the caller's own,
  TTL clamps, refusals of malformed user ids, escaping keys, foreign namespaces, bad types, sizes
  and TTLs for both adapters, no URL, query, user id, key, type or credential in the logs,
  credentials absent from `util.inspect` and `JSON.stringify`, and a mint-latency guard (p95 of
  500 mints < 100 ms, the P02 budget).
- `../tests/storage.port.test.ts`: TTL clamps and the in-memory provider, including two users at
  the same namespace and key.
- `../tests/storage-provider.test.ts`: `createStorageProvider` and the `R2_*` config keys,
  including the boot refusal without R2 keys on staging, prod and `NODE_ENV=production`.
- `../tests/r2-storage.live.sec.test.ts`: the same constraints enforced by R2 itself, plus a URL
  edited to another user's prefix. It runs only on an explicit opt-in, `R2_LIVE_TEST=1` (with the
  four `R2_*` keys in the environment: direnv loads `.env` after `just secrets-sync`), e.g.
  `R2_LIVE_TEST=1 just test platform`; credentials alone never run it, so a shell holding another
  environment's keys does not write to that bucket. Without the opt-in it is skipped (CI); opted in
  without the keys it fails. It overwrites one synthetic object of a synthetic user,
  `u/usr_0000000000000000000000TEST/uploads/live-test/round-trip.txt`, in the configured bucket.
