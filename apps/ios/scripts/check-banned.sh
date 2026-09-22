#!/usr/bin/env bash
# `just ios-check-banned [--fixtures]`: bans that the compiler and SwiftLint cannot enforce on every
# platform (SwiftLint regex rules need SourceKit, so they do not run on Linux). grep-based, so it
# runs anywhere with bash 3.2+. Comment lines (starting with //) are ignored.
#
#   unchecked-sendable     `@unchecked Sendable` anywhere in apps/ios        (use an actor, Mutex or a value type)
#   nonisolated-unsafe     `nonisolated(unsafe)` anywhere in apps/ios        (restructure instead)
#   preconcurrency-import  `@preconcurrency import` anywhere in apps/ios     (fix the upstream Sendable gap instead)
#   ui-import-in-core      SwiftUI/UIKit imported in Packages/Core or a Features *Model target (must build on Linux)
#   api-import-outside-apidata  AIStylistAPI/OpenAPI*/HTTPTypes imported outside Core's APIData (+ its tests)
#
# --fixtures  prove every rule still fires: each apps/ios/scripts/fixtures/<rule>.swift must be flagged.
# Generated code (packages/contracts/gen/swift-client) is outside apps/ios and never scanned.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

IMPORT_PREFIX='^[[:space:]]*(@[A-Za-z_]+[[:space:]]+)*((public|package|internal|fileprivate|private)[[:space:]]+)?import[[:space:]]+'
RULES=(unchecked-sendable nonisolated-unsafe preconcurrency-import ui-import-in-core api-import-outside-apidata)

rule_pattern() {
  case "$1" in
    unchecked-sendable) echo '@unchecked[[:space:]]+Sendable' ;;
    nonisolated-unsafe) echo 'nonisolated[[:space:]]*\([[:space:]]*unsafe[[:space:]]*\)' ;;
    preconcurrency-import) echo '@preconcurrency[[:space:]]+((public|package|internal|fileprivate|private)[[:space:]]+)?import' ;;
    ui-import-in-core) echo "${IMPORT_PREFIX}(SwiftUI|UIKit)([[:space:]]|\$)" ;;
    api-import-outside-apidata) echo "${IMPORT_PREFIX}(AIStylistAPI|OpenAPIRuntime|OpenAPIURLSession|HTTPTypes)([[:space:]]|\$)" ;;
  esac
}

rule_message() {
  case "$1" in
    unchecked-sendable) echo 'use an actor, Mutex, or a value type instead of @unchecked Sendable' ;;
    nonisolated-unsafe) echo 'nonisolated(unsafe) opts out of data-race safety; restructure instead' ;;
    preconcurrency-import) echo '@preconcurrency import hides Sendable errors; fix the type or wrap it in an actor' ;;
    ui-import-in-core) echo 'Core and *Model targets must stay UI-free (they build and test on Linux)' ;;
    api-import-outside-apidata) echo 'only Packages/Core/Sources/APIData may import the generated client / OpenAPI runtime' ;;
  esac
}

# Print the Swift files a rule applies to, one per line.
rule_files() {
  local all
  all="$(find "$IOS_DIR/App" "$IOS_DIR/Packages" -name '*.swift' -not -path '*/.build/*' | LC_ALL=C sort)"
  case "$1" in
    ui-import-in-core)
      printf '%s\n' "$all" | grep -E "^$IOS_DIR/Packages/(Core/|Features/Sources/[^/]+Model/)" || true
      ;;
    api-import-outside-apidata)
      printf '%s\n' "$all" | grep -vE "^$IOS_DIR/Packages/Core/(Sources/APIData|tests/APIDataTests)/" || true
      ;;
    *) printf '%s\n' "$all" ;;
  esac
}

# Print "file:line: text" for each non-comment line matching the rule.
rule_hits() {
  local rule="$1"
  shift
  local pattern
  pattern="$(rule_pattern "$rule")"
  if [[ $# -eq 0 ]]; then
    return 0
  fi
  grep -nHE -- "$pattern" "$@" | grep -vE '^[^:]+:[0-9]+:[[:space:]]*//' || true
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,13p' "$0"
  exit 0
fi

if [[ "${1:-}" == "--fixtures" ]]; then
  failed=0
  for rule in "${RULES[@]}"; do
    fixture="$IOS_DIR/scripts/fixtures/$rule.swift"
    if [[ ! -f "$fixture" ]]; then
      echo "ios-check-banned --fixtures: missing fixture ${fixture#"$REPO_ROOT"/}" >&2
      failed=1
    elif [[ -z "$(rule_hits "$rule" "$fixture")" ]]; then
      echo "ios-check-banned --fixtures: rule '$rule' did NOT flag ${fixture#"$REPO_ROOT"/}" >&2
      failed=1
    else
      echo "ok: $rule flags its fixture"
    fi
  done
  exit "$failed"
elif [[ $# -gt 0 ]]; then
  ios_die "ios-check-banned: unknown argument '$1' (use --fixtures)"
fi

violations=0
for rule in "${RULES[@]}"; do
  files=()
  while IFS= read -r f; do
    [[ -n "$f" ]] && files+=("$f")
  done < <(rule_files "$rule")
  hits="$(rule_hits "$rule" ${files[@]+"${files[@]}"})"
  if [[ -n "$hits" ]]; then
    violations=1
    echo "ios-check-banned: [$rule] $(rule_message "$rule"):" >&2
    printf '%s\n' "$hits" | sed "s#^$REPO_ROOT/#  #" >&2
  fi
done
if [[ $violations -ne 0 ]]; then
  exit 1
fi
echo "ios-check-banned: ok (${#RULES[@]} rules over apps/ios/App and apps/ios/Packages)"
