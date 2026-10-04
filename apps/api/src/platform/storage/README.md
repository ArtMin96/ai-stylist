# platform/storage — the `StorageProvider` port's R2 adapter (P02-T13)

The port, its DI token `STORAGE_PROVIDER`, the request checks every adapter shares (`clampTtl`,
`objectKeyOf`, `assertUploadConstraints`) and the in-memory provider live in
`../ports/storage.port.ts` (P02-interim placement; the port moves to `packages/shared-kernel` before
the first domain module injects it). Policy: doc 11 §5.4 (TTL ≤ 10 min GET, ≤ 15 min PUT; content
type, size and namespace constraints), DEC-44 (private user media = presigned GET on R2's S3
endpoint, uncached; public assets only through a custom domain, not this adapter).

## Files

- `create-storage-provider.ts`: `createStorageProvider({ accountId, accessKeyId, secretAccessKey,
bucket, clock, logger })` → `StorageProvider`. The composition root passes the validated
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` (`apps/api/src/config.ts`);
  nothing here reads `process.env`. All four set → `R2StorageProvider`; none → the
  `InMemoryStorageProvider`; some → a `TypeError` naming the missing keys (`loadConfig` refuses the
  same set first).
- `r2-storage-provider.ts`: `R2StorageProvider`, `r2Endpoint(accountId)`.
- `sigv4-presign.ts`: AWS Signature Version 4 query presigning on `node:crypto` (no SDK; see
  "Signer" below).

## `R2StorageProvider`

- **No network.** A URL is signed in process; minting never calls R2. A presigned GET is not
  checked for existence (R2 answers 404), unlike the in-memory provider.
- **Endpoint.** `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com/<R2_BUCKET>/<namespace>/<key>`,
  path style, signing region `auto`, service `s3`. An EU-jurisdiction bucket is served from
  `https://<account>.eu.r2.cloudflarestorage.com`: pass it as the `endpoint` option (no env key
  yet; OQ-07). `http:` is accepted for a loopback endpoint only (the tests).
- **Namespace confinement.** `objectKeyOf` refuses a namespace outside `uploads`, `derived`,
  `avatars` and a key that is absolute, has an empty, `.` or `..` segment, or contains anything but
  `[A-Za-z0-9._-]` and `/` (no backslash, percent-encoding, whitespace or control character), or
  exceeds 1024 bytes with its namespace. The path is signed, so an edited URL fails at R2.
  Per-user prefixes (`u/<user_id>/…`, doc 11 §4.3) are the calling module's authorization; the
  port carries no user id.
- **PUT constraints.** `content-type` (a bare `type/subtype`, no parameters) and
  `content-length` (= `sizeLimitBytes`) are signed headers: an upload of another type or another
  size, larger or smaller, fails R2's signature check. The client sends exactly
  `Content-Type: <contentType>` and a body of exactly `sizeLimitBytes` bytes. The type allowlist
  (JPEG/PNG/HEIC, doc 11 §5.5) is the media module's rule, not the adapter's.
- **TTL.** `clampTtl`: GET ≤ 600 s, PUT ≤ 900 s, under 1 s refused. `X-Amz-Date` is the clock in
  whole seconds and `expiresAt` = `X-Amz-Date` + TTL, so `expiresAt` is never later than R2's
  cut-off.
- **Logs.** `presigned url minted` (debug: `method`, `namespace`, `ttlSeconds`) and
  `presign refused` (warn: `method`, `refusal` = `namespace` | `key` | `content_type` | `size` |
  `ttl`), both with `component: "storage"`, `provider: "r2"`. Never the URL, its query (signature,
  access key id), the key, the content type or a credential; a `StorageError` message never echoes
  the refused value either.

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
  expiry, TTL clamps, refusals of escaping keys, foreign namespaces, bad types, sizes and TTLs for
  both adapters, no URL, query, key, type or credential in the logs, and a mint-latency guard
  (p95 of 500 mints < 100 ms, the P02 budget).
- `../tests/storage-provider.test.ts`: `createStorageProvider` and the `R2_*` config keys.
- `../tests/r2-storage.live.sec.test.ts`: the same constraints enforced by R2 itself. It runs only
  when `R2_*` keys are in the environment (direnv loads `.env` after `just secrets-sync`) and is
  skipped otherwise (CI); a partial set fails. It overwrites one synthetic object,
  `uploads/live-test/round-trip.txt`, in the configured bucket.
