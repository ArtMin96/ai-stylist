#!/usr/bin/env bash
# Black-box suite for the PR-gate CI metrics push (tools/ci-metrics/push-pr-gate-metrics.mjs, run by
# `just ci-pr-gate-metrics` in pr-gate.yml) against a stub OTLP/HTTP receiver on 127.0.0.1
# (tools/ci-metrics/tests/otlp-stub.mjs). It proves the payload the dashboard's CI panels query
# (metric names, units, temporality, the exact attributes, one resource attribute), the
# OTEL_EXPORTER_OTLP_HEADERS parsing, the no-op without an endpoint, that every push failure exits 0,
# that usage errors exit 2, and that no endpoint, host or header value reaches the output.
# Usage: scripts/test/ci-metrics.test.sh   (run by `just test tooling` and `just test`)
# Needs node (mise) and jq. Runs on Linux and macOS alike; nothing leaves the machine.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PUSH="$ROOT/tools/ci-metrics/push-pr-gate-metrics.mjs"
STUB="$ROOT/tools/ci-metrics/tests/otlp-stub.mjs"
TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ai-stylist-ci-metrics-tests.XXXXXX")"

# Synthetic credentials: a test fails when any of them shows up in the script's output.
TOKEN="$(printf 'c3%s' 'ludGhldGljLXRlc3QtdG9rZW4tOWQ0Yg==')"  # synthetic; split so no line matches generic-api-key
ORG='tenant-5813'
HEADERS="Authorization=Basic%20${TOKEN},X-Scope-OrgID=${ORG}"

STUB_PID=''
STUB_PORT=''
OUT=''
RC=0
failures=0

stop_stub() {
  if [[ -n "$STUB_PID" ]]; then
    kill "$STUB_PID" 2>/dev/null || true
    wait "$STUB_PID" 2>/dev/null || true
    STUB_PID=''
  fi
}
trap 'stop_stub; rm -rf "$TEST_ROOT"' EXIT

# start_stub <dir> [stub options]: starts the receiver recording into <dir>; sets STUB_PORT.
start_stub() {
  local dir="$1" tries=0
  shift
  stop_stub
  mkdir -p "$dir"
  node "$STUB" "$dir" "$@" &
  STUB_PID=$!
  while [[ ! -s "$dir/port" && $tries -lt 100 ]]; do
    sleep 0.1
    tries=$((tries + 1))
  done
  if [[ ! -s "$dir/port" ]]; then
    echo "  the stub receiver did not start" >&2
    return 1
  fi
  STUB_PORT="$(cat "$dir/port")"
}

# push <endpoint> <headers> [script args]: runs the script with only these OTLP settings (this
# runner's own GitHub variables removed); OUT = stdout + stderr, RC = exit code.
push() {
  local endpoint="$1" headers="$2"
  shift 2
  set +e
  OUT="$(env -u GITHUB_ACTIONS -u GITHUB_WORKFLOW -u GITHUB_RUN_ATTEMPT \
    OTEL_EXPORTER_OTLP_ENDPOINT="$endpoint" OTEL_EXPORTER_OTLP_HEADERS="$headers" \
    node "$PUSH" "$@" 2>&1)"
  RC=$?
  set -e
}

run_test() {
  local name="$1"
  shift
  if "$@"; then
    echo "PASS  $name"
  else
    echo "FAIL  $name" >&2
    failures=$((failures + 1))
  fi
  stop_stub
}

expect_eq() {
  if [[ "$1" != "$2" ]]; then
    printf '  expected: %s\n  actual:   %s\n' "$2" "$1" >&2
    return 1
  fi
}

expect_contains() {
  if [[ "$1" != *"$2"* ]]; then
    printf '  expected output to contain: %s\n  output: %s\n' "$2" "$1" >&2
    return 1
  fi
}

# expect_no_secret <output>: none of the credentials, the stub's host or its port is printed.
expect_no_secret() {
  local secret
  for secret in "$TOKEN" "$ORG" "Basic " "127.0.0.1" ${STUB_PORT:+":$STUB_PORT"}; do
    if [[ "$1" == *"$secret"* ]]; then
      printf '  output contains %s: %s\n' "$secret" "$1" >&2
      return 1
    fi
  done
}

# points_of <request.json> <metric index> <points path>: that metric's data points as
# [{value, attrs: the attributes as one object}], compact JSON.
points_of() {
  jq -c --argjson i "$2" \
    ".body.resourceMetrics[0].scopeMetrics[0].metrics[\$i] | [$3[] | {value: (.asDouble // .asInt), attrs: (.attributes | map({(.key): .value.stringValue}) | add)}]" \
    "$1"
}

ARGS=(--duration 312 --conclusion success --workflow pr-gate --attempt 2)

