# platform/storage — the `StorageProvider` port's adapters (P02-T13)

The port, its DI token `STORAGE_PROVIDER` (`Symbol.for('ai-stylist.storage-provider')`), the TTL
caps and the request checks every adapter shares (`clampTtl`, `objectKeyOf`,
`assertUploadConstraints`) live in `packages/shared-kernel/src/ports/storage.ts`, imported from
`@ai-stylist/shared-kernel`; this directory holds the adapters only. Module tests use
`fakeStorageProvider` from `@ai-stylist/test-support`, never these adapters. Policy: doc 11 §4.3 (media keys under `u/<user_id>/`), §5.4
(TTL ≤ 10 min GET, ≤ 15 min PUT; content type, size and the caller's own key namespace), DEC-44
(private user media = presigned GET on R2's S3 endpoint, uncached; public assets only through a
custom domain, not this adapter).

## Files

- `create-storage-provider.ts`: `createStorageProvider({ accountId, accessKeyId, secretAccessKey,
bucket, jurisdiction, clock, logger, allowsInMemory })` → `StorageProvider`. The composition root
  passes `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and
  `R2_JURISDICTION` as loaded by `apps/api/src/config.ts`, and
  `allowsInMemory: isLocalOrDevDeployment(config)`; nothing here reads `process.env`.
  `allowsInMemory` is required (fail closed): `true` lets the in-memory provider stand
  in when no R2 key is set, `false` refuses that configuration with a `TypeError` naming the four
  keys. No key (empty and blank count as unset) → `InMemoryStorageProvider` when allowed; any key →
  `R2StorageProvider`, whose constructor refuses a missing or malformed key. `loadConfig` owns the
  boot rules, which platform does not import: presence and all-or-none (a partial set is refused
  there first), and the refusal to boot with none of the four keys when `APP_ENV` is `staging` or
  `prod` or `NODE_ENV` is `production` (`isLocalOrDevDeployment`, doc 15 §11: staging and prod use
  real R2 buckets), so the in-memory provider is bound only in local, dev and test runs.
  `jurisdiction` (`R2_JURISDICTION`, see "Endpoint" below) is required too (`string | undefined`),
  so a composition root that forgets it does not compile. It is not one of the four keys: it
  selects the R2 adapter's endpoint host, never the provider. The factory trims it and refuses an
  unknown value before it chooses a provider, so a typo fails the first boot even while the
  in-memory provider is bound.
- `in-memory-storage-provider.ts`: `InMemoryStorageProvider(now?, baseUrl?)`, the adapter for local,
  dev, tests and CI. It refuses the same requests as the R2 adapter (the kernel checks above) and
  keeps `objects` keyed by `u/<userId>/<namespace>/<key>`; a GET of an object never PUT is refused.
- `r2-storage-provider.ts`: `R2StorageProvider`, `r2Endpoint(accountId, jurisdiction?)`,
  `R2_JURISDICTIONS` (`eu`, `us`, `fedramp`: the one list of allowed jurisdictions) and
  `parseR2Jurisdiction`. The only check of each
  key's shape (account id 32 lowercase hex, access key id letters and digits, secret without
  whitespace, bucket an R2 bucket name, jurisdiction empty or one of the list): the composition root
  builds the adapter in
  `AppModule.forRoot`, so a malformed key fails boot with a `TypeError` that names the option and its
  env key (`R2: bucket (R2_BUCKET) must be …`), never the value.
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
- **Endpoint.** `https://<R2_ACCOUNT_ID>.<R2_JURISDICTION>.r2.cloudflarestorage.com/<R2_BUCKET>/u/<userId>/<namespace>/<key>`,
  path style, signing region `auto`, service `s3`. `R2_JURISDICTION` is `eu`, `us` or `fedramp`
  (`R2_JURISDICTIONS`); empty means the default endpoint,
  `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. Every bucket of this project is in the EU
  jurisdiction (DEC-61), so every environment sets `eu`: R2 serves a jurisdictional bucket from its
  own endpoint only (Cloudflare R2 reference "Data location", read 2026-10-12), and the host is a
  signed header, so a URL minted for another host is refused. Any other value (`EU`, `europe`, a
  typo) refuses to boot with
  `R2: jurisdiction (R2_JURISDICTION) must be empty or one of eu, us, fedramp`, which names the key
  and the allowed values, never the value. The `endpoint` option is for the tests' loopback
  endpoint and has no env key: when given it wins over the jurisdiction (which is still checked),
  and `http:` is accepted for a loopback host only.
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
  credentials absent from `util.inspect` and `JSON.stringify`, the jurisdiction option (its
  endpoint host, an explicit `endpoint` winning over it, an unknown value refused), and two
  mint-latency guards, one for PUT and one for GET (p95 of 500 mints < 100 ms each, the P02
  budget).
- `../tests/storage.port.test.ts`: TTL clamps and the in-memory provider, including two users at
  the same namespace and key.
- `../tests/storage-provider.test.ts`: `createStorageProvider` (in-memory only when allowed, R2
  otherwise; a partial or malformed key refused by name, no value in the error or the logs), and
  `R2_JURISDICTION`: `eu`, `us` and `fedramp` each mint PUT and GET URLs on their own host whose
  signature a SigV4 verifier accepts for that host and refuses for the default one; unset, empty
  and blank give the default host; surrounding whitespace is trimmed; an unknown value is refused
  with the exact message above, also when no R2 key is set (in-memory). The
  config rules (presence, all-or-none, the boot refusal without R2 keys on staging, prod and
  `NODE_ENV=production`, a malformed key failing `createApp`) are in `apps/api/tests/config.test.ts`:
  platform tests do not import `config.ts`.
- `../tests/r2-storage.live.sec.test.ts`: the same constraints enforced by R2 itself, plus a URL
  edited to another user's prefix. It runs only on an explicit opt-in, `R2_LIVE_TEST=1` (with the
  four `R2_*` keys and `R2_JURISDICTION` in the environment: direnv loads `.env` after
  `just secrets-sync`), e.g.
  `R2_LIVE_TEST=1 just test platform`; credentials alone never run it, so a shell holding another
  environment's keys does not write to that bucket. It reads the four keys, `R2_JURISDICTION` and
  `APP_ENV` from `process.env` and calls `createStorageProvider` directly (`allowsInMemory: false`),
  so a run against the EU dev bucket signs for the EU host; a test that needs no network checks
  that pass-through on every run, with synthetic keys. It also
  refuses unless `APP_ENV` is unset, `local` or `dev` and `R2_BUCKET` ends in `-dev` or `-local`
  (bucket names follow `ai-stylist-<env>`, docs/SERVICES-SETUP.md §6: the dev bucket
  `ai-stylist-dev` passes, `ai-stylist-staging`, `ai-stylist-prod` and `ai-stylist-pg-backups`
  never do); that guard is tested on every run. Without the opt-in the round trip is skipped (CI);
  opted in without the keys it fails. It overwrites one synthetic object of a synthetic user,
  `u/usr_0000000000000000000000TEST/uploads/live-test/round-trip.txt`, in the configured bucket.
