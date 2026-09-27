#!/usr/bin/env node
// PR-gate CI metrics (planning/14 §4 `ci.pr_gate_duration` and `ci.flake_rate`, planning/13 §1):
// one OTLP/HTTP JSON metrics payload per pr-gate run, for the CI row of
// docs/observability/grafana/dashboards/01-service-health.json:
//   stylist.ci.pr_gate_duration  gauge, unit s, attributes workflow + conclusion
//                                -> stylist_ci_pr_gate_duration_seconds
//   stylist.ci.pr_gate.runs      cumulative counter of 1, attributes attempt + conclusion
//                                -> stylist_ci_pr_gate_runs_total (flake-rate panels count samples)
// The resource is `service.name=ci` and nothing else: no service.instance.id and no other per-run
// attribute, so each workflow keeps one series (docs/observability/grafana.md, metric rule 5).
// Run by `just ci-pr-gate-metrics` in pr-gate.yml's summary job. It never fails the gate: an empty
// OTEL_EXPORTER_OTLP_ENDPOINT (forks, PRs without secrets) prints a notice, a failed push prints a
// warning, and both exit 0. Only a usage error exits 2. Output never contains the endpoint or a
// header value. Details: tools/ci-metrics/README.md.
//
// Usage: node tools/ci-metrics/push-pr-gate-metrics.mjs --duration <seconds>
//          --conclusion <success|failure|cancelled> [--workflow <name>] [--attempt <n>]
//          [--timeout-ms <ms>]
//   --workflow    default $GITHUB_WORKFLOW          --attempt  default $GITHUB_RUN_ATTEMPT
//   --timeout-ms  the one request's timeout, default 10000
// Env: OTEL_EXPORTER_OTLP_ENDPOINT  base URL; /v1/metrics is appended (OTLP/HTTP spec)
//      OTEL_EXPORTER_OTLP_HEADERS   comma-separated key=value, values percent-decoded: the format
//                                   the OTel SDKs in apps/api and workers read from the same variable
// Node built-ins only: it runs without `pnpm install`, on Linux and macOS alike.

const TAG = 'ci-pr-gate-metrics';
const SERVICE_NAME = 'ci';
const SCOPE_NAME = 'ai-stylist/ci-metrics';
const METRIC_NAMES = 'stylist.ci.pr_gate_duration + stylist.ci.pr_gate.runs';
const CONCLUSIONS = ['success', 'failure', 'cancelled'];
const AGGREGATION_TEMPORALITY_CUMULATIVE = 2;
const OPTIONS = new Map([
  ['--duration', 'duration'],
  ['--conclusion', 'conclusion'],
  ['--workflow', 'workflow'],
  ['--attempt', 'attempt'],
  ['--timeout-ms', 'timeoutMs'],
]);
const OPTION_NAMES = [...OPTIONS.keys()].join(', ');
const IN_ACTIONS = process.env.GITHUB_ACTIONS === 'true';

class UsageError extends Error {}

function invalid(flag, rule, got) {
  return new UsageError(`${flag} must be ${rule} (got '${got ?? ''}')`);
}

/** A notice (stdout) or a warning (stderr); a GitHub annotation inside Actions. */
function report(kind, message) {
  const line = IN_ACTIONS ? `::${kind}::${TAG}: ${message}` : `${TAG}: ${kind}: ${message}`;
  (kind === 'notice' ? process.stdout : process.stderr).write(`${line}\n`);
}

function parseArgs(argv, env) {
  const raw = {
    workflow: env.GITHUB_WORKFLOW ?? '',
    attempt: env.GITHUB_RUN_ATTEMPT ?? '',
    timeoutMs: '10000',
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = OPTIONS.get(argv[i]);
    if (!key) {
      throw new UsageError(`unknown argument '${argv[i]}' (use ${OPTION_NAMES})`);
    }
    if (argv[i + 1] === undefined) throw new UsageError(`${argv[i]} needs a value`);
    raw[key] = argv[i + 1];
  }
  const durationText = raw.duration ?? '';
  const duration = durationText.trim() === '' ? NaN : Number(durationText);
  if (!Number.isFinite(duration) || duration < 0) {
    throw invalid('--duration', 'a number of seconds >= 0', durationText);
  }
  if (!CONCLUSIONS.includes(raw.conclusion)) {
    throw invalid('--conclusion', CONCLUSIONS.join('|'), raw.conclusion);
  }
  // Metric labels stay bounded: a workflow name and a small attempt number, never a run id.
  if (!/^[\w .-]{1,100}$/.test(raw.workflow)) {
    throw invalid('--workflow (or GITHUB_WORKFLOW)', 'a workflow name', raw.workflow);
  }
  if (!/^[1-9]\d{0,2}$/.test(raw.attempt)) {
    throw invalid('--attempt (or GITHUB_RUN_ATTEMPT)', '1..999', raw.attempt);
  }
  const timeoutMs = Number(raw.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw invalid('--timeout-ms', 'a positive integer', raw.timeoutMs);
  }
  return {
    duration,
    conclusion: raw.conclusion,
    workflow: raw.workflow,
    attempt: raw.attempt,
    timeoutMs,
  };
}

function percentDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** OTEL_EXPORTER_OTLP_HEADERS -> { name: value }; entries without `name=` are counted, not kept. */
function parseHeaders(value) {
  const headers = {};
  let ignored = 0;
  for (const entry of (value ?? '').split(',')) {
    if (entry.trim() === '') continue;
    const at = entry.indexOf('=');
    const name = at > 0 ? percentDecode(entry.slice(0, at).trim()) : '';
    if (name === '') {
      ignored += 1;
      continue;
    }
    headers[name] = percentDecode(entry.slice(at + 1).trim());
  }
  return { headers, ignored };
}