test_payload_matches_the_dashboard_queries() {
  local dir="$TEST_ROOT/shape" req
  start_stub "$dir" || return 1
  push "http://127.0.0.1:$STUB_PORT/otlp/" "$HEADERS" "${ARGS[@]}"
  req="$dir/request-1.json"
  expect_eq "$RC" 0 && expect_contains "$OUT" "pushed stylist.ci.pr_gate_duration" \
    && expect_no_secret "$OUT" || return 1
  if [[ ! -f "$req" || -f "$dir/request-2.json" ]]; then
    echo "  expected exactly one request, got: $(ls "$dir")" >&2
    return 1
  fi
  expect_eq "$(jq -r '.method + " " + .url' "$req")" "POST /otlp/v1/metrics" \
    && expect_eq "$(jq -r '.headers.authorization' "$req")" "Basic $TOKEN" \
    && expect_eq "$(jq -r '.headers["x-scope-orgid"]' "$req")" "$ORG" \
    && expect_eq "$(jq -r '.headers["content-type"]' "$req")" "application/json" \
    && expect_eq "$(jq -c '[.body.resourceMetrics[].resource.attributes]' "$req")" \
      '[[{"key":"service.name","value":{"stringValue":"ci"}}]]' \
    && expect_eq "$(jq -c '[.body.resourceMetrics[0].scopeMetrics[0].metrics[] | [.name, .unit]]' "$req")" \
      '[["stylist.ci.pr_gate_duration","s"],["stylist.ci.pr_gate.runs","{run}"]]' \
    && expect_eq "$(jq -c '.body.resourceMetrics[0].scopeMetrics[0].metrics[1].sum | [.aggregationTemporality, .isMonotonic]' "$req")" \
      '[2,true]' \
    && expect_eq "$(points_of "$req" 0 .gauge.dataPoints)" \
      '[{"value":312,"attrs":{"workflow":"pr-gate","conclusion":"success"}}]' \
    && expect_eq "$(points_of "$req" 1 .sum.dataPoints)" \
      '[{"value":"1","attrs":{"attempt":"2","conclusion":"success"}}]' \
    && expect_eq "$(jq -r '[.. | .timeUnixNano? // empty] | unique | map(test("^[0-9]{19}$")) | tostring' "$req")" \
      '[true]'
}

# The other half of the contract: the CI panels of dashboard 01 query exactly the two series the
# payload above becomes in Grafana Cloud (stylist.ci.pr_gate_duration + unit s -> ..._seconds; the
# monotonic stylist.ci.pr_gate.runs -> ..._total; docs/observability/grafana.md "Metric names in
# PromQL") and filter or group only by labels the payload sets. A renamed panel query fails here.
test_dashboard_queries_only_what_the_payload_sends() {
  local dash="$ROOT/docs/observability/grafana/dashboards/01-service-health.json"
  expect_eq "$(jq -r '[.. | .expr? // empty | scan("stylist_ci_[a-z_]+")] | unique | join(" ")' "$dash")" \
    "stylist_ci_pr_gate_duration_seconds stylist_ci_pr_gate_runs_total" \
    && expect_eq "$(jq -r '
      [.. | .expr? // empty | select(test("stylist_ci_"))] as $exprs
      | ([$exprs[] | scan("stylist_ci_[a-z_]+\\{([^}]*)\\}") | .[0]
          | scan("([a-z_]+)\\s*(?:!=|=~|!~|=)") | .[0]]
        + [$exprs[] | scan("by \\(([a-z_, ]+)\\)") | .[0] | split(",")[] | gsub(" "; "")])
      | unique | join(" ")' "$dash")" \
      "attempt conclusion workflow"
}

test_attempt_and_workflow_default_to_the_github_run() {
  local dir="$TEST_ROOT/defaults" req
  start_stub "$dir" || return 1
  set +e
  OUT="$(env -u GITHUB_ACTIONS GITHUB_WORKFLOW=pr-gate GITHUB_RUN_ATTEMPT=3 \
    OTEL_EXPORTER_OTLP_ENDPOINT="http://127.0.0.1:$STUB_PORT" \
    OTEL_EXPORTER_OTLP_HEADERS=" Authorization = Basic%20${TOKEN} , junk ," \
    node "$PUSH" --duration 41.5 --conclusion failure 2>&1)"
  RC=$?
  set -e
  req="$dir/request-1.json"
  expect_eq "$RC" 0 && expect_contains "$OUT" "skipped 1 header entries" \
    && expect_no_secret "$OUT" \
    && expect_eq "$(jq -r '.url + " " + .headers.authorization' "$req")" "/v1/metrics Basic $TOKEN" \
    && expect_eq "$(points_of "$req" 0 .gauge.dataPoints)" \
      '[{"value":41.5,"attrs":{"workflow":"pr-gate","conclusion":"failure"}}]' \
    && expect_eq "$(points_of "$req" 1 .sum.dataPoints)" \
      '[{"value":"1","attrs":{"attempt":"3","conclusion":"failure"}}]'
}

test_no_endpoint_is_a_notice_and_exit_0() {
  push "" "$HEADERS" "${ARGS[@]}"
  expect_eq "$RC" 0 && expect_contains "$OUT" "notice: OTEL_EXPORTER_OTLP_ENDPOINT is empty" \
    && expect_no_secret "$OUT" || return 1
  set +e
  OUT="$(env GITHUB_ACTIONS=true OTEL_EXPORTER_OTLP_ENDPOINT= node "$PUSH" "${ARGS[@]}" 2>&1)"
  RC=$?
  set -e
  expect_eq "$RC" 0 && expect_contains "$OUT" "::notice::ci-pr-gate-metrics: OTEL_EXPORTER_OTLP_ENDPOINT"
}

