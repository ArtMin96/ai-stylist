#!/usr/bin/env bash
# The capture camera's test harness (iOS `CaptureDebug`, Android `:feature:capture-debug`) ships in
# Dev / debug builds only (capture brief §11). This greps a built iOS .app bundle or Android .apk for
# the harness's marks: its module and package names, its results log and its debug test IDs.
#
#   scripts/check-capture-harness.sh absent <artefact>    exit 1 when a mark is found (Preview, Prod, release)
#   scripts/check-capture-harness.sh present <artefact>   exit 1 when none is found (Dev, debug: the
#                                                         positive control that proves the grep still fires)
#
# Called by `just ios-build` (apps/ios/scripts/xcode.sh) and `just android-check`. bash 3.2-compatible.
set -euo pipefail

PATTERN='CaptureDebug|capture-results|cap-debug|feature/capture/debug'

usage() {
  printf 'usage: check-capture-harness.sh absent|present <app bundle or apk>\n' >&2
  exit 2
}

# Prints up to five distinct marks found in $1.
marks() {
  local artefact="$1"
  if [[ -d "$artefact" ]]; then
    grep -r -a -o -h -E "$PATTERN" "$artefact" 2>/dev/null | sort -u | head -n 5 || true
  else
    unzip -p "$artefact" 'classes*.dex' 2>/dev/null | grep -a -o -E "$PATTERN" | sort -u | head -n 5 || true
  fi
}

main() {
  [[ $# -eq 2 ]] || usage
  local want="$1" artefact="$2" found
  [[ -e "$artefact" ]] || { printf 'check-capture-harness: %s not found (build it first)\n' "$artefact" >&2; exit 1; }
  found="$(marks "$artefact")"
  case "$want" in
    absent)
      if [[ -n "$found" ]]; then
        printf 'check-capture-harness: the capture test harness is in %s:\n%s\n' "$artefact" "$found" >&2
        exit 1
      fi
      printf 'check-capture-harness: no harness in %s\n' "$artefact"
      ;;
    present)
      if [[ -z "$found" ]]; then
        printf 'check-capture-harness: no harness mark in the Dev/debug build %s; the grep no longer fires (update PATTERN)\n' "$artefact" >&2
        exit 1
      fi
      printf 'check-capture-harness: harness found in the Dev/debug build %s, as expected\n' "$artefact"
      ;;
    *) usage ;;
  esac
}

main "$@"
