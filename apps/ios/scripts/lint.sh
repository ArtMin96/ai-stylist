#!/usr/bin/env bash
# `just ios-lint`: SwiftLint safety rules (apps/ios/.swiftlint.yml) over App/ and Packages/.
# Formatting is `just ios-format --check`; bans are `just ios-check-banned`.
#
# SwiftLint binary: $SWIFTLINT if set; else `swiftlint` on macOS; on Linux `swiftlint-static`
# (SourceKit-free; it skips custom_rules, which ios-check-banned covers), falling back to `swiftlint`.
# Missing SwiftLint fails in CI (CI=true) and only warns locally.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,7p' "$0"
  exit 0
fi

swiftlint_bin="${SWIFTLINT:-}"
if [[ -z "$swiftlint_bin" ]]; then
  if ! ios_is_macos && command -v swiftlint-static >/dev/null 2>&1; then
    swiftlint_bin=swiftlint-static
  elif command -v swiftlint >/dev/null 2>&1; then
    swiftlint_bin=swiftlint
  fi
fi
if [[ -z "$swiftlint_bin" ]]; then
  if [[ "${CI:-}" == "true" ]]; then
    ios_die "ios-lint: SwiftLint not found (mise.toml pins it: mise install swiftlint)"
  fi
  echo "ios-lint: notice: SwiftLint not installed; skipped (mise install swiftlint)." >&2
  exit 0
fi

cd "$IOS_DIR"
echo "==> $swiftlint_bin lint --strict (apps/ios/.swiftlint.yml)"
"$swiftlint_bin" lint --strict --quiet --config "$IOS_DIR/.swiftlint.yml"
echo "ios-lint: ok"
