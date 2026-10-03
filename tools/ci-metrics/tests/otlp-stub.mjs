#!/usr/bin/env node
// Stub OTLP/HTTP receiver for scripts/test/ci-metrics.test.sh (Node built-ins only). Listens on
// 127.0.0.1 on a free port, writes that port to <dir>/port once it listens, and records every
// request as <dir>/request-<n>.json: { method, url, headers, body } (body parsed when it is JSON).
//
// Usage: node tools/ci-metrics/tests/otlp-stub.mjs <dir> [options]
//   --status <code>  HTTP status of every reply (default 200)
//   --reply <text>   reply body (default {})
//   --hang           record the request but never reply, so the caller's timeout fires
import { renameSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const args = process.argv.slice(2);
const dir = args.shift();
if (!dir) throw new Error('otlp-stub: usage: otlp-stub.mjs <dir> [options]');
let status = 200;
let reply = '{}';
let hang = false;
while (args.length > 0) {
  const flag = args.shift();
  if (flag === '--status') {
    status = Number(args.shift());
  } else if (flag === '--reply') {
    reply = args.shift() ?? '';
  } else if (flag === '--hang') {
    hang = true;
  } else {
    throw new Error(`otlp-stub: unknown argument '${flag}'`);
  }
}

let count = 0;
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    count += 1;
    const text = Buffer.concat(chunks).toString('utf8');
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON: keep the text
    }
    const record = { method: request.method, url: request.url, headers: request.headers, body };
    writeFileSync(path.join(dir, `request-${count}.json`), JSON.stringify(record, null, 2));
    if (hang) return;
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(reply);
  });
});

server.listen(0, '127.0.0.1', () => {
  // Written then renamed, so a poller never reads a half-written port.
  writeFileSync(path.join(dir, 'port.tmp'), String(server.address().port));
  renameSync(path.join(dir, 'port.tmp'), path.join(dir, 'port'));
});
