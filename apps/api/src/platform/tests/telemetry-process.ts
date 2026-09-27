// Harness for the telemetry `--import` entries: a stub OTLP/HTTP receiver, and a runner that starts
// `telemetry-fixture-process.ts` exactly as a process entry is started
// (`node --import tsx --import <instrument entry> <script>`). Used by telemetry.process.test.ts and
// the redaction canary. The receiver answers every OTLP export with an empty 200 (a valid
// protobuf response) and records the raw bodies, which the tests search for encoded values.
import { spawn } from 'node:child_process';
import { type IncomingHttpHeaders, createServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

const API_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./telemetry-fixture-process.ts', import.meta.url));
const ENTRIES = {
  api: fileURLToPath(new URL('../telemetry/instrument-api.ts', import.meta.url)),
  jobs: fileURLToPath(new URL('../telemetry/instrument-jobs.ts', import.meta.url)),
} as const;

/** The correlation scope the fixture logs and fetches in. */
export const FIXTURE_CORRELATION_ID = 'corr-fixture-7c1d';
/** Path the fixture fetches on the receiver (with a credential-shaped query string). */
export const PROBE_PATH = '/probe';

export type ReceivedRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: Buffer;
};

export type OtlpReceiver = {
  readonly url: string;
  readonly requests: ReceivedRequest[];
  /** Every body received on `path` (e.g. `/v1/traces`), concatenated. */
  bodies(path: string): Buffer;
  close(): Promise<void>;
};

export async function startOtlpReceiver(): Promise<OtlpReceiver> {
  const requests: ReceivedRequest[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      requests.push({
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks),
      });
      const otlp = req.url?.startsWith('/v1/') === true;
      res.writeHead(200, {
        'content-type': otlp ? 'application/x-protobuf' : 'text/plain',
        connection: 'close',
      });
      res.end(otlp ? undefined : 'ok');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    bodies(path) {
      const matching = requests.filter((request) => request.path === path);
      return Buffer.concat(matching.map((request) => request.body));
    },
    close() {
      server.closeAllConnections();
      return new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export type FixtureRun = {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** stdout lines that parse as JSON (the pino records). */
  readonly records: Record<string, unknown>[];
};

export type FixtureOptions = {
  readonly entry: keyof typeof ENTRIES;
  /** The fixture fetches `${receiverUrl}${PROBE_PATH}?…`. */
  readonly receiverUrl: string;
  /** Environment of the child; inherited `OTEL_*` keys are dropped first. */
  readonly env: Readonly<Record<string, string>>;
};

/** Run the fixture process to completion (30 s cap) and collect what it wrote. */
export async function runTelemetryFixture(options: FixtureOptions): Promise<FixtureRun> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('OTEL_')),
  );
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', '--import', ENTRIES[options.entry], FIXTURE, options.receiverUrl],
    { cwd: API_DIR, env: { ...inherited, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
  const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
  const code = await new Promise<number | null>((resolve) => child.once('exit', resolve));
  clearTimeout(timer);
  const records = stdout.split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, unknown>];
    } catch {
      return [];
    }
  });
  return { code, stdout, stderr, records };
}

/**
 * The OTLP protobuf encoding of a string `KeyValue` (field 1 key, field 2 `AnyValue` with field 1
 * `string_value`), for keys and values under 126 bytes: finds one resource, span or log attribute
 * in a raw export body without decoding it.
 */
export function encodedStringAttribute(key: string, value: string): Buffer {
  const k = Buffer.from(key, 'utf8');
  const v = Buffer.from(value, 'utf8');
  return Buffer.concat([
    Buffer.from([0x0a, k.length]),
    k,
    Buffer.from([0x12, v.length + 2, 0x0a, v.length]),
    v,
  ]);
}