test_http_error_warns_redacted_and_exit_0() {
  local dir="$TEST_ROOT/http-401"
  start_stub "$dir" --status 401 \
    --reply "{\"error\":\"token Basic $TOKEN of $ORG rejected by 127.0.0.1\"}" || return 1
  push "http://127.0.0.1:$STUB_PORT/otlp" "$HEADERS" "${ARGS[@]}"
  expect_eq "$RC" 0 && expect_contains "$OUT" "warning: push failed (pr-gate attempt 2: success in 312s): HTTP 401" \
    && expect_contains "$OUT" "[redacted]" && expect_no_secret "$OUT"
}

test_partial_success_warns_and_exit_0() {
  local dir="$TEST_ROOT/partial"
  start_stub "$dir" \
    --reply '{"partialSuccess":{"rejectedDataPoints":"1","errorMessage":"out of order sample"}}' || return 1
  push "http://127.0.0.1:$STUB_PORT/otlp" "$HEADERS" "${ARGS[@]}"
  expect_eq "$RC" 0 && expect_contains "$OUT" "rejected 1 point(s)" \
    && expect_contains "$OUT" "out of order sample" && expect_no_secret "$OUT"
}

test_unreachable_endpoint_warns_and_exit_0() {
  local dir="$TEST_ROOT/refused" port
  start_stub "$dir" || return 1
  port="$STUB_PORT"
  stop_stub # nothing listens on that port any more
  push "http://127.0.0.1:$port/otlp" "$HEADERS" "${ARGS[@]}"
  expect_eq "$RC" 0 && expect_contains "$OUT" "network error ECONNREFUSED" \
    && expect_no_secret "$OUT"
}

test_timeout_warns_and_exit_0() {
  local dir="$TEST_ROOT/hang"
  start_stub "$dir" --hang || return 1
  push "http://127.0.0.1:$STUB_PORT/otlp" "$HEADERS" "${ARGS[@]}" --timeout-ms 300
  expect_eq "$RC" 0 && expect_contains "$OUT" "timed out" && expect_no_secret "$OUT"
}

test_invalid_endpoint_warns_and_exit_0() {
  push "not a url" "$HEADERS" "${ARGS[@]}"
  expect_eq "$RC" 0 && expect_contains "$OUT" "not an http(s) URL" || return 1
  push "ftp://127.0.0.1/otlp" "$HEADERS" "${ARGS[@]}"
  expect_eq "$RC" 0 && expect_contains "$OUT" "not an http(s) URL" && expect_no_secret "$OUT"
}

test_usage_errors_exit_2() {
  local case_args
  for case_args in \
    "--conclusion success --workflow pr-gate --attempt 1" \
    "--duration -1 --conclusion success --workflow pr-gate --attempt 1" \
    "--duration 5 --conclusion maybe --workflow pr-gate --attempt 1" \
    "--duration 5 --conclusion success --workflow pr-gate" \
    "--duration 5 --conclusion success --workflow pr-gate --attempt 0" \
    "--duration 5 --conclusion success --attempt 1" \
    "--duration 5 --conclusion success --workflow pr-gate --attempt 1 --timeout-ms 0" \
    "--duration 5 --conclusion success --workflow pr-gate --attempt 1 --bogus x"; do
    # shellcheck disable=SC2086 # each case is a word list on purpose
    push "http://127.0.0.1:9/otlp" "$HEADERS" $case_args
    if [[ "$RC" != 2 ]]; then
      printf '  %s -> exit %s, expected 2: %s\n' "$case_args" "$RC" "$OUT" >&2
      return 1
    fi
  done
}

run_test "payload: names, units, temporality, attributes and resource match the dashboard" test_payload_matches_the_dashboard_queries
run_test "dashboard 01 CI panels query only the series and labels the payload sends" test_dashboard_queries_only_what_the_payload_sends
run_test "attempt and workflow default to GITHUB_RUN_ATTEMPT / GITHUB_WORKFLOW; header parsing" test_attempt_and_workflow_default_to_the_github_run
run_test "no endpoint: notice (GitHub annotation in Actions), exit 0" test_no_endpoint_is_a_notice_and_exit_0
run_test "HTTP 401: warning with the reply redacted, exit 0" test_http_error_warns_redacted_and_exit_0
run_test "OTLP partial success: warning with the reason, exit 0" test_partial_success_warns_and_exit_0
run_test "connection refused: warning, exit 0" test_unreachable_endpoint_warns_and_exit_0
run_test "no reply within --timeout-ms: warning, exit 0" test_timeout_warns_and_exit_0
run_test "endpoint not an http(s) URL: warning, exit 0" test_invalid_endpoint_warns_and_exit_0
run_test "usage errors: exit 2" test_usage_errors_exit_2

if ((failures > 0)); then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "all tests passed"
