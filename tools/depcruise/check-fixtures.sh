#!/usr/bin/env bash
# AC-3: every fixture under tools/depcruise/fixtures/<case>/ must FAIL `depcruise` with the
# rule named in expected_rule, and with no rule other than that one and the overlaps declared in
# overlap_rules. Each fixture is a self-contained tree mirroring the real layout, so the
# production config (rules.cjs) runs against it unchanged from inside the fixture root; the
# cruise covers whichever of the fixture's `apps/` and `packages/` trees exist.
# Coverage: every rule name in rules.cjs must be the expected rule of at least one fixture, so a
# new rule without a failing fixture fails this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT/tools/depcruise/rules.cjs"
FIXTURES="$ROOT/tools/depcruise/fixtures"

# fixture case -> rule it must trip. A case statement instead of an associative array so the
# script runs under macOS /bin/bash 3.2 (no `declare -A`); keep EXPECTED_CASES in sync.
EXPECTED_CASES="internal-import root-to-internal module-cycle closet-to-outfit unknown-module-dir recommendation-to-avatar recommendation-outfit-value assistant-to-internal provider-sdk-in-domain otel-sdk-in-domain platform-to-module module-to-platform shared-kernel-impure utils-dir prototype-import module-to-db dev-to-adapter unresolvable-import"
expected_rule() {
  case "$1" in
    internal-import)             echo public-api-only ;;
    root-to-internal)            echo public-api-only-external ;;
    module-cycle)                echo no-cycles ;;
    closet-to-outfit)            echo allowed-edges-only ;;
    unknown-module-dir)          echo unknown-module ;;
    recommendation-to-avatar)    echo recommendation-not-renderer ;;
    recommendation-outfit-value) echo recommendation-outfit-types-only ;;
    assistant-to-internal)       echo assistant-app-services-only ;;
    provider-sdk-in-domain)      echo domain-no-provider-sdk ;;
    otel-sdk-in-domain)          echo domain-no-provider-sdk ;;
    platform-to-module)          echo platform-leaf ;;
    module-to-platform)          echo modules-not-platform ;;
    shared-kernel-impure)        echo shared-kernel-pure ;;
    utils-dir)                   echo no-utils-dirs ;;
    prototype-import)            echo prototype-unimportable ;;
    module-to-db)                echo composition-root-only ;;
    dev-to-adapter)              echo dev-ports-only ;;
    unresolvable-import)         echo not-to-unresolvable ;;
    *)                           echo "" ;;
  esac
}

# fixture case -> other rules that unavoidably fire on the same edge (space-separated). Only an
# overlap inherent to the rules belongs here; any rule firing that is not listed fails the case.
overlap_rules() {
  case "$1" in
    # every assistant edge into another module's internal/** is also a public-api-only edge
    assistant-to-internal)    echo public-api-only ;;
    # recommendation → avatar is also absent from the 04 §4.1 DAG
    recommendation-to-avatar) echo allowed-edges-only ;;
    # the SDK packages are not installed at the repo root, so their specifiers do not resolve
    provider-sdk-in-domain)   echo not-to-unresolvable ;;
    otel-sdk-in-domain)       echo not-to-unresolvable ;;
    # composition-root-only forbids platform imports from every non-root file, modules included
    module-to-platform)       echo composition-root-only ;;
    *)                        echo "" ;;
  esac
}

# Rules caught so far, as a space-delimited list (no associative arrays in bash 3.2).
caught=" "

failures=0
for case_dir in "$FIXTURES"/*/; do
  name="$(basename "$case_dir")"
  rule="$(expected_rule "$name")"
  if [[ -z "$rule" ]]; then
    echo "FAIL  $name: no expected rule registered in check-fixtures.sh" >&2
    failures=$((failures + 1))
    continue
  fi
  # Source trees to cruise. A counter guards the array: bash 3.2 treats "${a[@]}" of an empty
  # array as unbound under `set -u`.
  sources=()
  n_sources=0
  for top in apps packages; do
    if [[ -d "$case_dir$top" ]]; then
      sources+=("$top")
      n_sources=$((n_sources + 1))
    fi
  done
  if [[ $n_sources -eq 0 ]]; then
    echo "FAIL  $name: fixture has neither apps/ nor packages/ to cruise" >&2
    failures=$((failures + 1))
    continue
  fi
  set +e
  output="$(cd "$case_dir" && "$ROOT/node_modules/.bin/depcruise" --config "$CONFIG" "${sources[@]}" 2>&1)"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    echo "FAIL  $name: depcruise exited 0, expected a '$rule' violation" >&2
    failures=$((failures + 1))
    continue
  fi
  if ! grep -q "error $rule:" <<<"$output"; then
    echo "FAIL  $name: exit $rc but rule '$rule' not in output:" >&2
    echo "$output" >&2
    failures=$((failures + 1))
    continue
  fi
  # Exactly its rule: every other rule that fired must be a declared overlap.
  allowed=" $rule $(overlap_rules "$name") "
  unexpected=""
  fired="$(sed -n 's/^ *error \([a-z0-9-]*\):.*/\1/p' <<<"$output" | sort -u)"
  for r in $fired; do
    case "$allowed" in
      *" $r "*) ;;
      *) unexpected="$unexpected $r" ;;
    esac
  done
  if [[ -n "$unexpected" ]]; then
    echo "FAIL  $name: '$rule' fired, but so did undeclared rule(s):$unexpected" >&2
    echo "$output" >&2
    failures=$((failures + 1))
    continue
  fi
  echo "ok    $name -> $rule (exit $rc)"
  grep "error $rule:" <<<"$output" | sed 's/^ */        /'
  case "$caught" in
    *" $rule "*) ;;
    *) caught="$caught$rule " ;;
  esac
done

n_expected=0
for name in $EXPECTED_CASES; do
  n_expected=$((n_expected + 1))
  [[ -d "$FIXTURES/$name" ]] || { echo "FAIL  $name: fixture directory missing" >&2; failures=$((failures + 1)); }
done

# Every rule name in rules.cjs must be caught by at least one fixture.
rules="$(node -e 'const c = require(process.argv[1]); console.log([...new Set(c.forbidden.map((r) => r.name))].join("\n"));' "$CONFIG")"
n_rules=0
n_caught=0
for r in $rules; do
  n_rules=$((n_rules + 1))
  case "$caught" in
    *" $r "*) n_caught=$((n_caught + 1)); echo "caught  $r" ;;
    *) echo "FAIL  rule '$r' has no fixture that fails on it" >&2; failures=$((failures + 1)) ;;
  esac
done

if [[ $failures -gt 0 ]]; then
  echo "check-fixtures: $failures failure(s)" >&2
  exit 1
fi
echo "check-fixtures: $n_expected fixtures failed on their named rule; $n_caught/$n_rules rules in rules.cjs caught"
