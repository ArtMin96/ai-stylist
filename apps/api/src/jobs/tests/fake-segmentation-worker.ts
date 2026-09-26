// A local HTTP stand-in for workers/ml/segmentation (`POST /v1/segment`), so the job tests exercise
// the real HTTP client without Docker or Python. Records every request; the reply is scripted.
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { type AddressInfo } from 'node:net';

export type RecordedRequest = {
  readonly method: string;
  readonly path: string;
  readonly contentType: string | undefined;
  readonly json: unknown;
};

/**
 * `echo` mirrors the P02 stub; `status` replies with that code; `reply` answers 200 with that JSON;
 * `hang` never replies.
 */
export type WorkerBehaviour = 'echo' | 'hang' | StatusReply | JsonReply;
type StatusReply = { readonly status: number };
type JsonReply = { readonly reply: unknown };

export type FakeSegmentationWorker = {
  readonly baseUrl: string;
  readonly requests: RecordedRequest[];
  behaviour: WorkerBehaviour;
  close(): Promise<void>;
};

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return undefined;
  return JSON.parse(text) as unknown;
}

function reply(res: ServerResponse, status: number, json: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(json));
}

function echo(json: unknown): unknown {
  const request = (json ?? {}) as { request_id?: unknown; image_ref?: unknown };
  return {
    request_id: request.request_id,
    image_ref: request.image_ref,
    masks: [],
    provenance: { generated: true, model: 'stub', confidence: 0 },
  };
}

export async function startFakeSegmentationWorker(): Promise<FakeSegmentationWorker> {
  const requests: RecordedRequest[] = [];
  const state = { behaviour: 'echo' as WorkerBehaviour };
  const server = createServer((req, res) => {
    void (async () => {
      const json = await readJson(req);
      requests.push({
        method: req.method ?? '',
        path: req.url ?? '',
        contentType: req.headers['content-type'],
        json,
      });
      const behaviour = state.behaviour;
      if (behaviour === 'hang') return;
      if (behaviour === 'echo') {
        reply(res, 200, echo(json));
      } else if ('reply' in behaviour) {
        reply(res, 200, behaviour.reply);
      } else {
        reply(res, behaviour.status, { detail: 'scripted failure' });
      }
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    get behaviour() {
      return state.behaviour;
    },
    set behaviour(value) {
      state.behaviour = value;
    },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
