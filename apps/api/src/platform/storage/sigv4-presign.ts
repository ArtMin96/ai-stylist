// AWS Signature Version 4 query presigning for an S3-compatible endpoint (R2), on node:crypto.
// Spec: AWS S3 API reference, "Authenticating Requests: Using Query Parameters (AWS Signature
// Version 4)". The payload is `UNSIGNED-PAYLOAD` (the body does not exist when the URL is minted);
// `host` and every header in `headers` are signed, so a request that sends another value for one
// of them fails the endpoint's signature check. Pure: no clock, no network, no logging.
// Checked against AWS's published example and against @smithy/signature-v4 (the AWS SDK signer)
// in ../tests/r2-storage.sec.test.ts.
import { createHash, createHmac } from 'node:crypto';

export type SigV4Credentials = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
};

export type SigV4PresignInput = {
  readonly method: 'GET' | 'PUT';
  /** `https://host[:port]`, nothing after the authority. */
  readonly origin: string;
  /** Absolute path, already URI-encoded once (S3 does not double-encode the path). */
  readonly path: string;
  /** Headers to sign besides `host`: lowercase names, the exact values the client must send. */
  readonly headers: Readonly<Record<string, string>>;
  readonly credentials: SigV4Credentials;
  readonly region: string;
  readonly service: string;
  /** Signing instant (X-Amz-Date); sub-second precision is dropped. */
  readonly signingDate: Date;
  readonly expiresInSeconds: number;
};

const ALGORITHM = 'AWS4-HMAC-SHA256';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';
/** SigV4 refuses a presigned URL valid for longer than 7 days. */
const MAX_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

/** RFC 3986 percent-encoding of everything but the unreserved characters `A-Z a-z 0-9 - . _ ~`. */
export function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** `2026-09-10T12:00:00.123Z` → `20260910T120000Z`. */
function amzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/** The presigned URL: the canonical query plus `X-Amz-Signature`. */
export function presignUrl(input: SigV4PresignInput): string {
  const { expiresInSeconds } = input;
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds < 1 ||
    expiresInSeconds > MAX_EXPIRES_SECONDS
  ) {
    throw new RangeError(`expiresInSeconds must be an integer in 1..${MAX_EXPIRES_SECONDS}`);
  }
  const longDate = amzDate(input.signingDate);
  const shortDate = longDate.slice(0, 8);
  const scope = `${shortDate}/${input.region}/${input.service}/aws4_request`;

  const headers = new Map<string, string>([['host', new URL(input.origin).host]]);
  for (const [name, value] of Object.entries(input.headers)) {
    headers.set(name.toLowerCase(), value.trim().replace(/\s+/g, ' '));
  }
  const headerNames = [...headers.keys()].sort();
  const signedHeaders = headerNames.join(';');

  const canonicalQuery = [
    ['X-Amz-Algorithm', ALGORITHM],
    ['X-Amz-Credential', `${input.credentials.accessKeyId}/${scope}`],
    ['X-Amz-Date', longDate],
    ['X-Amz-Expires', String(expiresInSeconds)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ]
    .map(([name = '', value = '']) => `${uriEncode(name)}=${uriEncode(value)}`)
    .sort()
    .join('&');
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${headers.get(name) ?? ''}\n`)
    .join('');
  const canonicalRequest = [
    input.method,
    input.path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    UNSIGNED_PAYLOAD,
  ].join('\n');
  const stringToSign = [
    ALGORITHM,
    longDate,
    scope,
    createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');

  const dateKey = hmac(`AWS4${input.credentials.secretAccessKey}`, shortDate);
  const signingKey = hmac(hmac(hmac(dateKey, input.region), input.service), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  return `${input.origin}${input.path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