/** Every string that must never reach the output: the endpoint, its host, each header value and
 * each longer word inside one (the token of `Basic <token>`), longest first. */
function secretsOf(endpoint, url, headers) {
  const secrets = new Set([endpoint, url.href, url.host, url.hostname]);
  for (const value of Object.values(headers)) {
    secrets.add(value);
    for (const word of value.split(/\s+/)) {
      if (word.length >= 8) secrets.add(word);
    }
  }
  const redactable = [...secrets].filter((secret) => secret.length >= 4);
  return redactable.sort((a, b) => b.length - a.length);
}

/** A receiver's response text, one line, at most 300 characters, every secret replaced. */
function redact(text, secrets) {
  let out = String(text);
  for (const secret of secrets) out = out.split(secret).join('[redacted]');
  const oneLine = out.replace(/\s+/g, ' ').trim();
  return oneLine.slice(0, 300);
}

function attributes(record) {
  const toAttribute = ([key, value]) => ({ key, value: { stringValue: String(value) } });
  return Object.entries(record).map(toAttribute);
}

function buildPayload({ duration, conclusion, workflow, attempt }, timeUnixNano) {
  const durationPoint = {
    timeUnixNano,
    asDouble: duration,
    attributes: attributes({ workflow, conclusion }),
  };
  const runPoint = {
    timeUnixNano,
    asInt: '1',
    attributes: attributes({ attempt, conclusion }),
  };
  const metrics = [
    {
      name: 'stylist.ci.pr_gate_duration',
      description: 'Wall clock of one PR gate run, from run start to the summary job',
      unit: 's',
      gauge: { dataPoints: [durationPoint] },
    },
    {
      name: 'stylist.ci.pr_gate.runs',
      description: 'PR gate runs; a success at attempt > 1 is a rerun to green (a flake)',
      unit: '{run}',
      sum: {
        aggregationTemporality: AGGREGATION_TEMPORALITY_CUMULATIVE,
        isMonotonic: true,
        dataPoints: [runPoint],
      },
    },
  ];
  const resource = { attributes: attributes({ 'service.name': SERVICE_NAME }) };
  return {
    resourceMetrics: [{ resource, scopeMetrics: [{ scope: { name: SCOPE_NAME }, metrics }] }],
  };
}

/** The OTLP partial-success part of a 2xx body (rejected points plus a reason), if any. */
function rejectionOf(text) {
  try {
    const partial = JSON.parse(text)?.partialSuccess;
    return Number(partial?.rejectedDataPoints ?? 0) > 0 ? partial : undefined;
  } catch {
    return undefined;
  }
}

/** Why a fetch threw, without its message (which can name the host). */
function failureReason(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timed out';
  const code = error?.cause?.code ?? error?.code;
  if (code) return `network error ${code}`;
  return error?.name ?? 'Error';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2), process.env);
  const { duration, conclusion, workflow, attempt, timeoutMs } = opts;
  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '').trim();
  if (endpoint === '') {
    report('notice', 'OTEL_EXPORTER_OTLP_ENDPOINT is empty (fork or no secret): skipped');
    return;
  }
  let url;
  try {
    url = new URL(`${endpoint.replace(/\/+$/, '')}/v1/metrics`);
  } catch {
    url = undefined;
  }
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    report('warning', 'OTEL_EXPORTER_OTLP_ENDPOINT is not an http(s) URL: nothing pushed');
    return;
  }
  const { headers, ignored } = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
  const secrets = secretsOf(endpoint, url, headers);
  if (ignored > 0) report('warning', `skipped ${ignored} header entries without name=value`);
  let requestHeaders;
  try {
    requestHeaders = new Headers(headers);
    requestHeaders.set('content-type', 'application/json');
  } catch {
    report('warning', 'OTEL_EXPORTER_OTLP_HEADERS has an invalid header: nothing pushed');
    return;
  }
  const timeUnixNano = (BigInt(Date.now()) * 1_000_000n).toString();
  const body = JSON.stringify(buildPayload(opts, timeUnixNano));
  const what = `${workflow} attempt ${attempt}: ${conclusion} in ${duration}s`;
  let status;
  let text;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = response.status;
    text = await response.text();
  } catch (error) {
    report('warning', `push failed (${what}): ${failureReason(error)}`);
    return;
  }
  if (status < 200 || status > 299) {
    const detail = redact(text, secrets);
    report('warning', `push failed (${what}): HTTP ${status}${detail ? `: ${detail}` : ''}`);
    return;
  }
  const rejection = rejectionOf(text);
  if (rejection) {
    const reason = redact(rejection.errorMessage ?? '', secrets);
    const points = rejection.rejectedDataPoints;
    report('warning', `the receiver rejected ${points} point(s) of ${what}: ${reason}`);
    return;
  }
  process.stdout.write(`${TAG}: pushed ${METRIC_NAMES} for ${what} (HTTP ${status})\n`);
}

main().catch((error) => {
  if (error instanceof UsageError) {
    process.stderr.write(`${TAG}: ${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  // A defect in this reporter must not fail the gate either; an error name holds no secret.
  report('warning', `unexpected ${error?.name ?? 'error'}: nothing pushed`);
});
