#!/usr/bin/env bash
# `just ios-format [--check]`: swift-format (apps/ios/.swift-format) over the Swift we own:
# apps/ios/App and apps/ios/Packages (generated code and scripts/fixtures are excluded).
#   (no flag)  rewrite files in place
#   --check    lint only (`swift format lint --strict`): formatting AND the swift-format safety rules
#              (NeverForceUnwrap, NeverUseForceTry, NeverUseImplicitlyUnwrappedOptionals, OrderedImports).
# Uses the toolchain's swift-format: Xcode on macOS, a working swift on PATH or Docker swift:6.4 on Linux.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

check=false
for arg in "$@"; do
  case "$arg" in
    --check) check=true ;;
    -h | --help) sed -n '2,8p' "$0"; exit 0 ;;
    *) ios_die "ios-format: unknown argument '$arg' (use --check)" ;;
  esac
done

files=()
while IFS= read -r f; do
  files+=("$f")
done < <(find "${IOS_SWIFT_DIRS[@]}" -name '*.swift' -not -path '*/.build/*' -not -path '*/.swiftpm/*' | LC_ALL=C sort)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "ios-format: no Swift files found"
  exit 0
fi

cd "$REPO_ROOT"
if $check; then
  echo "==> swift format lint --strict (${#files[@]} files)"
  ios_swift format lint --strict --configuration "$IOS_DIR/.swift-format" "${files[@]}"
  echo "ios-format --check: ok"
else
  echo "==> swift format --in-place (${#files[@]} files)"
  ios_swift format --in-place --configuration "$IOS_DIR/.swift-format" "${files[@]}"
  echo "ios-format: done"
fi
