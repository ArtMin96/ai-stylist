// A local S3-compatible endpoint that checks presigned URLs the way S3 and R2 do, so the R2 adapter's
// URLs are exercised over real HTTP with a real client (fetch). Written from the AWS spec
// ("Authenticating Requests: Using Query Parameters (AWS Signature Version 4)"), independently of
// ../storage/sigv4-presign.ts: it checks the expiry against its own clock and recomputes the
// signature from the request it actually received (method, raw path, query, the received values of
// the signed headers, UNSIGNED-PAYLOAD). `verifyPresignedRequest` is exported so a test can check
// the verifier itself against AWS's published example. Objects live in memory.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { type IncomingHttpHeaders, createServer } from 'node:http';
import { type AddressInfo } from 'node:net';

export type FakeS3Credentials = { readonly accessKeyId: string; readonly secretAccessKey: string };

export type FakeS3Options = {
  readonly credentials: FakeS3Credentials;
  readonly region: string;
  /** The endpoint's clock: a URL is expired once it is later than X-Amz-Date + X-Amz-Expires. */
  readonly now: () => Date;
};

export type PresignedRequest = {
  readonly method: string;
  /** Path and query exactly as received, e.g. `/bucket/uploads/k.jpg?X-Amz-Algorithm=…`. */
  readonly rawUrl: string;
  readonly headers: IncomingHttpHeaders;
};

/** `ok`, or the status and S3 error code S3 answers with. */
export type Verdict =
  { readonly ok: true } | { readonly ok: false; readonly status: number; readonly code: string };

export type FakeS3Object = { readonly contentType: string | undefined; readonly body: Buffer };

export type FakeS3 = {
  /** `http://127.0.0.1:<port>`. */
  readonly endpoint: string;
  /** Stored objects by path without the leading slash: `<bucket>/<namespace>/<key>`. */
  readonly objects: Map<string, FakeS3Object>;
  close(): Promise<void>;
};

const ALGORITHM = 'AWS4-HMAC-SHA256';
const REQUIRED = [
  'X-Amz-Algorithm',
  'X-Amz-Credential',
  'X-Amz-Date',
  'X-Amz-Expires',
  'X-Amz-SignedHeaders',
  'X-Amz-Signature',
] as const;

const refuse = (status: number, code: string): Verdict => ({ ok: false, status, code });

function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function parseQuery(query: string): [string, string][] {
  if (query === '') return [];
  return query.split('&').map((pair) => {
    const at = pair.indexOf('=');
    const name = at === -1 ? pair : pair.slice(0, at);
    const value = at === -1 ? '' : pair.slice(at + 1);
    return [decodeURIComponent(name), decodeURIComponent(value)];
  });
}

/** `20260910T120000Z` → epoch ms, or NaN. */
function parseAmzDate(value: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (m === null) return Number.NaN;
  return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  if (value === undefined) return undefined;
  return (Array.isArray(value) ? value.join(',') : value).trim().replace(/\s+/g, ' ');
}

/** What S3 decides for a presigned request, before it looks at the object. */
export function verifyPresignedRequest(request: PresignedRequest, options: FakeS3Options): Verdict {
  const at = request.rawUrl.indexOf('?');
  const path = at === -1 ? request.rawUrl : request.rawUrl.slice(0, at);
  const params = parseQuery(at === -1 ? '' : request.rawUrl.slice(at + 1));
  const param = (name: string) => params.find(([key]) => key === name)?.[1];
  if (REQUIRED.some((name) => param(name) === undefined)) {
    return refuse(403, 'AccessDenied');
  }
  if (param('X-Amz-Algorithm') !== ALGORITHM)
    return refuse(400, 'AuthorizationQueryParametersError');
  const date = param('X-Amz-Date') ?? '';
  const [accessKeyId, scopeDate, region, service, terminator] = (
    param('X-Amz-Credential') ?? ''
  ).split('/');
  if (accessKeyId !== options.credentials.accessKeyId) return refuse(403, 'InvalidAccessKeyId');
  if (
    scopeDate !== date.slice(0, 8) ||
    region !== options.region ||
    service !== 's3' ||
    terminator !== 'aws4_request'
  ) {
    return refuse(400, 'AuthorizationQueryParametersError');
  }
  const expires = Number(param('X-Amz-Expires'));
  const signedAt = parseAmzDate(date);
  if (!Number.isInteger(expires) || expires < 1 || expires > 604_800 || Number.isNaN(signedAt)) {
    return refuse(400, 'AuthorizationQueryParametersError');
  }
  if (options.now().getTime() > signedAt + expires * 1000) return refuse(403, 'AccessDenied');

  const signedHeaders = param('X-Amz-SignedHeaders') ?? '';
  const names = signedHeaders.split(';');
  if (!names.includes('host')) return refuse(400, 'AuthorizationQueryParametersError');
  const canonicalQuery = params
    .filter(([name]) => name !== 'X-Amz-Signature')
    .map(([name, value]) => [rfc3986(name), rfc3986(value)] as const)
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
  const canonicalHeaders = names
    .map((name) => `${name}:${headerValue(request.headers, name) ?? ''}\n`)
    .join('');
  const canonicalRequest = [
    request.method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = `${scopeDate}/${region}/${service}/aws4_request`;
  const stringToSign = `${ALGORITHM}\n${date}\n${scope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
  let key: Buffer = createHmac('sha256', `AWS4${options.credentials.secretAccessKey}`)
    .update(scopeDate)
    .digest();
  for (const part of [region, service, 'aws4_request']) {
    key = createHmac('sha256', key).update(part).digest();
  }
  const expected = createHmac('sha256', key).update(stringToSign).digest();
  const given = Buffer.from(param('X-Amz-Signature') ?? '', 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return refuse(403, 'SignatureDoesNotMatch');
  }
  return { ok: true };
}

export async function startFakeS3(options: FakeS3Options): Promise<FakeS3> {
  const objects = new Map<string, FakeS3Object>();
  const server = createServer((req, res) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const rawUrl = req.url ?? '/';
      const method = req.method ?? '';
      const verdict = verifyPresignedRequest({ method, rawUrl, headers: req.headers }, options);
      const id = rawUrl.split('?')[0]!.slice(1);
      const send = (status: number, code: string) => {
        res.writeHead(status, { 'content-type': 'application/xml' });
        res.end(`<Error><Code>${code}</Code></Error>`);
      };
      if (!verdict.ok) return send(verdict.status, verdict.code);
      if (method === 'PUT') {
        objects.set(id, { contentType: req.headers['content-type'], body: Buffer.concat(chunks) });
        res.writeHead(200).end();
      } else if (method === 'GET') {
        const object = objects.get(id);
        if (object === undefined) return send(404, 'NoSuchKey');
        res.writeHead(200, object.contentType ? { 'content-type': object.contentType } : {});
        res.end(object.body);
      } else {
        send(405, 'MethodNotAllowed');
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    objects,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
