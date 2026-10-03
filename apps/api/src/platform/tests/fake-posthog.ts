// A local HTTP stand-in for the PostHog ingestion host, so the feature-flag adapter runs the real
// posthog-node client over real HTTP. Records every request (any path: a capture would show up
// here); the reply to `/flags/` is scripted.
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { type AddressInfo } from 'node:net';

export type RecordedPostHogRequest = {
  readonly method: string;
  /** Path and query, e.g. `/flags/?v=2`. */
  readonly url: string;
  readonly json: unknown;
};

/** `{ flags }` answers a clean v2 reply; `reply` any JSON; `status` an error; `hang` nothing. */
export type FlagsBehaviour =
  | { readonly flags: Readonly<Record<string, boolean>> }
  | { readonly reply: unknown }
  | { readonly status: number }
  | 'hang';

export type FakePostHog = {
  readonly host: string;
  readonly requests: RecordedPostHogRequest[];
  behaviour: FlagsBehaviour;
  close(): Promise<void>;
};

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text; // e.g. a gzipped event batch: recorded, never parsed
  }
}

function reply(res: ServerResponse, status: number, json: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(json));
}

/** A clean `/flags?v=2` reply; `enabled: false` is how PostHog answers an active flag at 0 %. */
function flagsReply(flags: Readonly<Record<string, boolean>>): unknown {
  return {
    flags: Object.fromEntries(
      Object.entries(flags).map(([key, enabled]) => [
        key,
        {
          key,
          enabled,
          variant: null,
          reason: { code: enabled ? 'condition_match' : 'no_condition_match' },
          metadata: { id: 1, version: 1 },
        },
      ]),
    ),
    errorsWhileComputingFlags: false,
    requestId: '00000000-0000-4000-8000-000000000000',
  };
}

export async function startFakePostHog(): Promise<FakePostHog> {
  const requests: RecordedPostHogRequest[] = [];
  const state = { behaviour: { flags: {} } as FlagsBehaviour };
  const server = createServer((req, res) => {
    void (async () => {
      const json = await readJson(req);
      const url = req.url ?? '';
      requests.push({ method: req.method ?? '', url, json });
      const behaviour = state.behaviour;
      if (!url.startsWith('/flags/')) reply(res, 200, { status: 1 });
      else if (behaviour === 'hang') return;
      else if ('flags' in behaviour) reply(res, 200, flagsReply(behaviour.flags));
      else if ('reply' in behaviour) reply(res, 200, behaviour.reply);
      else reply(res, behaviour.status, { detail: 'scripted failure' });
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    host: `http://127.0.0.1:${port}`,
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
