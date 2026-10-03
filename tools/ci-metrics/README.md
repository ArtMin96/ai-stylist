# tools/ci-metrics — PR-gate metrics over OTLP (`just ci-pr-gate-metrics`)

`push-pr-gate-metrics.mjs` sends one OTLP/HTTP JSON metrics payload per pr-gate run to
`$OTEL_EXPORTER_OTLP_ENDPOINT/v1/metrics`, with the headers in `$OTEL_EXPORTER_OTLP_HEADERS`. The CI
row of `docs/observability/grafana/dashboards/01-service-health.json` reads it (planning/14 §4
`ci.pr_gate_duration` and `ci.flake_rate`, planning/13 §1 budget of 10 minutes). Node built-ins only.

The `[private]` recipe `just ci-pr-gate-metrics` runs it in the summary job of
`.github/workflows/pr-gate.yml`:

```bash
just ci-pr-gate-metrics --duration 312 --conclusion success   # workflow + attempt from GITHUB_WORKFLOW / GITHUB_RUN_ATTEMPT
```

## What it sends

- `stylist.ci.pr_gate_duration`: gauge, unit `s`, attributes `workflow` and `conclusion`. Grafana
  Cloud stores it as `stylist_ci_pr_gate_duration_seconds`.
- `stylist.ci.pr_gate.runs`: cumulative counter with the value 1, attributes `attempt` and
  `conclusion`. Grafana Cloud stores it as `stylist_ci_pr_gate_runs_total`. The flake-rate panels
  count its samples: successful runs at `attempt` above 1 (a rerun to green) over all successful runs.
- The resource has `service.name=ci` and nothing else. There is no `service.instance.id` and no other
  per-run attribute, so each workflow keeps one series: `quantile_over_time` takes the p95 over that
  series and `count_over_time` counts one sample per run (docs/observability/grafana.md, metric
  rule 5). A run id, commit or branch never becomes a label.
- `conclusion` is `success`, `failure` or `cancelled`: the summary job derives it from its `needs`
  results.

## It never fails the gate

- An empty `OTEL_EXPORTER_OTLP_ENDPOINT` (a fork, or any run without the secret) prints a notice
  and exits 0.
- A push that fails (HTTP error, timeout after `--timeout-ms`, default 10 s, refused connection, or an
  OTLP partial success with rejected points) prints a warning and exits 0. Inside GitHub Actions the
  notice and warnings are annotations.
- Only a usage error (a missing `--duration`, an unknown `--conclusion`, no workflow or attempt)
  exits 2. The workflow step also sets `continue-on-error: true`.
- The output never contains the endpoint, its host, or a header value. A receiver's error text is
  printed with those replaced by `[redacted]`.

## Tests

`scripts/test/ci-metrics.test.sh` (part of `just test tooling`) runs the script against
`tests/otlp-stub.mjs`, a stub OTLP receiver on 127.0.0.1. It checks the payload shape the dashboard
queries, the header parsing, the no-op without an endpoint, every failure path, the usage errors, and
that no credential reaches the output.
