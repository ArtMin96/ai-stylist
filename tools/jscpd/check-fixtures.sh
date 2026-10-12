#!/usr/bin/env bash
# Run by `just clone-check --fixtures` (and so by `just ci-parity`): proves the clone gate still
# fails. A case directory under tools/jscpd/fixtures/ is named after the jscpd format it holds one
# copied block of. It must make jscpd exit non-zero with the threshold error under the production
# config (jscpd.json, unchanged), reporting clones of that format and of no other. `_clean/` holds
# one unrelated file per format and must exit 0 with no clone.
# The cases are the formats jscpd.json lists, read from the file: a format added there without a
# case fails here, and so does a case directory that no format names.
# jscpd.json ignores `**/fixtures/**` (fixtures never count against the real tree), so the cases
# are copied to a temp dir and scanned from there. Its `output` is relative to the working
# directory, so the JSON report of a case lands in that temp dir, never over the real report.
# Usage: tools/jscpd/check-fixtures.sh
# Exit: 0 every case behaved as described; 1 otherwise.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT/tools/jscpd/jscpd.json"
FIXTURES="$ROOT/tools/jscpd/fixtures"
JSCPD="$ROOT/node_modules/.bin/jscpd"
cd "$ROOT"

# The temp dir sits inside the checkout (artifacts/ is gitignored), not under $TMPDIR: jscpd runs
# from it, and a mise shim picks the pinned node from the mise.toml above the working directory.
mkdir -p "$ROOT/artifacts"
WORK="$(mktemp -d "$ROOT/artifacts/clone-check-fixtures.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
# `<dir>/.` copies the directory's contents with BSD and GNU cp alike.
cp -R "$FIXTURES/." "$WORK/"

failures=0
fail() {
  echo "FAIL  $1" >&2
  [[ -z "${2:-}" ]] || printf '%s\n' "$2" >&2
  failures=$((failures + 1))
}

# run_case <case> <format|none>: scans the copied case with the production config. `none` requires
# exit 0 and no clone; a format requires the threshold failure with clones of that format only.
run_case() {
  local name="$1" want="$2" rc output found
  if [[ ! -d "$WORK/$name" ]]; then
    fail "$name: fixture directory missing"
    return 0
  fi
  set +e
  # FORCE_COLOR=0: the patterns below match plain text, also where CI forces colour.
  output="$(cd "$WORK" && FORCE_COLOR=0 "$JSCPD" --config "$CONFIG" "$name" 2>&1)"
  rc=$?
  set -e
  found="$(sed -n 's/^Clone found (\([^)]*\)):.*/\1/p' <<<"$output" | sort -u)"
  if [[ "$want" == none ]]; then
    if [[ $rc -eq 0 && -z "$found" ]]; then
      echo "ok    $name -> no clone (exit 0)"
    else
      fail "$name: expected exit 0 and no clone, got exit $rc:" "$output"
    fi
    return 0
  fi
  if [[ $rc -eq 0 ]]; then
    fail "$name: jscpd exited 0, expected '$want' clones above the threshold:" "$output"
    return 0
  fi
  if ! grep -q 'too many duplicates' <<<"$output"; then
    fail "$name: exit $rc without the threshold error ('too many duplicates'):" "$output"
    return 0
  fi
  if [[ "$found" != "$want" ]]; then
    fail "$name: expected clones of format '$want' only, got '$(tr '\n' ' ' <<<"$found")':" "$output"
    return 0
  fi
  echo "ok    $name -> $want (exit $rc)"
  grep -E '^Clone found \(|too many duplicates' <<<"$output" | sed 's/^/        /'
}

formats="$(node -e 'console.log(require(process.argv[1]).format.join("\n"));' "$CONFIG")"
# Space-delimited with a space at both ends, for the membership test below (no associative arrays
# in bash 3.2).
known=" $(tr '\n' ' ' <<<"$formats")"

n_formats=0
for format in $formats; do
  run_case "$format" "$format"
  n_formats=$((n_formats + 1))
done
run_case _clean none

for case_dir in "$FIXTURES"/*/; do
  name="$(basename "$case_dir")"
  [[ "$name" == _clean ]] && continue
  case "$known" in
    *" $name "*) ;;
    *) fail "$name: no format of that name in jscpd.json, so the case never runs" ;;
  esac
done

if [[ $failures -gt 0 ]]; then
  echo "check-fixtures: $failures failure(s)" >&2
  exit 1
fi
echo "check-fixtures: $n_formats clone fixtures failed on their format (one per format in jscpd.json); _clean passed"
